import pool from '../config/db.js';

export async function findFincas(search = '', estado = 'ACTIVO') {
  const trimmed = String(search || '').trim();

  if (trimmed.length > 0) {
    const result = await pool.query(
      `SELECT idfinca AS id, nombre, ubicacion, estado_registro, motivo_estado, fecha_cambio_estado
       FROM finca
       WHERE estado_registro = $1
         AND nombre ILIKE $2
       ORDER BY nombre`,
      [estado, `%${trimmed}%`]
    );
    return result.rows;
  }

  const result = await pool.query(
    `SELECT idfinca AS id, nombre, ubicacion, estado_registro, motivo_estado, fecha_cambio_estado
     FROM finca
     WHERE estado_registro = $1
     ORDER BY nombre`,
    [estado]
  );
  return result.rows;
}

export async function findAllFincasByState(estado = 'ACTIVO') {
  const result = await pool.query(
    `SELECT idfinca AS id, nombre, ubicacion, estado_registro, motivo_estado, fecha_cambio_estado
     FROM finca
     WHERE estado_registro = $1
     ORDER BY nombre`,
    [estado]
  );
  return result.rows;
}

export async function createFinca(nombre, ubicacion) {
  const result = await pool.query(
    `INSERT INTO finca (nombre, ubicacion, estado_registro)
     VALUES ($1, $2, 'ACTIVO')
     RETURNING idfinca AS id, nombre, ubicacion, estado_registro`,
    [nombre, ubicacion]
  );
  return result.rows[0];
}

export async function updateFinca(id, nombre, ubicacion) {
  const result = await pool.query(
    `UPDATE finca
     SET nombre = $1,
         ubicacion = $2
     WHERE idfinca = $3
     RETURNING idfinca AS id, nombre, ubicacion, estado_registro`,
    [nombre, ubicacion, id]
  );
  return result.rows[0];
}

export async function changeFincaState(id, nuevoEstado, motivo, usuarioId) {
  const result = await pool.query(
    `UPDATE finca
     SET estado_registro = $1,
         motivo_estado = $2,
         fecha_cambio_estado = NOW(),
         usuario_cambio_estado = $3
     WHERE idfinca = $4
     RETURNING idfinca AS id, nombre, ubicacion, estado_registro, motivo_estado, fecha_cambio_estado`,
    [nuevoEstado, motivo, usuarioId, id]
  );
  return result.rows[0];
}

// Legacy function for backward compatibility
export async function deleteFinca(id) {
  const result = await pool.query(
    `UPDATE finca
     SET estado_registro = 'ARCHIVADO'
     WHERE idfinca = $1
     RETURNING idfinca AS id`,
    [id]
  );
  return result.rows[0];
}
