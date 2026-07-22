import { Router } from 'express';
import {
  getReportFilters,
  postAuditReportExport,
  postReportQuery,
  postReportPorCultivo,
  postReportCostos,
  postReportProduccion,
  postReportRentabilidad,
  postReportTrabajador,
} from '../controllers/reportController.js';
import { verificarAccessToken } from '../middleware/auth.js';

const router = Router();

router.get('/filters', getReportFilters);
router.post('/audit-export', verificarAccessToken, postAuditReportExport);
router.post('/query', verificarAccessToken, postReportQuery);
router.post('/por-cultivo', verificarAccessToken, postReportPorCultivo);
router.post('/costos', verificarAccessToken, postReportCostos);
router.post('/produccion', verificarAccessToken, postReportProduccion);
router.post('/rentabilidad', verificarAccessToken, postReportRentabilidad);
router.post('/trabajador', verificarAccessToken, postReportTrabajador);

export default router;
