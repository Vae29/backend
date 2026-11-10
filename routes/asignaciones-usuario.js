import express from 'express';
import { getFincas, getCultivosEnProceso, getCultivosPorFinca, getCultivoDetalle, getCategoriasCosto, getSubcategoriasPorCategoria, getEstadosPago, getEtapaEnProcesoPorCultivo, getEtapasPorCultivo, validateCultivoForCost, getTiposCultivo, getEstados, postCultivo, postCosto, putCosto, deleteCosto, putCultivo, deleteCultivo, changeCultivoStateController, changeCostoStateController, changeEtapaStateController, changeCosechaStateController, getEtapasCatalog, postEtapaPorCultivo, putEtapaPorCultivo, deleteEtapaPorCultivo, getFincasPorUsuario, getCultivosPorUsuario, getCosechasPorCultivo, getUnidadesMedida, getTiposPrecio, postCosecha, putCosecha, deleteCosecha, getCostosPorFinca } from '../controllers/asignaciones-usuarioController.js';
import { verificarAccessToken, verificarWorker } from '../middleware/auth.js'
import { auditContext } from '../middleware/auditContext.js'

const router = express.Router();

function preventUserAssignmentCaching(req, res, next) {
  res.set('Cache-Control', 'no-store')
  delete req.headers['if-none-match']
  delete req.headers['if-modified-since']
  next()
}

router.get('/fincas', getFincas);
router.get('/cultivos-en-proceso', getCultivosEnProceso);
router.get('/cultivos/finca/:fincaId', getCultivosPorFinca);
router.get('/cultivos/:id/detalle', getCultivoDetalle);
router.get('/categorias-costo', getCategoriasCosto);
router.get('/subcategorias-costo/:categoriaId', getSubcategoriasPorCategoria);
router.get('/estados-pago', getEstadosPago);
router.get('/cultivos/:cultivoId/etapa-en-proceso', getEtapaEnProcesoPorCultivo);
router.get('/etapas', getEtapasCatalog);
router.post('/cultivos/:cultivoId/etapas', verificarAccessToken, auditContext('CULTIVOS'), postEtapaPorCultivo);
router.put('/cultivos/etapas/:id', verificarAccessToken, auditContext('CULTIVOS'), putEtapaPorCultivo);
router.get('/cultivos/:cultivoId/validate-for-cost', validateCultivoForCost);
router.get('/cultivos/:cultivoId/cosechas', getCosechasPorCultivo);
router.post('/cultivos/:cultivoId/cosechas', verificarAccessToken, auditContext('COSECHAS'), postCosecha);
router.put('/cosechas/:id', verificarAccessToken, auditContext('COSECHAS'), putCosecha);
router.delete('/cosechas/:id', verificarAccessToken, auditContext('COSECHAS'), deleteCosecha);
router.get('/unidades-medida', getUnidadesMedida);
router.get('/tipos-precio', getTiposPrecio);
router.get('/cultivos/:cultivoId/etapas', getEtapasPorCultivo);
router.get('/tipos-cultivo', getTiposCultivo);
router.get('/estados', getEstados);
router.get('/usuario/me/fincas', preventUserAssignmentCaching, verificarAccessToken, verificarWorker, getFincasPorUsuario);
router.get('/usuario/me/cultivos', preventUserAssignmentCaching, verificarAccessToken, verificarWorker, getCultivosPorUsuario);
router.get('/costos/finca/:fincaId', verificarAccessToken, getCostosPorFinca);
router.post('/cultivos', verificarAccessToken, auditContext('CULTIVOS'), postCultivo);
router.post('/costos', verificarAccessToken, auditContext('COSTOS'), postCosto);
router.put('/costos/:id', verificarAccessToken, auditContext('COSTOS'), putCosto);
router.patch('/costos/:id/state', verificarAccessToken, auditContext('COSTOS'), changeCostoStateController);
router.put('/cultivos/:id', verificarAccessToken, auditContext('CULTIVOS'), putCultivo);
router.patch('/cultivos/:id/state', verificarAccessToken, auditContext('CULTIVOS'), changeCultivoStateController);
router.patch('/cultivos/etapas/:id/state', verificarAccessToken, auditContext('CULTIVOS'), changeEtapaStateController);
router.patch('/cosechas/:id/state', verificarAccessToken, auditContext('COSECHAS'), changeCosechaStateController);
router.delete('/costos/:id', verificarAccessToken, auditContext('COSTOS'), deleteCosto);
router.delete('/cultivos/:id', verificarAccessToken, auditContext('CULTIVOS'), deleteCultivo);
router.delete('/cultivos/etapas/:etapaCultivoId', verificarAccessToken, auditContext('CULTIVOS'), deleteEtapaPorCultivo);

export default router;
