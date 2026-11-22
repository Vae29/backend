import * as auditoriaModel from '../models/auditoriaModel.js';

function parsePositiveInteger(value, label, maximum = Number.MAX_SAFE_INTEGER) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > maximum) {
    throw Object.assign(new Error(`${label} debe ser un entero positivo.`), { statusCode: 400 });
  }
  return parsed;
}

function parseDate(value, label) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw Object.assign(new Error(`${label} debe ser una fecha válida.`), { statusCode: 400 });
  }
  const parsedDate = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== value) {
    throw Object.assign(new Error(`${label} debe ser una fecha válida.`), { statusCode: 400 });
  }
  return value;
}

function normalizeFilters(query) {
  const fechaDesde = parseDate(query.fechaDesde, 'La fecha inicial');
  const fechaHasta = parseDate(query.fechaHasta, 'La fecha final');
  if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
    throw Object.assign(new Error('La fecha inicial no puede ser posterior a la fecha final.'), {
      statusCode: 400,
    });
  }

  const modulo = query.modulo || null;
  const accion = query.accion || null;
  const entidad = query.entidad || null;
  if (modulo && !auditoriaModel.AUDIT_MODULES.includes(modulo)) {
    throw Object.assign(new Error('La funcionalidad seleccionada no es válida.'), { statusCode: 400 });
  }
  if (accion && !auditoriaModel.AUDIT_ACTIONS.includes(accion)) {
    throw Object.assign(new Error('El tipo de operación seleccionado no es válido.'), { statusCode: 400 });
  }
  if (entidad && !auditoriaModel.AUDIT_ENTITIES.includes(entidad)) {
    throw Object.assign(new Error('La entidad seleccionada no es válida.'), { statusCode: 400 });
  }

  const busqueda = typeof query.busqueda === 'string' ? query.busqueda.trim() : '';
  if (busqueda.length > 200) {
    throw Object.assign(new Error('La búsqueda no puede superar 200 caracteres.'), { statusCode: 400 });
  }

  const page = query.page == null ? 1 : Number(query.page);
  const pageSize = query.pageSize == null ? 25 : Number(query.pageSize);
  if (!Number.isSafeInteger(page) || page <= 0 || page > 1000000) {
    throw Object.assign(new Error('La página debe ser un entero positivo.'), { statusCode: 400 });
  }
  if (!Number.isInteger(pageSize) || pageSize <= 0 || pageSize > 100) {
    throw Object.assign(new Error('El tamaño de página debe estar entre 1 y 100.'), { statusCode: 400 });
  }

  return {
    fechaDesde,
    fechaHasta,
    usuarioId: parsePositiveInteger(query.usuarioId, 'El usuario', 2147483647),
    modulo,
    accion,
    entidad,
    registroId: parsePositiveInteger(query.registroId, 'El identificador', 2147483647),
    busqueda,
    page,
    pageSize,
  };
}

export async function getAuditEvents(req, res) {
  try {
    const filters = normalizeFilters(req.query);
    const data = await auditoriaModel.listAuditEvents(filters);
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error consultando auditoría de costos:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'No se pudo consultar la auditoría.',
    });
  }
}

export async function getAuditEvent(req, res) {
  try {
    const id = parsePositiveInteger(req.params.id, 'El identificador del evento');
    const event = await auditoriaModel.getAuditEvent(id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'El evento de auditoría no existe.' });
    }
    return res.json({ success: true, data: event });
  } catch (error) {
    console.error('Error consultando detalle de auditoría:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'No se pudo consultar el detalle de auditoría.',
    });
  }
}
