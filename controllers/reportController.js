import * as reportModel from '../models/reportModel.js';
import { registrarAuditoria, contextoAuditoria } from '../models/auditoriaModel.js';

async function auditarReporte(req, reportType, filters, data) {
  await registrarAuditoria(contextoAuditoria(req, {
    modulo: 'Reportes',
    accion: 'EXPORTAR_REPORTE',
    descripcion: `Reporte ${reportType} generado`,
    metadatos: { reportType, filters, cantidadResultados: Array.isArray(data) ? data.length : 0 },
  }));
}

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

export async function postAuditReportExport(req, res) {
  const { reportType, formato, filtros } = req.body || {};
  if (!reportType || !['PDF', 'EXCEL'].includes(String(formato).toUpperCase())) {
    return res.status(400).json({ success: false, error: 'reportType y formato válido son requeridos' });
  }

  await registrarAuditoria(contextoAuditoria(req, {
    modulo: 'Reportes',
    accion: 'EXPORTAR_REPORTE',
    descripcion: `Reporte ${reportType} exportado a ${String(formato).toUpperCase()}`,
    metadatos: { reportType, formato: String(formato).toUpperCase(), filtros },
  }));
  return res.json({ success: true });
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

    await auditarReporte(req, reportType, filters, data);

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
    await auditarReporte(req, 'por-cultivo', filters, data);
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
    await auditarReporte(req, 'costos', filters, data);
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
    await auditarReporte(req, 'produccion', filters, data);
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
    await auditarReporte(req, 'rentabilidad', filters, data);
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
    await auditarReporte(req, 'trabajador', filters, data);
    return sendReportResponse(res, data);
  } catch (error) {
    console.error('Error en postReportTrabajador', error);
    return res.status(500).json({ success: false, error: 'Error ejecutando reporte por trabajador' });
  }
}
