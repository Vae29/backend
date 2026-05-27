import express from 'express';
import { getFincas, getCultivosEnProceso, getCultivosPorFinca } from '../controllers/asignaciones-usuarioController.js';

const router = express.Router();

router.get('/fincas', getFincas);
router.get('/cultivos-en-proceso', getCultivosEnProceso);
router.get('/cultivos/finca/:fincaId', getCultivosPorFinca);

export default router;
