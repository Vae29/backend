import pool from '../config/db.js';
import { toDatabaseRegistroState } from '../utils/registroEstado.js';

export async function findFincas(search = '', estado = 'ACTIVO') {
  const trimmed = String(search || '').trim();
  const estadoDb = toDatabaseRegistroState(estado);

  if (trimmed.length > 0) {
    const result = await pool.query(
      `SELECT idfinca AS id, nombre, ubicacion,
              CASE WHEN estado_registro = 1 THEN 'ACTIVO' ELSE 'ARCHIVADO' END AS estado_registro
       FROM finca
       WHERE estado_registro = $1
         AND nombre ILIKE $2
       ORDER BY nombre`,
      [estadoDb, `%${trimmed}%`]
    );
    return result.rows;
  }

  const result = await pool.query(
    `SELECT idfinca AS id, nombre, ubicacion,
            CASE WHEN estado_registro = 1 THEN 'ACTIVO' ELSE 'ARCHIVADO' END AS estado_registro
     FROM finca
     WHERE estado_registro = $1
     ORDER BY nombre`,
    [estadoDb]
  );
  return result.rows;
}

export async function findAllFincasByState(estado = 'ACTIVO') {
  const result = await pool.query(
    `SELECT idfinca AS id, nombre, ubicacion,
            CASE WHEN estado_registro = 1 THEN 'ACTIVO' ELSE 'ARCHIVADO' END AS estado_registro
     FROM finca
     WHERE estado_registro = $1
     ORDER BY nombre`,
    [toDatabaseRegistroState(estado)]
  );
  return result.rows;
}

export async function createFinca(nombre, ubicacion) {
  const result = await pool.query(
    `INSERT INTO finca (nombre, ubicacion, estado_registro)
     VALUES ($1, $2, 1)
     RETURNING idfinca AS id, nombre, ubicacion, 'ACTIVO'::text AS estado_registro`,
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
     RETURNING idfinca AS id, nombre, ubicacion,
               CASE WHEN estado_registro = 1 THEN 'ACTIVO' ELSE 'ARCHIVADO' END AS estado_registro`,
    [nombre, ubicacion, id]
  );
  return result.rows[0];
}

export async function changeFincaState(id, nuevoEstado) {
  const result = await pool.query(
    `UPDATE finca
     SET estado_registro = $1
     WHERE idfinca = $2
     RETURNING idfinca AS id, nombre, ubicacion,
               CASE WHEN estado_registro = 1 THEN 'ACTIVO' ELSE 'ARCHIVADO' END AS estado_registro`,
    [toDatabaseRegistroState(nuevoEstado), id]
  );
  return result.rows[0];
}

// Legacy function for backward compatibility
export async function deleteFinca(id) {
  const result = await pool.query(
    `UPDATE finca
     SET estado_registro = 0
     WHERE idfinca = $1
     RETURNING idfinca AS id`,
    [id]
  );
  return result.rows[0];
}
