import * as reportModel from '../models/reportModel.js';
import { getReportModelContext } from '../models/reportExportModel.js';

// Controlador para devolver opciones de filtros dinámicos
export async function getReportFilters(req, res) {
  try {
    const fincaId = req.query.fincaId ? Number(req.query.fincaId) : null;
    const filters = await reportModel.getFilters(fincaId);
    return res.json({ success: true, data: filters });
  } catch (error) {
    console.error('Error en getReportFilters:', { error: error.stack || error });
    return res.status(500).json({ success: false, message: 'Error obteniendo filtros' });
  }
}

function sendReportResponse(res, data, metadata = {}) {
  if (!Array.isArray(data) || data.length === 0) {
    return res.json({
      success: true,
      data: [],
      message: 'Sin resultados para los filtros seleccionados',
      ...metadata,
    });
  }
  return res.json({ success: true, data, ...metadata });
}

export async function postReportQuery(req, res) {
  try {
    const { reportType, filters } = req.body || {};
    if (!reportType) {
      return res.status(400).json({ success: false, message: 'reportType es requerido' });
    }

    if (reportType === 'costos') {
      const reportFilters = filters || {};
      const context = reportFilters.fincaId
        ? await getReportModelContext(reportFilters.fincaId, req.user?.id || null)
        : {};
      const model = await reportModel.buildReportModel('costos', reportFilters, context);
      return res.json({
        success: true,
        data: model.rows,
        model,
        ...(model.rows.length ? {} : { message: 'Sin resultados para los filtros seleccionados' }),
      });
    }

    let data = [];
    switch (reportType) {
      case 'por-cultivo':
        data = await reportModel.reportByCultivo(filters);
        break;
      case 'costos':
        data = await reportModel.reportCostos(filters);
        break;
      case 'produccion':
        data = await reportModel.reportProduccion(filters);
        break;
      case 'rentabilidad':
        data = await reportModel.reportRentabilidad(filters);
        break;
      case 'trabajador':
        data = await reportModel.reportByTrabajador(filters);
        break;
      default:
        return res.status(400).json({ success: false, message: 'reportType desconocido' });
    }

    const metadata = reportType === 'trabajador'
      ? { fuente: data[0]?.fuente || await reportModel.getWorkerReportSource() }
      : {};
    return sendReportResponse(res, data, metadata);
  } catch (error) {
    console.error('Error en postReportQuery:', { body: req.body, error: error.stack || error });
    return res.status(500).json({ success: false, message: 'Error ejecutando reporte' });
  }
}

export async function postReportPorCultivo(req, res) {
  try {
    const filters = req.body || {};
    const data = await reportModel.reportByCultivo(filters);
    return sendReportResponse(res, data);
  } catch (error) {
    console.error('Error en postReportPorCultivo:', { body: req.body, error: error.stack || error });
    return res.status(500).json({ success: false, message: 'Error ejecutando reporte por cultivo' });
  }
}

export async function postReportCostos(req, res) {
  try {
    const filters = req.body || {};
    const context = filters.fincaId
      ? await getReportModelContext(filters.fincaId, req.user?.id || null)
      : {};
    const model = await reportModel.buildReportModel('costos', filters, context);
    return res.json({
      success: true,
      data: model.rows,
      model,
      ...(model.rows.length ? {} : { message: 'Sin resultados para los filtros seleccionados' }),
    });
  } catch (error) {
    console.error('Error en postReportCostos:', { body: req.body, error: error.stack || error });
    return res.status(500).json({ success: false, message: 'Error ejecutando reporte de costos' });
  }
}

export async function postReportProduccion(req, res) {
  try {
    const filters = req.body || {};
    const data = await reportModel.reportProduccion(filters);
    return sendReportResponse(res, data);
  } catch (error) {
    console.error('Error en postReportProduccion:', { body: req.body, error: error.stack || error });
    return res.status(500).json({ success: false, message: 'Error ejecutando reporte de producción' });
  }
}

export async function postReportRentabilidad(req, res) {
  try {
    const filters = req.body || {};
    const data = await reportModel.reportRentabilidad(filters);
    return sendReportResponse(res, data);
  } catch (error) {
    console.error('Error en postReportRentabilidad:', { body: req.body, error: error.stack || error });
    return res.status(500).json({ success: false, message: 'Error ejecutando reporte de rentabilidad' });
  }
}

export async function postReportTrabajador(req, res) {
  try {
    const filters = req.body || {};
    const data = await reportModel.reportByTrabajador(filters);
    const fuente = data[0]?.fuente || await reportModel.getWorkerReportSource();
    return sendReportResponse(res, data, { fuente });
  } catch (error) {
    console.error('Error en postReportTrabajador:', { body: req.body, error: error.stack || error });
    return res.status(500).json({ success: false, message: 'Error ejecutando reporte por trabajador' });
  }
}
