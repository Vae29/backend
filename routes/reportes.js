import { Router } from 'express';
import {
  getReportFilters,
  postReportQuery,
  postReportPorCultivo,
  postReportCostos,
  postReportProduccion,
  postReportRentabilidad,
  postReportTrabajador,
} from '../controllers/reportController.js';
import { postReportExport } from '../controllers/reportExportController.js';
import { verificarAccessToken, verificarAdmin } from '../middleware/auth.js';
import { auditContext } from '../middleware/auditContext.js';

const router = Router();

router.get('/filters', getReportFilters);
router.post('/query', postReportQuery);
router.post('/por-cultivo', postReportPorCultivo);
router.post('/costos', postReportCostos);
router.post('/produccion', postReportProduccion);
router.post('/rentabilidad', postReportRentabilidad);
router.post('/trabajador', postReportTrabajador);
router.get('/export', (req, res) => {
  res.setHeader('Allow', 'POST');
  return res.status(405).json({
    success: false,
    message: 'La exportación requiere POST con tipo, formato y filtros.',
  });
});
router.post('/export', verificarAccessToken, verificarAdmin, auditContext('REPORTES'), postReportExport);

export default router;
