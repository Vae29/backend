import { Router } from 'express';
import { getFincas, createFinca, updateFinca, deleteFinca, changeFincaState } from '../controllers/fincaController.js';
import { verificarAccessToken } from '../middleware/auth.js';
import { auditContext } from '../middleware/auditContext.js';

console.log('fincas routes loaded');

const router = Router();

router.get('/', getFincas);
router.post('/', verificarAccessToken, auditContext('FINCAS'), createFinca);
router.put('/:id', verificarAccessToken, auditContext('FINCAS'), updateFinca);
router.delete('/:id', verificarAccessToken, auditContext('FINCAS'), deleteFinca);
router.patch('/:id/state', verificarAccessToken, auditContext('FINCAS'), changeFincaState);

export default router;
