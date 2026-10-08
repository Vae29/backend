import pool from '../config/db.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export async function findUserByCredentials(email, password) {
  const result = await pool.query(
    'SELECT id_usuario AS id, correo AS email, primer_nombre AS nombre, primer_apellido AS apellidos, id_roles AS rol, "contraseña" AS password FROM usuario WHERE correo = $1 AND estado_registro = $2',
    [email.toLowerCase().trim(), 'ACTIVO']
  );
  const user = result.rows[0];
  if (!user) return null;

  const passwordMatches = /^\$2[aby]\$/.test(user.password)
    ? await bcrypt.compare(password, user.password)
    : user.password === password;

  if (!passwordMatches) return null;

  delete user.password;
  return user;
}

export async function findUserByEmail(email) {
  const result = await pool.query(
    'SELECT id_usuario AS id, correo AS email, primer_nombre AS nombre, primer_apellido AS apellidos, id_roles AS rol FROM usuario WHERE correo = $1 AND estado_registro = $2',
    [email.toLowerCase().trim(), 'ACTIVO']
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
      u."contraseña" AS password,
      u.estado_registro,
      u.motivo_estado,
      u.fecha_cambio_estado,
      COALESCE((SELECT array_agg(idfinca) FROM usuario_finca uf WHERE uf.id_usuario = u.id_usuario), ARRAY[]::integer[]) AS fincas,
      COALESCE((SELECT array_agg(idcultivo) FROM usuario_cultivo uc WHERE uc.id_usuario = u.id_usuario), ARRAY[]::integer[]) AS cultivos
    FROM usuario u
    WHERE u.estado_registro = $1
    ORDER BY u.id_usuario`,
    [estado]
  );
  return result.rows;
}

export async function createUser({ nombre, apellidos, correo, contraseña, rol, fincas = [], cultivos = [] }) {
  const roleId = rol === 'administrador' ? 1 : 2
  const result = await pool.query(
    'INSERT INTO usuario (primer_nombre, primer_apellido, correo, "contraseña", id_roles, estado_registro) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_usuario AS id, correo AS email, primer_nombre, primer_apellido, id_roles AS rol, "contraseña" AS password, estado_registro',
    [nombre, apellidos, correo, contraseña, roleId, 'ACTIVO']
  )
  
  const userId = result.rows[0].id;
  
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
  
  return result.rows[0]
}

export async function updateUser(id, { nombre, apellidos, correo, contraseña, rol, fincas = [], cultivos = [] }) {
  const roleId = rol === 'administrador' ? 1 : 2
  const result = await pool.query(
    'UPDATE usuario SET primer_nombre = $1, primer_apellido = $2, correo = $3, "contraseña" = $4, id_roles = $5 WHERE id_usuario = $6 RETURNING id_usuario AS id, correo AS email, primer_nombre, primer_apellido, id_roles AS rol, "contraseña" AS password, estado_registro',
    [nombre, apellidos, correo, contraseña, roleId, id]
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
  
  return result.rows[0]
}

export async function changeUserState(id, nuevoEstado, motivo, usuarioId) {
  const result = await pool.query(
    `UPDATE usuario
     SET estado_registro = $1,
         motivo_estado = $2,
         fecha_cambio_estado = NOW(),
         usuario_cambio_estado = $3
     WHERE id_usuario = $4
     RETURNING id_usuario AS id, correo AS email, primer_nombre, primer_apellido, id_roles AS rol, estado_registro, motivo_estado, fecha_cambio_estado`,
    [nuevoEstado, motivo, usuarioId, id]
  );
  return result.rows[0];
}

// Legacy function for backward compatibility
export async function deleteUser(id) {
  const result = await pool.query(
    'UPDATE usuario SET estado_registro = $1 WHERE id_usuario = $2 RETURNING id_usuario AS id',
    ['DESACTIVADO', id]
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
       AND u.estado_registro = 'ACTIVO'
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

    const userResult = await client.query(
      `UPDATE usuario
       SET "contraseña" = $1
       WHERE id_usuario = $2 AND estado_registro = 'ACTIVO'
       RETURNING id_usuario`,
      [passwordHash, token.id_usuario]
    );
    if (!userResult.rows.length) {
      await client.query('ROLLBACK');
      return false;
    }

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
