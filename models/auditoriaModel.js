import pool from '../config/db.js';

const CAMPOS_SENSIBLES = /password|contrase[nñ]a|token|codigo|code|secret/i;

function sanitizar(valor) {
  if (Array.isArray(valor)) return valor.map(sanitizar);
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(
      Object.entries(valor)
        .filter(([clave]) => !CAMPOS_SENSIBLES.test(clave))
        .map(([clave, dato]) => [clave, sanitizar(dato)])
    );
  }
  return valor;
}

function descripcionConContexto(descripcion, anterior, nuevo, metadatos) {
  const contexto = {
    ...(descripcion ? { detalle: descripcion } : {}),
    ...(anterior !== undefined ? { anterior: sanitizar(anterior) } : {}),
    ...(nuevo !== undefined ? { nuevo: sanitizar(nuevo) } : {}),
    ...(metadatos !== undefined ? { metadatos: sanitizar(metadatos) } : {}),
  };

  return Object.keys(contexto).length ? JSON.stringify(contexto) : null;
}

/**
 * Guarda una acción de auditoría sin exponer datos sensibles.
 * La auditoría no debe impedir que una operación de negocio termine si la
 * tabla todavía no fue migrada o presenta una falla temporal.
 */
export async function registrarAuditoria({
  usuarioId,
  modulo,
  accion,
  descripcion,
  tablaAfectada = null,
  registroId = null,
  ipUsuario = null,
  navegador = null,
  anterior,
  nuevo,
  metadatos,
}) {
  const id = Number(usuarioId);
  if (!Number.isInteger(id) || id <= 0 || !modulo || !accion) return null;

  try {
    const result = await pool.query(
      `INSERT INTO auditoria
        (usuario_id, modulo, accion, descripcion, tabla_afectada, registro_id, ip_usuario, navegador)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id_auditoria`,
      [
        id,
        String(modulo).slice(0, 50),
        String(accion).slice(0, 50),
        descripcionConContexto(descripcion, anterior, nuevo, metadatos),
        tablaAfectada ? String(tablaAfectada).slice(0, 50) : null,
        registroId == null ? null : Number(registroId),
        ipUsuario ? String(ipUsuario).slice(0, 45) : null,
        navegador || null,
      ]
    );
    return result.rows[0];
  } catch (error) {
    console.error('No se pudo guardar la auditoría:', error.message);
    return null;
  }
}

export function contextoAuditoria(req, datos = {}) {
  return {
    ...datos,
    usuarioId: datos.usuarioId ?? req.user?.id,
    ipUsuario: req.ip || req.socket?.remoteAddress || null,
    navegador: req.get('user-agent') || null,
  };
}
