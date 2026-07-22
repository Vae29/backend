import express from 'express';
import { getFincas, getCultivosEnProceso, getCultivosPorFinca, getCultivoDetalle, getCategoriasCosto, getSubcategoriasPorCategoria, getEstadosPago, getEtapaEnProcesoPorCultivo, getEtapasPorCultivo, validateCultivoForCost, getTiposCultivo, getEstados, postCultivo, postCosto, putCosto, deleteCosto, putCultivo, deleteCultivo, changeCultivoStateController, changeCostoStateController, changeEtapaStateController, changeCosechaStateController, getEtapasCatalog, postEtapaPorCultivo, putEtapaPorCultivo, deleteEtapaPorCultivo, getFincasPorUsuario, getCultivosPorUsuario, getCosechasPorCultivo, getUnidadesMedida, getTiposPrecio, postCosecha, putCosecha, deleteCosecha, getCostosPorFinca } from '../controllers/asignaciones-usuarioController.js';
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
router.post('/cultivos/:cultivoId/etapas', verificarAccessToken, postEtapaPorCultivo);
router.put('/cultivos/etapas/:id', verificarAccessToken, putEtapaPorCultivo);
router.get('/cultivos/:cultivoId/validate-for-cost', validateCultivoForCost);
router.get('/cultivos/:cultivoId/cosechas', getCosechasPorCultivo);
router.post('/cultivos/:cultivoId/cosechas', verificarAccessToken, postCosecha);
router.put('/cosechas/:id', verificarAccessToken, putCosecha);
router.delete('/cosechas/:id', verificarAccessToken, deleteCosecha);
router.get('/unidades-medida', getUnidadesMedida);
router.get('/tipos-precio', getTiposPrecio);
router.get('/cultivos/:cultivoId/etapas', getEtapasPorCultivo);
router.get('/tipos-cultivo', getTiposCultivo);
router.get('/estados', getEstados);
router.get('/usuario/me/fincas', verificarAccessToken, verificarWorker, getFincasPorUsuario);
router.get('/usuario/me/cultivos', verificarAccessToken, verificarWorker, getCultivosPorUsuario);
router.get('/costos/finca/:fincaId', verificarAccessToken, getCostosPorFinca);
router.post('/cultivos', verificarAccessToken, postCultivo);
router.post('/costos', verificarAccessToken, postCosto);
router.put('/costos/:id', verificarAccessToken, putCosto);
router.patch('/costos/:id/state', verificarAccessToken, changeCostoStateController);
router.put('/cultivos/:id', verificarAccessToken, putCultivo);
router.patch('/cultivos/:id/state', verificarAccessToken, changeCultivoStateController);
router.patch('/cultivos/etapas/:id/state', verificarAccessToken, changeEtapaStateController);
router.patch('/cosechas/:id/state', verificarAccessToken, changeCosechaStateController);
router.delete('/costos/:id', verificarAccessToken, deleteCosto);
router.delete('/cultivos/:id', verificarAccessToken, deleteCultivo);
router.delete('/cultivos/etapas/:etapaCultivoId', verificarAccessToken, deleteEtapaPorCultivo);

export default router;
