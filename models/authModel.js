import pool from '../config/db.js';

export async function findUserByCredentials(email, password) {
  const result = await pool.query(
    'SELECT id_usuario AS id, correo AS email, primer_nombre AS nombre, id_roles AS rol FROM usuario WHERE correo = $1 AND "contraseña" = $2',
    [email.toLowerCase().trim(), password]
  );
  return result.rows[0] || null;
}
