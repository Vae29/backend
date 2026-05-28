import pool from '../config/db.js';
import crypto from 'crypto';

// Hash del refresh token
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Crear una nueva sesión
export async function crearSesion(id_usuario, refreshToken, dispositivo = null, ipAddress = null) {
  const tokenHash = hashToken(refreshToken);
  const fechaExpiracion = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días
  
  const result = await pool.query(
    `INSERT INTO sesiones (id_usuario, refresh_token_hash, dispositivo, ip_address, activa, fecha_expiracion)
     VALUES ($1, $2, $3, $4, true, $5)
     RETURNING id_sesion, id_usuario, activa, fecha_creacion, fecha_expiracion`,
    [id_usuario, tokenHash, dispositivo, ipAddress, fechaExpiracion]
  );
  
  return result.rows[0];
}

// Verificar si una sesión existe y está activa
export async function verificarSesion(id_usuario, refreshToken) {
  const tokenHash = hashToken(refreshToken);
  
  const result = await pool.query(
    `SELECT id_sesion, id_usuario, activa, fecha_expiracion
     FROM sesiones
     WHERE id_usuario = $1 AND refresh_token_hash = $2 AND activa = true
     AND fecha_expiracion > NOW()`,
    [id_usuario, tokenHash]
  );
  
  return result.rows[0] || null;
}

// Cerrar una sesión específica
export async function cerrarSesion(id_sesion) {
  const result = await pool.query(
    `UPDATE sesiones
     SET activa = false, fecha_cierre = NOW()
     WHERE id_sesion = $1
     RETURNING id_sesion, id_usuario`,
    [id_sesion]
  );
  
  return result.rows[0];
}

// Cerrar todas las sesiones de un usuario
export async function cerrarTodasLasSesionesUsuario(id_usuario) {
  const result = await pool.query(
    `UPDATE sesiones
     SET activa = false, fecha_cierre = NOW()
     WHERE id_usuario = $1 AND activa = true
     RETURNING id_sesion`,
    [id_usuario]
  );
  
  return result.rows;
}

// Obtener todas las sesiones activas de un usuario
export async function obtenerSesionesActivas(id_usuario) {
  const result = await pool.query(
    `SELECT id_sesion, dispositivo, ip_address, fecha_creacion, fecha_expiracion
     FROM sesiones
     WHERE id_usuario = $1 AND activa = true AND fecha_expiracion > NOW()
     ORDER BY fecha_creacion DESC`,
    [id_usuario]
  );
  
  return result.rows;
}

// Limpiar sesiones expiradas
export async function limpiarSesionesExpiradas() {
  const result = await pool.query(
    `UPDATE sesiones
     SET activa = false
     WHERE fecha_expiracion <= NOW() AND activa = true`
  );
  
  return result.rowCount;
}
