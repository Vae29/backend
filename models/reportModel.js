import pool from '../config/db.js';

// Model: consultas para la sección de reportes.
// Todas las funciones reciben filtros y devuelven filas desde PostgreSQL.

export async function getFilters(fincaId) {
  try {
    const filterFinca = Number.isInteger(Number(fincaId)) && Number(fincaId) > 0 ? Number(fincaId) : null;

    const cultivosQuery = `
      SELECT idcultivo AS id, nombre, idfinca
      FROM cultivo
      WHERE (COALESCE(UPPER(estado_registro), '') = 'ACTIVO')
        AND ($1::int IS NULL OR idfinca = $1)
      ORDER BY nombre
    `;
    const usuariosQuery = `
      SELECT id_usuario AS id, primer_nombre AS nombre, primer_apellido AS apellidos, correo AS email
      FROM usuario
      ORDER BY primer_nombre
    `;
    const estadosQuery = `
      SELECT idestado AS id, nombre
      FROM estado
      ORDER BY nombre
    `;
    const categoriasQuery = `
      SELECT idcategoria AS id, nombre
      FROM categoria_costo
      ORDER BY nombre
    `;

    const [cultivosRes, usuariosRes, estadosRes, categoriasRes] = await Promise.all([
      pool.query(cultivosQuery, [filterFinca]),
      pool.query(usuariosQuery),
      pool.query(estadosQuery),
      pool.query(categoriasQuery),
    ]);

    return {
      cultivos: cultivosRes.rows,
      usuarios: usuariosRes.rows,
      estados: estadosRes.rows,
      categorias: categoriasRes.rows,
    };
  } catch (error) {
    console.error('Error in getFilters:', error);
    throw error;
  }
}

function buildCommonWhere(filters, params) {
  const where = [];
  const {
    fincaId,
    cultivoId,
    categoriaId,
    usuarioId,
    estado,
    estadoId,
    fechaInicio,
    fechaFin,
  } = filters || {};

  // Filtro obligatorio: solo registros ACTIVOS de cultivo
  where.push(`COALESCE(UPPER(cu.estado_registro), '') = 'ACTIVO'`);
  // Filtro obligatorio: solo registros ACTIVOS de costo (si existen en la query)
  where.push(`(co.idcosto IS NULL OR COALESCE(UPPER(co.estado_registro), '') = 'ACTIVO')`);
  // Filtro obligatorio: solo registros ACTIVOS de cosecha (si existen en la query)
  where.push(`(cc.idcosecha IS NULL OR COALESCE(UPPER(cc.estado_registro), '') = 'ACTIVO')`);

  if (fincaId) {
    params.push(Number(fincaId));
    where.push(`cu.idfinca = $${params.length}`);
  }
  if (cultivoId) {
    params.push(Number(cultivoId));
    where.push(`cu.idcultivo = $${params.length}`);
  }
  if (categoriaId) {
    params.push(Number(categoriaId));
    where.push(`co.idcategoria = $${params.length}`);
  }
  if (usuarioId) {
    params.push(Number(usuarioId));
    where.push(`u.id_usuario = $${params.length}`);
  }
  if (estadoId) {
    params.push(Number(estadoId));
    where.push(`e.idestado = $${params.length}`);
  } else if (estado) {
    params.push(String(estado));
    where.push(`LOWER(e.nombre) = LOWER($${params.length})`);
  }
  if (fechaInicio) {
    params.push(fechaInicio);
    where.push(`(co.fecha >= $${params.length} OR cc.fecha_cosecha >= $${params.length})`);
  }
  if (fechaFin) {
    params.push(fechaFin);
    where.push(`(co.fecha <= $${params.length} OR cc.fecha_cosecha <= $${params.length})`);
  }

  return where.length ? `WHERE ${where.join(' AND ')}` : '';
}

export async function reportByCultivo(filters = {}) {
  const client = await pool.connect();
  try {
    const params = [];
    const where = buildCommonWhere(filters, params);

    const query = `
      SELECT cu.idcultivo AS id,
             cu.nombre AS cultivo,
             COALESCE(SUM(co.valor), 0) AS total_costos,
             COALESCE(SUM(cc.cantidad_cosechada * cc.precio_unitario), 0) AS total_ingresos,
             COALESCE(SUM(cc.cantidad_cosechada), 0) AS total_produccion
      FROM cultivo cu
      LEFT JOIN costo co ON co.idcultivo = cu.idcultivo
      LEFT JOIN cosecha cc ON cc.idcultivo = cu.idcultivo
      LEFT JOIN estado e ON cu.idestado = e.idestado
      LEFT JOIN usuario_cultivo uc ON uc.idcultivo = cu.idcultivo
      LEFT JOIN usuario u ON uc.id_usuario = u.id_usuario
      ${where}
      GROUP BY cu.idcultivo, cu.nombre
      ORDER BY cu.nombre;
    `;

    try {
      const result = await client.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('reportByCultivo SQL error:', {
        filters,
        query,
        params,
        error: error.stack || error,
      });
      throw error;
    }
  } finally {
    client.release();
  }
}

export async function reportCostos(filters = {}) {
  const client = await pool.connect();
  try {
    const params = [];
    const where = buildCommonWhere(filters, params);

    const query = `
      SELECT cat.nombre AS categoria,
             cu.nombre AS cultivo,
             co.descripcion,
             co.valor,
             co.fecha
      FROM costo co
      LEFT JOIN categoria_costo cat ON cat.idcategoria = co.idcategoria
      LEFT JOIN cultivo cu ON cu.idcultivo = co.idcultivo
      LEFT JOIN estado e ON cu.idestado = e.idestado
      LEFT JOIN usuario_cultivo uc ON uc.idcultivo = cu.idcultivo
      LEFT JOIN usuario u ON uc.id_usuario = u.id_usuario
      ${where}
      ORDER BY co.fecha DESC
      LIMIT 1000;
    `;

    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function reportProduccion(filters = {}) {
  const client = await pool.connect();
  try {
    const params = [];
    const where = buildCommonWhere(filters, params);

    const query = `
      SELECT cu.nombre AS cultivo,
             cc.cantidad_cosechada AS cantidad,
             cc.fecha_cosecha AS fecha,
             cc.precio_unitario AS precio_unitario
      FROM cosecha cc
      LEFT JOIN cultivo cu ON cu.idcultivo = cc.idcultivo
      LEFT JOIN estado e ON cu.idestado = e.idestado
      LEFT JOIN usuario_cultivo uc ON uc.idcultivo = cu.idcultivo
      LEFT JOIN usuario u ON uc.id_usuario = u.id_usuario
      ${where}
      ORDER BY cc.fecha_cosecha DESC
      LIMIT 1000;
    `;

    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function reportRentabilidad(filters = {}) {
  const client = await pool.connect();
  try {
    const params = [];
    const where = buildCommonWhere(filters, params);

    const query = `
      SELECT cu.idcultivo AS id,
             cu.nombre AS cultivo,
             COALESCE(SUM(co.valor), 0) AS total_costos,
             COALESCE(SUM(cc.cantidad_cosechada * cc.precio_unitario), 0) AS total_ingresos,
             COALESCE(SUM(cc.cantidad_cosechada * cc.precio_unitario), 0) - COALESCE(SUM(co.valor), 0) AS ganancia
      FROM cultivo cu
      LEFT JOIN costo co ON co.idcultivo = cu.idcultivo
      LEFT JOIN cosecha cc ON cc.idcultivo = cu.idcultivo
      LEFT JOIN estado e ON cu.idestado = e.idestado
      LEFT JOIN usuario_cultivo uc ON uc.idcultivo = cu.idcultivo
      LEFT JOIN usuario u ON uc.id_usuario = u.id_usuario
      ${where}
      GROUP BY cu.idcultivo, cu.nombre
      ORDER BY ganancia DESC
      LIMIT 1000;
    `;

    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function reportByTrabajador(filters = {}) {
  const client = await pool.connect();
  try {
    const params = [];
    let where = [];
    const { fincaId, cultivoId, usuarioId, estado, estadoId, fechaInicio, fechaFin } = filters || {};

    // Filtro obligatorio: solo registros ACTIVOS
    where.push(`COALESCE(UPPER(cu.estado_registro), '') = 'ACTIVO'`);
    where.push(`(co.idcosto IS NULL OR COALESCE(UPPER(co.estado_registro), '') = 'ACTIVO')`);
    where.push(`(cc.idcosecha IS NULL OR COALESCE(UPPER(cc.estado_registro), '') = 'ACTIVO')`);

    if (usuarioId) {
      params.push(Number(usuarioId));
      where.push(`u.id_usuario = $${params.length}`);
    }
    if (fincaId) {
      params.push(Number(fincaId));
      where.push(`cu.idfinca = $${params.length}`);
    }
    if (cultivoId) {
      params.push(Number(cultivoId));
      where.push(`cu.idcultivo = $${params.length}`);
    }
    if (estadoId) {
      params.push(Number(estadoId));
      where.push(`e.idestado = $${params.length}`);
    } else if (estado) {
      params.push(String(estado));
      where.push(`LOWER(e.nombre) = LOWER($${params.length})`);
    }
    if (fechaInicio) {
      params.push(fechaInicio);
      where.push(`(co.fecha >= $${params.length} OR cc.fecha_cosecha >= $${params.length})`);
    }
    if (fechaFin) {
      params.push(fechaFin);
      where.push(`(co.fecha <= $${params.length} OR cc.fecha_cosecha <= $${params.length})`);
    }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const query = `
      SELECT u.id_usuario AS id,
             u.primer_nombre || ' ' || u.primer_apellido AS nombre,
             COALESCE(SUM(co.valor), 0) AS total_costos,
             COUNT(DISTINCT cu.idcultivo) AS cultivos_asignados
      FROM usuario u
      LEFT JOIN usuario_cultivo uc ON uc.id_usuario = u.id_usuario
      LEFT JOIN cultivo cu ON cu.idcultivo = uc.idcultivo
      LEFT JOIN costo co ON co.idcultivo = cu.idcultivo
      LEFT JOIN cosecha cc ON cc.idcultivo = cu.idcultivo
      LEFT JOIN estado e ON cu.idestado = e.idestado
      ${whereClause}
      GROUP BY u.id_usuario, u.primer_nombre, u.primer_apellido
      ORDER BY total_costos DESC
      LIMIT 1000;
    `;

    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
}
