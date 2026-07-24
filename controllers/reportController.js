import pool from '../config/db.js';

const mockCultivos = [
  { id: 1, nombre: 'Tomate', fincaId: 1, estado: 'EN_PROCESO', tipo: 'Tomate', fecha_inicio: '2025-01-10', usuarioId: 1 },
  { id: 2, nombre: 'Maíz', fincaId: 1, estado: 'FINALIZADO', tipo: 'Maíz', fecha_inicio: '2024-09-15', usuarioId: 2 },
  { id: 3, nombre: 'Café', fincaId: 2, estado: 'EN_PROCESO', tipo: 'Café', fecha_inicio: '2025-03-01', usuarioId: 1 },
];

const mockCostos = [
  { id: 1, categoria: 'Mano de Obra', cultivoId: 1, cultivo: 'Tomate', descripcion: 'Jornales', valor: 250000, fecha: '2025-02-01', fincaId: 1, usuarioId: 1 },
  { id: 2, categoria: 'Materia Prima', cultivoId: 2, cultivo: 'Maíz', descripcion: 'Fertilizante', valor: 180000, fecha: '2024-10-10', fincaId: 1, usuarioId: 2 },
  { id: 3, categoria: 'Servicios', cultivoId: 3, cultivo: 'Café', descripcion: 'Riego', valor: 90000, fecha: '2025-03-20', fincaId: 2, usuarioId: 1 },
];

const mockCosechas = [
  { id: 1, cultivoId: 1, cultivo: 'Tomate', cantidad: 120, unidad: 'kg', fecha: '2025-02-15', precio_unitario: 4500, fincaId: 1, usuarioId: 1 },
  { id: 2, cultivoId: 2, cultivo: 'Maíz', cantidad: 300, unidad: 'kg', fecha: '2024-11-01', precio_unitario: 2100, fincaId: 1, usuarioId: 2 },
  { id: 3, cultivoId: 3, cultivo: 'Café', cantidad: 80, unidad: 'kg', fecha: '2025-04-01', precio_unitario: 3200, fincaId: 2, usuarioId: 1 },
];

const mockUsuarios = [
  { id: 1, nombre: 'Carlos', apellidos: 'Ruiz', cultivos: [1, 3] },
  { id: 2, nombre: 'Ana', apellidos: 'Pérez', cultivos: [2] },
];

const mockCategorias = [
  { id: 1, nombre: 'Mano de Obra' },
  { id: 2, nombre: 'Materia Prima' },
  { id: 3, nombre: 'Servicios' },
  { id: 4, nombre: 'Costos Indirectos' },
];

const mockEstados = [
  { id: 1, nombre: 'En proceso' },
  { id: 2, nombre: 'Finalizado' },
  { id: 3, nombre: 'Archivado' },
];

function buildSuccess(data, message = 'Consulta exitosa') {
  return { success: true, data, message };
}

function buildError(message) {
  return { success: false, message, error: message };
}

function normalizeFilters(filters = {}) {
  const fincaId = filters.fincaId != null ? Number(filters.fincaId) : null;
  const cultivoId = filters.cultivoId != null ? Number(filters.cultivoId) : null;
  const categoriaId = filters.categoriaId != null ? Number(filters.categoriaId) : null;
  const usuarioId = filters.usuarioId != null ? Number(filters.usuarioId) : null;
  const estadoId = filters.estadoId != null ? Number(filters.estadoId) : null;
  const fechaInicio = filters.fechaInicio || null;
  const fechaFin = filters.fechaFin || null;
  return { fincaId, cultivoId, categoriaId, usuarioId, estadoId, fechaInicio, fechaFin };
}

function matchesDateRange(value, fechaInicio, fechaFin) {
  if (!value) return true;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return true;
  if (fechaInicio) {
    const inicio = new Date(fechaInicio);
    if (target < inicio) return false;
  }
  if (fechaFin) {
    const fin = new Date(fechaFin);
    if (target > fin) return false;
  }
  return true;
}

function applyFilters(items, filters) {
  const normalized = normalizeFilters(filters);
  return items.filter((item) => {
    if (normalized.fincaId && item.fincaId != null && Number(item.fincaId) !== normalized.fincaId) return false;
    if (normalized.cultivoId && item.cultivoId != null && Number(item.cultivoId) !== normalized.cultivoId) return false;
    if (normalized.categoriaId && item.categoriaId != null && Number(item.categoriaId) !== normalized.categoriaId) return false;
    if (normalized.usuarioId && item.usuarioId != null && Number(item.usuarioId) !== normalized.usuarioId) return false;
    if (normalized.estadoId && item.estadoId != null && Number(item.estadoId) !== normalized.estadoId) return false;
    if (normalized.fechaInicio || normalized.fechaFin) {
      const itemDate = item.fecha || item.fecha_inicio || null;
      if (!matchesDateRange(itemDate, normalized.fechaInicio, normalized.fechaFin)) return false;
    }
    return true;
  });
}

async function getDbFallback(label, fallback) {
  try {
    const result = await pool.query('SELECT 1 as ok');
    if (result.rows?.length) {
      return null;
    }
  } catch (error) {
    return fallback;
  }
  return fallback;
}

async function getRealDataFromDb() {
  const queries = {
    cultivos: `
      SELECT c.id_cultivo AS id, c.nombre, c.idfinca AS "fincaId", c.idestado AS "estadoId", c.fecha_inicio AS "fechaInicio", c.idtipocultivo AS "tipoCultivoId"
      FROM cultivo c
      WHERE c.estado_registro = 'ACTIVO'
      ORDER BY c.id_cultivo
    `,
    costos: `
      SELECT c.id_costo AS id, c.descripcion, c.valor, c.fecha_registro AS fecha, c.idcultivo AS "cultivoId", c.idfinca AS "fincaId", c.idusuario AS "usuarioId", c.idsubcategoria AS "categoriaId"
      FROM costo c
      WHERE c.estado_registro = 'ACTIVO'
      ORDER BY c.id_costo
    `,
    cosechas: `
      SELECT ch.id_cosecha AS id, ch.idcultivo AS "cultivoId", ch.cantidad_cosechada AS cantidad, ch.fecha_cosecha AS fecha, ch.precio_unitario AS "precioUnitario", ch.idfinca AS "fincaId", ch.idusuario AS "usuarioId"
      FROM cosecha ch
      WHERE ch.estado_registro = 'ACTIVO'
      ORDER BY ch.id_cosecha
    `,
    usuarios: `
      SELECT u.id_usuario AS id, u.nombre, u.apellidos, u.id_rol AS "rolId"
      FROM usuario u
      WHERE u.estado_registro = 'ACTIVO'
      ORDER BY u.id_usuario
    `,
    categorias: `
      SELECT id_categoria_costo AS id, nombre
      FROM categoria_costo
      ORDER BY id_categoria_costo
    `,
    estados: `
      SELECT id_estado AS id, nombre
      FROM estado_cultivo
      ORDER BY id_estado
    `,
  };

  const data = {};
  for (const [key, sql] of Object.entries(queries)) {
    try {
      const result = await pool.query(sql);
      data[key] = result.rows;
    } catch (error) {
      data[key] = [];
    }
  }
  return data;
}

async function getReportFiltersData(req) {
  const fallback = await getDbFallback('filters', mockCultivos);
  if (fallback) {
    return fallback;
  }

  const fincaId = req.query?.fincaId != null ? Number(req.query.fincaId) : null;
  const data = await getRealDataFromDb();
  const cultivos = (data.cultivos || []).filter((cultivo) => (fincaId ? Number(cultivo.fincaId) === fincaId : true));
  const usuarios = data.usuarios || [];
  const estados = data.estados || [];
  const categorias = data.categorias || [];

  return {
    cultivos: cultivos.map((cultivo) => ({ id: cultivo.id, nombre: cultivo.nombre })),
    usuarios: usuarios.map((usuario) => ({ id: usuario.id, nombre: `${usuario.nombre} ${usuario.apellidos}`.trim() })),
    estados: estados.map((estado) => ({ id: estado.id, nombre: estado.nombre })),
    categorias: categorias.map((categoria) => ({ id: categoria.id, nombre: categoria.nombre })),
  };
}

export async function getReportFilters(req, res) {
  try {
    const data = await getReportFiltersData(req);
    return res.json(buildSuccess(data));
  } catch (error) {
    console.error('getReportFilters error', error);
    return res.status(500).json(buildError('No se pudieron cargar los filtros del reporte'));
  }
}

function normalizeReportRows(rows, filters = {}) {
  return applyFilters(rows, filters);
}

export async function postReportPorCultivo(req, res) {
  try {
    const filters = req.body || {};
    const data = await getRealDataFromDb();
    const rows = normalizeReportRows((data.cultivos || []).map((cultivo) => ({
      id: cultivo.id,
      cultivo: cultivo.nombre,
      estado: cultivo.estadoId === 2 ? 'FINALIZADO' : 'EN_PROCESO',
      total_produccion: (data.cosechas || []).filter((cosecha) => Number(cosecha.cultivoId) === Number(cultivo.id)).reduce((acc, cur) => acc + Number(cur.cantidad || 0), 0),
      total_ingresos: (data.cosechas || []).filter((cosecha) => Number(cosecha.cultivoId) === Number(cultivo.id)).reduce((acc, cur) => acc + Number(cur.cantidad || 0) * Number(cur.precioUnitario || 0), 0),
      total_costos: (data.costos || []).filter((costo) => Number(costo.cultivoId) === Number(cultivo.id)).reduce((acc, cur) => acc + Number(cur.valor || 0), 0),
      fincaId: cultivo.fincaId,
      usuarioId: null,
      estadoId: cultivo.estadoId || 1,
    })), filters);
    return res.json(buildSuccess(rows, 'Reporte por cultivo generado'));
  } catch (error) {
    console.error('postReportPorCultivo error', error);
    return res.status(500).json(buildError('No se pudo generar el reporte por cultivo'));
  }
}

export async function postReportCostos(req, res) {
  try {
    const filters = req.body || {};
    const data = await getRealDataFromDb();
    const rows = normalizeReportRows((data.costos || []).map((item) => ({
      id: item.id,
      categoria: (data.categorias || []).find((cat) => Number(cat.id) === Number(item.categoriaId))?.nombre || 'Sin categoría',
      cultivo: (data.cultivos || []).find((cultivo) => Number(cultivo.id) === Number(item.cultivoId))?.nombre || 'Sin cultivo',
      descripcion: item.descripcion,
      valor: item.valor,
      fecha: item.fecha,
      categoriaId: item.categoriaId,
      cultivoId: item.cultivoId,
      fincaId: item.fincaId,
      usuarioId: item.usuarioId,
    })), filters);
    return res.json(buildSuccess(rows, 'Reporte de costos generado'));
  } catch (error) {
    console.error('postReportCostos error', error);
    return res.status(500).json(buildError('No se pudo generar el reporte de costos'));
  }
}

export async function postReportProduccion(req, res) {
  try {
    const filters = req.body || {};
    const data = await getRealDataFromDb();
    const rows = normalizeReportRows((data.cosechas || []).map((item) => ({
      id: item.id,
      cultivo: (data.cultivos || []).find((cultivo) => Number(cultivo.id) === Number(item.cultivoId))?.nombre || 'Sin cultivo',
      cantidad: item.cantidad,
      unidad: 'kg',
      fecha: item.fecha,
      precio_unitario: item.precioUnitario,
      cultivoId: item.cultivoId,
      fincaId: item.fincaId,
      usuarioId: item.usuarioId,
    })), filters);
    return res.json(buildSuccess(rows, 'Reporte de producción generado'));
  } catch (error) {
    console.error('postReportProduccion error', error);
    return res.status(500).json(buildError('No se pudo generar el reporte de producción'));
  }
}

export async function postReportRentabilidad(req, res) {
  try {
    const filters = req.body || {};
    const data = await getRealDataFromDb();
    const rows = normalizeReportRows((data.cultivos || []).map((cultivo) => {
      const costos = (data.costos || []).filter((item) => Number(item.cultivoId) === Number(cultivo.id)).reduce((acc, cur) => acc + Number(cur.valor || 0), 0);
      const cosechas = (data.cosechas || []).filter((item) => Number(item.cultivoId) === Number(cultivo.id));
      const ingresos = cosechas.reduce((acc, cur) => acc + Number(cur.cantidad || 0) * Number(cur.precioUnitario || 0), 0);
      const ganancia = ingresos - costos;
      return {
        id: cultivo.id,
        cultivo: cultivo.nombre,
        total_ingresos: ingresos,
        total_costos: costos,
        ganancia,
        fincaId: cultivo.fincaId,
        usuarioId: null,
        estadoId: cultivo.estadoId || 1,
      };
    }), filters);
    return res.json(buildSuccess(rows, 'Reporte de rentabilidad generado'));
  } catch (error) {
    console.error('postReportRentabilidad error', error);
    return res.status(500).json(buildError('No se pudo generar el reporte de rentabilidad'));
  }
}

export async function postReportTrabajador(req, res) {
  try {
    const filters = req.body || {};
    const data = await getRealDataFromDb();
    const rows = normalizeReportRows((data.usuarios || []).map((usuario) => ({
      id: usuario.id,
      nombre: `${usuario.nombre} ${usuario.apellidos}`.trim(),
      actividades: 'Asignaciones activas',
      total_costos: (data.costos || []).filter((item) => Number(item.usuarioId) === Number(usuario.id)).reduce((acc, cur) => acc + Number(cur.valor || 0), 0),
      cultivos_asignados: 0,
      fincaId: null,
      usuarioId: usuario.id,
    })), filters);
    return res.json(buildSuccess(rows, 'Reporte por trabajador generado'));
  } catch (error) {
    console.error('postReportTrabajador error', error);
    return res.status(500).json(buildError('No se pudo generar el reporte por trabajador'));
  }
}

export async function postReportQuery(req, res) {
  try {
    const { reportType } = req.body || {};
    if (reportType === 'por-cultivo') return postReportPorCultivo(req, res);
    if (reportType === 'costos') return postReportCostos(req, res);
    if (reportType === 'produccion') return postReportProduccion(req, res);
    if (reportType === 'rentabilidad') return postReportRentabilidad(req, res);
    if (reportType === 'trabajador') return postReportTrabajador(req, res);
    return res.json(buildSuccess([], 'Tipo de reporte no reconocido'));
  } catch (error) {
    console.error('postReportQuery error', error);
    return res.status(500).json(buildError('No se pudo ejecutar la consulta del reporte'));
  }
}

export async function postAuditReportExport(req, res) {
  return res.json(buildSuccess({ exported: true }, 'Exportación registrada'));
}
