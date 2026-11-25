import pool from '../config/db.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { toDatabaseRegistroState } from '../utils/registroEstado.js';

async function migrateLegacyPasswordHash(userId, oldPassword, ipAddress) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `SELECT public.fn_auditoria_contexto(
        $1::integer, $2::text, NULL, NULL, 'USUARIOS', $3::text
      )`,
      [userId, ipAddress, 'Conversión de credencial heredada a hash seguro']
    );
    const passwordHash = await bcrypt.hash(oldPassword, 12);
    const updated = await client.query(
      `UPDATE public.usuario
       SET "contraseña" = $1
       WHERE id_usuario = $2 AND "contraseña" = $3
       RETURNING id_usuario`,
      [passwordHash, userId, oldPassword]
    );
    if (!updated.rowCount) {
      const current = await client.query(
        `SELECT "contraseña" AS password
         FROM public.usuario
         WHERE id_usuario = $1
         FOR UPDATE`,
        [userId]
      );
      const currentHash = current.rows[0]?.password;
      const stillValid = /^\$2[aby]\$/.test(currentHash || '')
        && await bcrypt.compare(oldPassword, currentHash);
      if (!stillValid) {
        await client.query('ROLLBACK');
        return false;
      }
    }
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK').catch((rollbackError) => {
      console.error('Error revirtiendo la migración de contraseña heredada:', rollbackError);
    });
    throw error;
  } finally {
    client.release();
  }
}

export async function findUserByCredentials(email, password, ipAddress = null) {
  const result = await pool.query(
    `SELECT u.id_usuario AS id, u.correo AS email, u.primer_nombre AS nombre,
            u.primer_apellido AS apellidos, u.id_roles AS rol, u."contraseña" AS password
       FROM usuario u
      WHERE u.correo = $1
        AND u.estado_registro = 1
        AND EXISTS (
          SELECT 1
            FROM usuario_modulos um
            JOIN modulos m ON m.id_modulo = um.id_modulo
           WHERE um.id_usuario = u.id_usuario
             AND m.nombre = 'costos'
        )`,
    [email.toLowerCase().trim()]
  );
  const user = result.rows[0];
  if (!user) return null;

  const hasBcryptHash = /^\$2[aby]\$/.test(user.password);
  const passwordMatches = hasBcryptHash
    ? await bcrypt.compare(password, user.password)
    : user.password === password;

  if (!passwordMatches) return null;
  if (!hasBcryptHash) {
    const migratedOrCurrentHashStillMatches = await migrateLegacyPasswordHash(
      user.id,
      user.password,
      ipAddress
    );
    if (!migratedOrCurrentHashStillMatches) return null;
  }

  delete user.password;
  return user;
}

export async function findUserByEmail(email) {
  const result = await pool.query(
    'SELECT id_usuario AS id, correo AS email, primer_nombre AS nombre, primer_apellido AS apellidos, id_roles AS rol FROM usuario WHERE correo = $1 AND estado_registro = 1',
    [email.toLowerCase().trim()]
  );
  return result.rows[0] || null;
}

export async function fetchAllUsers(estado = 'ACTIVO') {
  const result = await pool.query(
    `SELECT
      u.id_usuario AS id,
      u.correo AS email,
      u.primer_nombre,
      u.primer_apellido,
      u.id_roles AS rol,
      CASE WHEN u.estado_registro = 1 THEN 'ACTIVO' ELSE 'DESACTIVADO' END AS estado_registro,
      COALESCE((SELECT array_agg(idfinca) FROM usuario_finca uf WHERE uf.id_usuario = u.id_usuario), ARRAY[]::integer[]) AS fincas,
      COALESCE((SELECT array_agg(idcultivo) FROM usuario_cultivo uc WHERE uc.id_usuario = u.id_usuario), ARRAY[]::integer[]) AS cultivos,
      COALESCE((
        SELECT array_agg(m.nombre ORDER BY m.nombre)
        FROM usuario_modulos um
        JOIN modulos m ON m.id_modulo = um.id_modulo
        WHERE um.id_usuario = u.id_usuario
          AND m.nombre IN ('costos', 'inventario')
      ), ARRAY[]::varchar[]) AS modulos
    FROM usuario u
    WHERE u.estado_registro = $1
      AND EXISTS (
        SELECT 1
          FROM usuario_modulos um
          JOIN modulos m ON m.id_modulo = um.id_modulo
         WHERE um.id_usuario = u.id_usuario
           AND m.nombre IN ('costos', 'inventario')
      )
    ORDER BY u.id_usuario`,
    [toDatabaseRegistroState(estado)]
  );
  return result.rows;
}

export async function createUser({
  nombre,
  apellidos,
  correo,
  contraseña,
  rol,
  fincas = [],
  cultivos = [],
  modulos = ['costos'],
}) {
  const roleId = rol === 'administrador' ? 1 : 2
  const result = await pool.query(
    `INSERT INTO usuario (primer_nombre, primer_apellido, correo, "contraseña", id_roles, estado_registro)
     VALUES ($1, $2, $3, $4, $5, 1)
     RETURNING id_usuario AS id, correo AS email, primer_nombre, primer_apellido,
               id_roles AS rol, 'ACTIVO'::text AS estado_registro`,
    [nombre, apellidos, correo, contraseña, roleId]
  )
  
  const userId = result.rows[0].id;

  const moduleAssignments = await pool.query(
    `INSERT INTO usuario_modulos (id_usuario, id_modulo)
     SELECT $1, m.id_modulo
     FROM modulos m
     WHERE m.nombre = ANY($2::text[])
     RETURNING id_modulo`,
    [userId, modulos]
  )
  if (moduleAssignments.rows.length !== modulos.length) {
    const error = new Error('El catálogo public.modulos no contiene todos los módulos solicitados.')
    error.code = 'MODULE_CATALOG_INCOMPLETE'
    throw error
  }
  
  // Asignar fincas si existen
  if (fincas && fincas.length > 0) {
    const fincasValues = fincas.map((fincaId, idx) => `($1, $${idx + 2})`).join(',');
    const fincasQuery = `INSERT INTO usuario_finca (id_usuario, idfinca) VALUES ${fincasValues}`;
    const fincasParams = [userId, ...fincas];
    await pool.query(fincasQuery, fincasParams);
  }
  
  // Asignar cultivos si existen
  if (cultivos && cultivos.length > 0) {
    const cultivosValues = cultivos.map((cultivoId, idx) => `($1, $${idx + 2})`).join(',');
    const cultivosQuery = `INSERT INTO usuario_cultivo (id_usuario, idcultivo) VALUES ${cultivosValues}`;
    const cultivosParams = [userId, ...cultivos];
    await pool.query(cultivosQuery, cultivosParams);
  }
  
  return { ...result.rows[0], modulos }
}

export async function updateUser(id, { nombre, apellidos, correo, rol, fincas = [], cultivos = [], modulos }) {
  const roleId = rol === 'administrador' ? 1 : 2
  const result = await pool.query(
    `UPDATE usuario
     SET primer_nombre = $1, primer_apellido = $2, correo = $3, id_roles = $4
     WHERE id_usuario = $5
     RETURNING id_usuario AS id, correo AS email, primer_nombre, primer_apellido,
               id_roles AS rol,
               CASE WHEN estado_registro = 1 THEN 'ACTIVO' ELSE 'DESACTIVADO' END AS estado_registro`,
    [nombre, apellidos, correo, roleId, id]
  )
  
  // Actualizar fincas asignadas
  if (fincas !== undefined) {
    await pool.query(
      'DELETE FROM usuario_finca WHERE id_usuario = $1',
      [id]
    );
    
    if (fincas && fincas.length > 0) {
      const fincasValues = fincas.map((fincaId, idx) => `($1, $${idx + 2})`).join(',');
      const fincasQuery = `INSERT INTO usuario_finca (id_usuario, idfinca) VALUES ${fincasValues}`;
      const fincasParams = [id, ...fincas];
      await pool.query(fincasQuery, fincasParams);
    }
  }
  
  // Actualizar cultivos asignados
  if (cultivos !== undefined) {
    await pool.query(
      'DELETE FROM usuario_cultivo WHERE id_usuario = $1',
      [id]
    );
    
    if (cultivos && cultivos.length > 0) {
      const cultivosValues = cultivos.map((cultivoId, idx) => `($1, $${idx + 2})`).join(',');
      const cultivosQuery = `INSERT INTO usuario_cultivo (id_usuario, idcultivo) VALUES ${cultivosValues}`;
      const cultivosParams = [id, ...cultivos];
      await pool.query(cultivosQuery, cultivosParams);
    }
  }

  if (modulos !== undefined) {
    await pool.query(
      `DELETE FROM usuario_modulos um
       USING modulos m
       WHERE um.id_usuario = $1
         AND um.id_modulo = m.id_modulo
         AND m.nombre IN ('costos', 'inventario')`,
      [id]
    )
    const moduleAssignments = await pool.query(
      `INSERT INTO usuario_modulos (id_usuario, id_modulo)
       SELECT $1, m.id_modulo
       FROM modulos m
       WHERE m.nombre = ANY($2::text[])
       RETURNING id_modulo`,
      [id, modulos]
    )
    if (moduleAssignments.rows.length !== modulos.length) {
      const error = new Error('El catálogo public.modulos no contiene todos los módulos solicitados.')
      error.code = 'MODULE_CATALOG_INCOMPLETE'
      throw error
    }
  }

  const moduleResult = await pool.query(
    `SELECT COALESCE(array_agg(m.nombre ORDER BY m.nombre), ARRAY[]::varchar[]) AS modulos
     FROM usuario_modulos um
     JOIN modulos m ON m.id_modulo = um.id_modulo
     WHERE um.id_usuario = $1
       AND m.nombre IN ('costos', 'inventario')`,
    [id]
  )

  return { ...result.rows[0], modulos: moduleResult.rows[0].modulos }
}

export async function changeUserState(id, nuevoEstado) {
  const result = await pool.query(
    `UPDATE usuario
     SET estado_registro = $1
     WHERE id_usuario = $2
     RETURNING id_usuario AS id, correo AS email, primer_nombre, primer_apellido,
               id_roles AS rol,
               CASE WHEN estado_registro = 1 THEN 'ACTIVO' ELSE 'DESACTIVADO' END AS estado_registro`,
    [toDatabaseRegistroState(nuevoEstado), id]
  );
  return result.rows[0];
}

// Legacy function for backward compatibility
export async function deleteUser(id) {
  const result = await pool.query(
    'UPDATE usuario SET estado_registro = $1 WHERE id_usuario = $2 RETURNING id_usuario AS id',
    [0, id]
  )
  return result.rows[0]
}

export async function createPasswordResetToken(userId, code, expiresAt) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'UPDATE password_reset_tokens SET used = true WHERE id_usuario = $1 AND used = false',
      [userId]
    );
    const result = await client.query(
      'INSERT INTO password_reset_tokens (id_usuario, code, expires_at, used, created_at, failed_attempts) VALUES ($1, $2, $3, false, NOW(), 0) RETURNING id',
      [userId, hashResetCode(code), expiresAt]
    );
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function findActiveCostUserById(userId) {
  const result = await pool.query(
    `SELECT u.id_usuario AS id, u.correo AS email,
            concat_ws(' ', u.primer_nombre, u.primer_apellido) AS nombre
     FROM public.usuario u
     WHERE u.id_usuario = $1
       AND u.estado_registro = 1
       AND EXISTS (
         SELECT 1
         FROM public.usuario_modulos um
         JOIN public.modulos m ON m.id_modulo = um.id_modulo
         WHERE um.id_usuario = u.id_usuario AND m.nombre = 'costos'
       )`,
    [userId]
  );
  return result.rows[0] || null;
}

export async function invalidatePasswordResetToken(tokenId) {
  const client = await pool.connect();
  try {
    await client.query(
      'UPDATE password_reset_tokens SET used = true WHERE id = $1 AND used = false',
      [tokenId]
    );
  } finally {
    client.release();
  }
}

export async function recordAdminPasswordResetRequest({ userId, userName, reason }) {
  const result = await pool.query(
    `SELECT public.fn_auditoria_registrar_evento(
       'USUARIOS'::text,
       'RESTABLECIMIENTO_SOLICITADO'::text,
       'usuario'::text,
       $1::bigint,
       $2::text,
       $3::jsonb
     ) AS id`,
    [
      userId,
      reason,
      JSON.stringify({
        usuarioObjetivo: userName,
        medio: 'Código de recuperación enviado por correo',
      }),
    ]
  );
  return result.rows[0].id;
}

function hashResetCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function resetCodeMatches(storedHash, code) {
  const submittedHash = Buffer.from(hashResetCode(code), 'hex');
  const expectedHash = Buffer.from(storedHash, 'hex');
  return submittedHash.length === expectedHash.length && crypto.timingSafeEqual(submittedHash, expectedHash);
}

async function findCurrentResetToken(client, email) {
  const result = await client.query(
    `SELECT t.id, t.id_usuario, t.code, t.failed_attempts
     FROM password_reset_tokens t
     JOIN usuario u ON u.id_usuario = t.id_usuario
     WHERE LOWER(u.correo) = $1
       AND u.estado_registro = 1
       AND t.used = false
       AND t.expires_at > NOW()
       AND t.failed_attempts < 5
     ORDER BY t.created_at DESC
     LIMIT 1
     FOR UPDATE OF t`,
    [email.toLowerCase().trim()]
  );
  return result.rows[0] || null;
}

async function recordResetCodeAttempt(client, tokenId) {
  await client.query(
    `UPDATE password_reset_tokens
     SET failed_attempts = failed_attempts + 1
     WHERE id = $1 AND failed_attempts < 5`,
    [tokenId]
  );
}

export async function verifyPasswordResetCode(email, code) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const token = await findCurrentResetToken(client, email);
    if (!token) {
      await client.query('COMMIT');
      return false;
    }

    if (!resetCodeMatches(token.code, code)) {
      await recordResetCodeAttempt(client, token.id);
      await client.query('COMMIT');
      return false;
    }

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function completePasswordReset(email, code, passwordHash) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const token = await findCurrentResetToken(client, email);
    if (!token) {
      await client.query('COMMIT');
      return false;
    }

    if (!resetCodeMatches(token.code, code)) {
      await recordResetCodeAttempt(client, token.id);
      await client.query('COMMIT');
      return false;
    }

    await client.query(
      `SELECT public.fn_auditoria_contexto(
        $1::integer, NULL, NULL, NULL, 'USUARIOS', 'Recuperación de contraseña'
      )`,
      [token.id_usuario]
    );

    const userResult = await client.query(
      `UPDATE usuario
       SET "contraseña" = $1
       WHERE id_usuario = $2 AND estado_registro = 1
       RETURNING id_usuario`,
      [passwordHash, token.id_usuario]
    );
    if (!userResult.rows.length) {
      await client.query('ROLLBACK');
      return false;
    }

    await client.query(
      `UPDATE public.sesiones
       SET activa = false, fecha_cierre = NOW()
       WHERE id_usuario = $1 AND activa = true`,
      [token.id_usuario]
    );

    await client.query(
      'UPDATE password_reset_tokens SET used = true WHERE id = $1',
      [token.id]
    );
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
