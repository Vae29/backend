import { Router } from 'express';
import { getFincas, createFinca, updateFinca, deleteFinca, changeFincaState } from '../controllers/fincaController.js';
import { verificarAccessToken } from '../middleware/auth.js';

console.log('fincas routes loaded');

const router = Router();

router.get('/', getFincas);
router.post('/', verificarAccessToken, createFinca);
router.put('/:id', verificarAccessToken, updateFinca);
router.delete('/:id', verificarAccessToken, deleteFinca);
router.patch('/:id/state', verificarAccessToken, changeFincaState);

export default router;
