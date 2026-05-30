import express from 'express';
import { getFincas, getCultivosEnProceso, getCultivosPorFinca, getTiposCultivo, getEstados, postCultivo, putCultivo, deleteCultivo } from '../controllers/asignaciones-usuarioController.js';

const router = express.Router();

router.get('/fincas', getFincas);
router.get('/cultivos-en-proceso', getCultivosEnProceso);
router.get('/cultivos/finca/:fincaId', getCultivosPorFinca);
router.get('/tipos-cultivo', getTiposCultivo);
router.get('/estados', getEstados);
router.post('/cultivos', postCultivo);
router.put('/cultivos/:id', putCultivo);
router.delete('/cultivos/:id', deleteCultivo);

export default router;
