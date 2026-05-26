import express from 'express';
import { getFincas, getCultivosEnProceso } from '../controllers/asignaciones-usuarioController.js';

const router = express.Router();

router.get('/fincas', getFincas);
router.get('/cultivos-en-proceso', getCultivosEnProceso);

export default router;
