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
const auditReportQuery = auditContext('REPORTES');
const authenticateIfProvided = (req, res, next) => {
  if (!req.headers.authorization) return next();
  return verificarAccessToken(req, res, next);
};
const auditIfAuthenticated = (req, res, next) => {
  if (!req.user) return next();
  return auditReportQuery(req, res, next);
};

router.get('/filters', getReportFilters);
router.post('/query', authenticateIfProvided, auditIfAuthenticated, postReportQuery);
router.post('/por-cultivo', authenticateIfProvided, auditIfAuthenticated, postReportPorCultivo);
router.post('/costos', authenticateIfProvided, auditIfAuthenticated, postReportCostos);
router.post('/produccion', authenticateIfProvided, auditIfAuthenticated, postReportProduccion);
router.post('/rentabilidad', authenticateIfProvided, auditIfAuthenticated, postReportRentabilidad);
router.post('/trabajador', authenticateIfProvided, auditIfAuthenticated, postReportTrabajador);
router.get('/export', (req, res) => {
  res.setHeader('Allow', 'POST');
  return res.status(405).json({
    success: false,
    message: 'La exportación requiere POST con tipo, formato y filtros.',
  });
});
router.post('/export', verificarAccessToken, verificarAdmin, auditContext('REPORTES'), postReportExport);

export default router;
