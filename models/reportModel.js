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
    const subcategoriasQuery = `
      SELECT idsubcategoria AS id, nombre, idcategoria AS "categoriaId"
      FROM subcategoria_costo
      ORDER BY nombre
    `;

    const [cultivosRes, usuariosRes, estadosRes, categoriasRes, subcategoriasRes] = await Promise.all([
      pool.query(cultivosQuery, [filterFinca]),
      pool.query(usuariosQuery),
      pool.query(estadosQuery),
      pool.query(categoriasQuery),
      pool.query(subcategoriasQuery),
    ]);

    return {
      cultivos: cultivosRes.rows,
      usuarios: usuariosRes.rows,
      estados: estadosRes.rows,
      categorias: categoriasRes.rows,
      subcategorias: subcategoriasRes.rows,
    };
  } catch (error) {
    console.error('Error in getFilters:', error);
    throw error;
  }
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function normalizeFilters(filters = {}) {
  return {
    fincaId: positiveInteger(filters.fincaId),
    cultivoId: positiveInteger(filters.cultivoId),
    categoriaId: positiveInteger(filters.categoriaId),
    subcategoriaId: positiveInteger(filters.subcategoriaId),
    usuarioId: positiveInteger(filters.usuarioId),
    estadoId: positiveInteger(filters.estadoId),
    estado: filters.estado || null,
    fechaInicio: filters.fechaInicio || null,
    fechaFin: filters.fechaFin || null,
  };
}

function addDateConditions(where, params, alias, column, filters) {
  if (filters.fechaInicio) {
    params.push(filters.fechaInicio);
    where.push(`${alias}.${column} >= $${params.length}::date`);
  }
  if (filters.fechaFin) {
    params.push(filters.fechaFin);
    where.push(`${alias}.${column} < ($${params.length}::date + INTERVAL '1 day')`);
  }
}

function buildFilteredCrops(filters, params) {
  const where = [`COALESCE(UPPER(cu.estado_registro), '') = 'ACTIVO'`];

  if (filters.fincaId) {
    params.push(filters.fincaId);
    where.push(`cu.idfinca = $${params.length}`);
  }
  if (filters.cultivoId) {
    params.push(filters.cultivoId);
    where.push(`cu.idcultivo = $${params.length}`);
  }
  if (filters.usuarioId) {
    params.push(filters.usuarioId);
    where.push(`EXISTS (
      SELECT 1 FROM usuario_cultivo uc
      WHERE uc.idcultivo = cu.idcultivo AND uc.id_usuario = $${params.length}
    )`);
  }
  if (filters.estadoId) {
    params.push(filters.estadoId);
    where.push(`cu.idestado = $${params.length}`);
  } else if (filters.estado) {
    params.push(String(filters.estado));
    where.push(`LOWER(e.nombre) = LOWER($${params.length})`);
  }

  return `filtered_crops AS (
    SELECT cu.idcultivo, cu.nombre, cu.idestado, e.nombre AS estado
    FROM cultivo cu
    LEFT JOIN estado e ON e.idestado = cu.idestado
    WHERE ${where.join(' AND ')}
  )`;
}

function buildCostConditions(filters, params) {
  const where = [`COALESCE(UPPER(co.estado_registro), '') = 'ACTIVO'`];

  if (filters.categoriaId) {
    params.push(filters.categoriaId);
    where.push(`sc.idcategoria = $${params.length}`);
  }
  if (filters.subcategoriaId) {
    params.push(filters.subcategoriaId);
    where.push(`co.idsubcategoria = $${params.length}`);
  }
  addDateConditions(where, params, 'co', 'fecha', filters);
  return where.join(' AND ');
}

function buildHarvestConditions(filters, params) {
  const where = [`COALESCE(UPPER(cc.estado_registro), '') = 'ACTIVO'`];
  addDateConditions(where, params, 'cc', 'fecha_cosecha', filters);
  return where.join(' AND ');
}

export function buildReportQuery(reportType, rawFilters = {}) {
  const filters = normalizeFilters(rawFilters);
  const params = [];
  const filteredCrops = buildFilteredCrops(filters, params);
  const ctes = [filteredCrops];

  if (['por-cultivo', 'costos', 'rentabilidad', 'trabajador'].includes(reportType)) {
    const costConditions = buildCostConditions(filters, params);
    if (reportType === 'costos') {
      return {
        query: `WITH ${filteredCrops}
          SELECT cat.nombre AS categoria,
                 sc.nombre AS subcategoria,
                 fc.nombre AS cultivo,
                 co.descripcion,
                 co.valor,
                 co.fecha
          FROM costo co
          JOIN filtered_crops fc ON fc.idcultivo = co.idcultivo
          LEFT JOIN subcategoria_costo sc ON sc.idsubcategoria = co.idsubcategoria
          LEFT JOIN categoria_costo cat ON cat.idcategoria = sc.idcategoria
          WHERE ${costConditions}
          ORDER BY co.fecha DESC
          LIMIT 1000`,
        params,
      };
    }

    ctes.push(`costs_by_crop AS (
      SELECT co.idcultivo, SUM(co.valor) AS total_costos
      FROM costo co
      JOIN filtered_crops fc ON fc.idcultivo = co.idcultivo
      LEFT JOIN subcategoria_costo sc ON sc.idsubcategoria = co.idsubcategoria
      WHERE ${costConditions}
      GROUP BY co.idcultivo
    )`);
  }

  if (['por-cultivo', 'produccion', 'rentabilidad'].includes(reportType)) {
    const harvestConditions = buildHarvestConditions(filters, params);
    if (reportType === 'produccion') {
      return {
        query: `WITH ${filteredCrops}
          SELECT fc.nombre AS cultivo,
                 cc.cantidad_cosechada AS cantidad,
                 cc.fecha_cosecha AS fecha,
                 cc.precio_unitario AS precio_unitario,
                 um.nombre AS unidad
          FROM cosecha cc
          JOIN filtered_crops fc ON fc.idcultivo = cc.idcultivo
          LEFT JOIN unidades_medidas um ON um.idunidadmedida = cc.idunidadmedida
          WHERE ${harvestConditions}
          ORDER BY cc.fecha_cosecha DESC
          LIMIT 1000`,
        params,
      };
    }

    ctes.push(`harvests_by_crop AS (
      SELECT cc.idcultivo,
             SUM(cc.cantidad_cosechada * cc.precio_unitario) AS total_ingresos,
             SUM(cc.cantidad_cosechada) AS total_produccion
      FROM cosecha cc
      JOIN filtered_crops fc ON fc.idcultivo = cc.idcultivo
      WHERE ${harvestConditions}
      GROUP BY cc.idcultivo
    )`);
  }

  if (reportType === 'por-cultivo' || reportType === 'rentabilidad') {
    const orderBy = reportType === 'rentabilidad' ? 'ganancia DESC' : 'fc.nombre';
    return {
      query: `WITH ${ctes.join(',\n')}
        SELECT fc.idcultivo AS id,
               fc.nombre AS cultivo,
               fc.estado,
               COALESCE(costs.total_costos, 0) AS total_costos,
               COALESCE(harvests.total_ingresos, 0) AS total_ingresos,
               COALESCE(harvests.total_produccion, 0) AS total_produccion,
               COALESCE(harvests.total_ingresos, 0) - COALESCE(costs.total_costos, 0) AS ganancia
        FROM filtered_crops fc
        LEFT JOIN costs_by_crop costs ON costs.idcultivo = fc.idcultivo
        LEFT JOIN harvests_by_crop harvests ON harvests.idcultivo = fc.idcultivo
        ORDER BY ${orderBy}
        LIMIT 1000`,
      params,
    };
  }

  if (reportType === 'trabajador') {
    const userFilter = filters.usuarioId ? (() => {
      params.push(filters.usuarioId);
      return `WHERE uc.id_usuario = $${params.length}`;
    })() : '';
    return {
      query: `WITH ${ctes.join(',\n')},
        user_crops AS (
          SELECT DISTINCT uc.id_usuario, fc.idcultivo
          FROM filtered_crops fc
          JOIN usuario_cultivo uc ON uc.idcultivo = fc.idcultivo
          ${userFilter}
        )
        SELECT u.id_usuario AS id,
               u.primer_nombre || ' ' || u.primer_apellido AS nombre,
               COALESCE(SUM(costs.total_costos), 0) AS total_costos,
               COUNT(DISTINCT uc.idcultivo) AS cultivos_asignados
        FROM user_crops uc
        JOIN usuario u ON u.id_usuario = uc.id_usuario
        LEFT JOIN costs_by_crop costs ON costs.idcultivo = uc.idcultivo
        GROUP BY u.id_usuario, u.primer_nombre, u.primer_apellido
        ORDER BY total_costos DESC
        LIMIT 1000`,
      params,
    };
  }

  throw new Error(`Tipo de reporte desconocido: ${reportType}`);
}

async function runReport(reportType, filters) {
  const { query, params } = buildReportQuery(reportType, filters);
  const client = await pool.connect();
  try {
    const result = await client.query(query, params);
    return result.rows;
  } catch (error) {
    console.error(`Report query failed (${reportType}):`, {
      filters,
      query,
      params,
      error: error.stack || error,
    });
    throw error;
  } finally {
    client.release();
  }
}

export const reportByCultivo = (filters = {}) => runReport('por-cultivo', filters);
export const reportCostos = (filters = {}) => runReport('costos', filters);
export const reportProduccion = (filters = {}) => runReport('produccion', filters);
export const reportRentabilidad = (filters = {}) => runReport('rentabilidad', filters);
export const reportByTrabajador = (filters = {}) => runReport('trabajador', filters);
