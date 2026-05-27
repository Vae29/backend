import * as reportModel from '../models/reportModel.js';

// Controlador para devolver opciones de filtros dinámicos
export async function getReportFilters(req, res) {
  try {
    const fincaId = req.query.fincaId ? Number(req.query.fincaId) : null;
    const filters = await reportModel.getFilters(fincaId);
    return res.json({ success: true, data: filters });
  } catch (error) {
    console.error('Error en getReportFilters', error);
    return res.status(500).json({ success: false, error: 'Error obteniendo filtros' });
  }
}

function sendReportResponse(res, data) {
  if (!Array.isArray(data) || data.length === 0) {
    return res.json({ success: true, data: [], message: 'Sin resultados para los filtros seleccionados' });
  }
  return res.json({ success: true, data });
}

export async function postReportQuery(req, res) {
  try {
    const { reportType, filters } = req.body || {};
    if (!reportType) {
      return res.status(400).json({ success: false, error: 'reportType es requerido' });
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
        return res.status(400).json({ success: false, error: 'reportType desconocido' });
    }

    return sendReportResponse(res, data);
  } catch (error) {
    console.error('Error en postReportQuery', error);
    return res.status(500).json({ success: false, error: 'Error ejecutando reporte' });
  }
}

export async function postReportPorCultivo(req, res) {
  try {
    const filters = req.body || {};
    const data = await reportModel.reportByCultivo(filters);
    return sendReportResponse(res, data);
  } catch (error) {
    console.error('Error en postReportPorCultivo', error);
    return res.status(500).json({ success: false, error: 'Error ejecutando reporte por cultivo' });
  }
}

export async function postReportCostos(req, res) {
  try {
    const filters = req.body || {};
    const data = await reportModel.reportCostos(filters);
    return sendReportResponse(res, data);
  } catch (error) {
    console.error('Error en postReportCostos', error);
    return res.status(500).json({ success: false, error: 'Error ejecutando reporte de costos' });
  }
}

export async function postReportProduccion(req, res) {
  try {
    const filters = req.body || {};
    const data = await reportModel.reportProduccion(filters);
    return sendReportResponse(res, data);
  } catch (error) {
    console.error('Error en postReportProduccion', error);
    return res.status(500).json({ success: false, error: 'Error ejecutando reporte de producción' });
  }
}

export async function postReportRentabilidad(req, res) {
  try {
    const filters = req.body || {};
    const data = await reportModel.reportRentabilidad(filters);
    return sendReportResponse(res, data);
  } catch (error) {
    console.error('Error en postReportRentabilidad', error);
    return res.status(500).json({ success: false, error: 'Error ejecutando reporte de rentabilidad' });
  }
}

export async function postReportTrabajador(req, res) {
  try {
    const filters = req.body || {};
    const data = await reportModel.reportByTrabajador(filters);
    return sendReportResponse(res, data);
  } catch (error) {
    console.error('Error en postReportTrabajador', error);
    return res.status(500).json({ success: false, error: 'Error ejecutando reporte por trabajador' });
  }
}
