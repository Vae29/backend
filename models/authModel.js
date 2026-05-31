import pool from '../config/db.js';

export async function findUserByCredentials(email, password) {
  const result = await pool.query(
    'SELECT id_usuario AS id, correo AS email, primer_nombre AS nombre, primer_apellido AS apellidos, id_roles AS rol FROM usuario WHERE correo = $1 AND "contraseña" = $2 AND activo = TRUE',
    [email.toLowerCase().trim(), password]
  );
  return result.rows[0] || null;
}

export async function findUserByEmail(email) {
  const result = await pool.query(
    'SELECT id_usuario AS id, correo AS email, primer_nombre AS nombre, primer_apellido AS apellidos, id_roles AS rol, "contraseña" AS password FROM usuario WHERE correo = $1 AND activo = TRUE',
    [email.toLowerCase().trim()]
  );
  return result.rows[0] || null;
}

export async function fetchAllUsers() {
  const result = await pool.query(
    `SELECT
      u.id_usuario AS id,
      u.correo AS email,
      u.primer_nombre,
      u.primer_apellido,
      u.id_roles AS rol,
      u."contraseña" AS password,
      COALESCE((SELECT array_agg(idfinca) FROM usuario_finca uf WHERE uf.id_usuario = u.id_usuario), ARRAY[]::integer[]) AS fincas,
      COALESCE((SELECT array_agg(idcultivo) FROM usuario_cultivo uc WHERE uc.id_usuario = u.id_usuario), ARRAY[]::integer[]) AS cultivos
    FROM usuario u
    WHERE u.activo = TRUE
    ORDER BY u.id_usuario`
  );
  return result.rows;
}

export async function createUser({ nombre, apellidos, correo, contraseña, rol, fincas = [], cultivos = [] }) {
  const roleId = rol === 'administrador' ? 1 : 2
  const result = await pool.query(
    'INSERT INTO usuario (primer_nombre, primer_apellido, correo, "contraseña", id_roles, activo) VALUES ($1, $2, $3, $4, $5, TRUE) RETURNING id_usuario AS id, correo AS email, primer_nombre, primer_apellido, id_roles AS rol, "contraseña" AS password',
    [nombre, apellidos, correo, contraseña, roleId]
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
    'UPDATE usuario SET primer_nombre = $1, primer_apellido = $2, correo = $3, "contraseña" = $4, id_roles = $5 WHERE id_usuario = $6 RETURNING id_usuario AS id, correo AS email, primer_nombre, primer_apellido, id_roles AS rol, "contraseña" AS password',
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

export async function deleteUser(id) {
  const result = await pool.query(
    'UPDATE usuario SET activo = FALSE WHERE id_usuario = $1 RETURNING id_usuario AS id',
    [id]
  )
  return result.rows[0]
}

export async function createPasswordResetToken(userId, code, expiresAt) {
  const result = await pool.query(
    'INSERT INTO password_reset_tokens (id_usuario, code, expires_at, used, created_at) VALUES ($1, $2, $3, false, NOW()) RETURNING id',
    [userId, code, expiresAt]
  )
  return result.rows[0]
}

export async function findValidPasswordResetToken(email, code) {
  const result = await pool.query(
    `SELECT t.id, t.id_usuario, t.code, t.expires_at
     FROM password_reset_tokens t
     JOIN usuario u ON u.id_usuario = t.id_usuario
     WHERE u.correo = $1
       AND t.code = $2
       AND t.used = false
       AND t.expires_at > NOW()
     ORDER BY t.created_at DESC
     LIMIT 1`,
    [email.toLowerCase().trim(), code]
  )
  return result.rows[0] || null
}

export async function markPasswordResetTokenUsed(tokenId) {
  const result = await pool.query(
    'UPDATE password_reset_tokens SET used = true WHERE id = $1 RETURNING id',
    [tokenId]
  )
  return result.rows[0]
}
