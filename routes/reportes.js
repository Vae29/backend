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

const router = Router();

router.get('/filters', getReportFilters);
router.post('/query', postReportQuery);
router.post('/por-cultivo', postReportPorCultivo);
router.post('/costos', postReportCostos);
router.post('/produccion', postReportProduccion);
router.post('/rentabilidad', postReportRentabilidad);
router.post('/trabajador', postReportTrabajador);

export default router;
