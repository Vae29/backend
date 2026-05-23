import pool from '../config/db.js';

export async function findFincas(search = '') {
  const trimmed = String(search || '').trim();

  if (trimmed.length > 0) {
    const result = await pool.query(
      `SELECT idfinca AS id, nombre, ubicacion
       FROM finca
       WHERE nombre ILIKE $1
       ORDER BY nombre`,
      [`%${trimmed}%`]
    );
    return result.rows;
  }

  const result = await pool.query(
    `SELECT idfinca AS id, nombre, ubicacion
     FROM finca
     ORDER BY nombre`
  );
  return result.rows;
}

export async function createFinca(nombre, ubicacion) {
  const result = await pool.query(
    `INSERT INTO finca (nombre, ubicacion)
     VALUES ($1, $2)
     RETURNING idfinca AS id, nombre, ubicacion`,
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
     RETURNING idfinca AS id, nombre, ubicacion`,
    [nombre, ubicacion, id]
  );
  return result.rows[0];
}

export async function deleteFinca(id) {
  const result = await pool.query(
    `DELETE FROM finca
     WHERE idfinca = $1
     RETURNING idfinca AS id`,
    [id]
  );
  return result.rows[0];
}
