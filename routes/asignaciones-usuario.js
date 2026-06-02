import express from 'express';
import { getFincas, getCultivosEnProceso, getCultivosPorFinca, getCultivoDetalle, getCategoriasCosto, getSubcategoriasPorCategoria, getEstadosPago, getEtapaEnProcesoPorCultivo, getEtapasPorCultivo, validateCultivoForCost, getTiposCultivo, getEstados, postCultivo, postCosto, putCosto, deleteCosto, putCultivo, deleteCultivo, getEtapasCatalog, postEtapaPorCultivo, putEtapaPorCultivo, deleteEtapaPorCultivo, getFincasPorUsuario, getCultivosPorUsuario, getCosechasPorCultivo, getUnidadesMedida, getTiposPrecio, postCosecha, putCosecha, deleteCosecha, getCostosPorFinca } from '../controllers/asignaciones-usuarioController.js';
import { verificarAccessToken, verificarWorker } from '../middleware/auth.js'

const router = express.Router();

router.get('/fincas', getFincas);
router.get('/cultivos-en-proceso', getCultivosEnProceso);
router.get('/cultivos/finca/:fincaId', getCultivosPorFinca);
router.get('/cultivos/:id/detalle', getCultivoDetalle);
router.get('/categorias-costo', getCategoriasCosto);
router.get('/subcategorias-costo/:categoriaId', getSubcategoriasPorCategoria);
router.get('/estados-pago', getEstadosPago);
router.get('/cultivos/:cultivoId/etapa-en-proceso', getEtapaEnProcesoPorCultivo);
router.get('/etapas', getEtapasCatalog);
router.post('/cultivos/:cultivoId/etapas', postEtapaPorCultivo);
router.put('/cultivos/etapas/:id', putEtapaPorCultivo);
router.get('/cultivos/:cultivoId/validate-for-cost', validateCultivoForCost);
router.get('/cultivos/:cultivoId/cosechas', getCosechasPorCultivo);
router.post('/cultivos/:cultivoId/cosechas', postCosecha);
router.put('/cosechas/:id', putCosecha);
router.delete('/cosechas/:id', deleteCosecha);
router.get('/unidades-medida', getUnidadesMedida);
router.get('/tipos-precio', getTiposPrecio);
router.get('/cultivos/:cultivoId/etapas', getEtapasPorCultivo);
router.get('/tipos-cultivo', getTiposCultivo);
router.get('/estados', getEstados);
router.get('/usuario/me/fincas', verificarAccessToken, verificarWorker, getFincasPorUsuario);
router.get('/usuario/me/cultivos', verificarAccessToken, verificarWorker, getCultivosPorUsuario);
router.get('/costos/finca/:fincaId', verificarAccessToken, getCostosPorFinca);
router.post('/cultivos', postCultivo);
router.post('/costos', verificarAccessToken, postCosto);
router.put('/costos/:id', verificarAccessToken, putCosto);
router.delete('/costos/:id', verificarAccessToken, deleteCosto);
router.put('/cultivos/:id', putCultivo);
router.delete('/cultivos/:id', deleteCultivo);
router.delete('/cultivos/etapas/:etapaCultivoId', deleteEtapaPorCultivo);

export default router;
