import { Router } from 'express';
import {
  getCostingConfiguration,
  postCropType,
  postStage,
  putStage,
  patchStageState,
  putCropType,
  patchCropTypeState,
  putCropTypeStages,
  getGeneralCostAllocations,
  putGeneralCostAllocations,
  getUnitConversions,
  putUnitConversions,
  putCostSubcategoryConfig,
  getInventoryProducts,
  postInventoryConsumption,
  postLaborPayment,
  getLaborPayments,
} from '../controllers/costeoController.js';
import { verificarAccessToken, verificarAdmin } from '../middleware/auth.js';
import { auditContext } from '../middleware/auditContext.js';

const router = Router();
router.use(verificarAccessToken, verificarAdmin);

router.get('/configuracion', getCostingConfiguration);
router.post('/etapas', auditContext('COSTEO'), postStage);
router.put('/etapas/:id', auditContext('COSTEO'), putStage);
router.patch('/etapas/:id/estado', auditContext('COSTEO'), patchStageState);
router.post('/tipos-cultivo', auditContext('COSTEO'), postCropType);
router.put('/tipos-cultivo/:id', auditContext('COSTEO'), putCropType);
router.patch('/tipos-cultivo/:id/estado', auditContext('COSTEO'), patchCropTypeState);
router.put('/tipos-cultivo/:id/etapas', auditContext('COSTEO'), putCropTypeStages);
router.get('/prorrateo/:fincaId', getGeneralCostAllocations);
router.put('/prorrateo/:fincaId', auditContext('COSTEO'), putGeneralCostAllocations);
router.get('/conversiones', getUnitConversions);
router.put('/tipos-cultivo/:id/conversiones', auditContext('COSTEO'), putUnitConversions);
router.put('/subcategorias/:id/configuracion', auditContext('COSTEO'), putCostSubcategoryConfig);
router.get('/inventario/productos/:fincaId', getInventoryProducts);
router.post('/inventario/consumos', auditContext('COSTOS'), postInventoryConsumption);
router.get('/pagos-mano-obra', getLaborPayments);
router.post('/pagos-mano-obra', auditContext('COSTOS'), postLaborPayment);

export default router;
