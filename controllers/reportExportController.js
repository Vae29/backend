import * as reportExportModel from '../models/reportExportModel.js';
import { buildReportModel, fetchReportData } from '../models/reportModel.js';
import { generateReportExport } from '../services/reportExportService.js';

const reportTypes = new Set(['por-cultivo', 'costos', 'produccion', 'rentabilidad', 'trabajador']);
const formats = new Set(['xlsx', 'csv', 'pdf']);
const filterKeys = [
  'fincaId',
  'cultivoId',
  'categoriaId',
  'subcategoriaId',
  'usuarioId',
  'estadoId',
  'tipoCultivoId',
  'etapaId',
  'fechaInicio',
  'fechaFin',
];
const idKeys = [
  'fincaId',
  'cultivoId',
  'categoriaId',
  'subcategoriaId',
  'usuarioId',
  'estadoId',
  'tipoCultivoId',
  'etapaId',
];

function isValidISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeExportFilters(rawFilters) {
  if (!rawFilters || typeof rawFilters !== 'object' || Array.isArray(rawFilters)) {
    throw Object.assign(new Error('Los filtros deben enviarse como un objeto.'), { statusCode: 400 });
  }
  if (Object.keys(rawFilters).some((key) => !filterKeys.includes(key))) {
    throw Object.assign(new Error('Se recibió un filtro de reporte desconocido.'), { statusCode: 400 });
  }
  const filters = Object.fromEntries(filterKeys.map((key) => [key, rawFilters[key] ?? null]));
  for (const key of idKeys) {
    const value = filters[key];
    if (value == null || value === '') {
      filters[key] = null;
      continue;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw Object.assign(new Error(`El filtro ${key} debe ser un entero positivo.`), { statusCode: 400 });
    }
    filters[key] = parsed;
  }
  for (const key of ['fechaInicio', 'fechaFin']) {
    const value = filters[key];
    if (value == null || value === '') {
      filters[key] = null;
      continue;
    }
    if (!isValidISODate(value)) {
      throw Object.assign(new Error(`El filtro ${key} debe ser una fecha válida en formato AAAA-MM-DD.`), {
        statusCode: 400,
      });
    }
  }
  if (
    filters.fechaInicio &&
    filters.fechaFin &&
    filters.fechaInicio > filters.fechaFin
  ) {
    throw Object.assign(new Error('La fecha inicial no puede ser posterior a la fecha final.'), {
      statusCode: 400,
    });
  }
  if (!filters.fincaId) {
    throw Object.assign(new Error('Selecciona una finca para exportar el reporte.'), { statusCode: 400 });
  }
  return filters;
}

export async function postReportExport(req, res) {
  try {
    const { tipo, formato } = req.body || {};
    if (!reportTypes.has(tipo)) {
      return res.status(400).json({ success: false, message: 'Tipo de reporte inválido.' });
    }
    if (!formats.has(formato)) {
      return res.status(400).json({ success: false, message: 'Formato de exportación inválido.' });
    }
    const userId = Number(req.user?.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado.' });
    }

    const filtros = normalizeExportFilters(req.body?.filtros);
    const context = await reportExportModel.getReportExportContext(userId, filtros.fincaId);
    let report;
    if (tipo === 'costos' && ['xlsx', 'pdf'].includes(formato)) {
      const model = await buildReportModel(tipo, filtros, context);
      const traceId = await reportExportModel.recordReportExport({
        userId,
        fincaId: filtros.fincaId,
        reportType: tipo,
        format: formato,
        filters: filtros,
        rowCount: model.totals.registroCount,
      });
      model.meta.traceId = traceId;
      report = await generateReportExport({
        reportType: tipo,
        format: formato,
        rows: model.rows,
        filters: filtros,
        context,
        model,
      });
    } else {
      const rows = await fetchReportData(tipo, filtros);
      report = await generateReportExport({
        reportType: tipo,
        format: formato,
        rows,
        filters: filtros,
        context,
      });
      await reportExportModel.recordReportExport({
        userId,
        fincaId: filtros.fincaId,
        reportType: tipo,
        format: formato,
        filters: filtros,
        rowCount: report.rowCount,
      });
    }

    const filename = `reporte-${tipo}-${new Date().toISOString().slice(0, 10)}.${report.extension}`;
    res.setHeader('Content-Type', report.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', report.buffer.length);
    res.setHeader('X-Export-Rows', String(report.rowCount));
    return res.status(200).send(report.buffer);
  } catch (error) {
    console.error('Error en postReportExport:', error.stack || error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'No se pudo generar la exportación del reporte.',
    });
  }
}
