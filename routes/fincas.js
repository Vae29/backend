import { Router } from 'express';
import { getFincas, createFinca, updateFinca, deleteFinca, changeFincaState } from '../controllers/fincaController.js';
import { verificarAccessToken } from '../middleware/auth.js';

console.log('fincas routes loaded');

const router = Router();

router.get('/', getFincas);
router.post('/', createFinca);
router.put('/:id', updateFinca);
router.delete('/:id', deleteFinca);
router.patch('/:id/state', verificarAccessToken, changeFincaState);

export default router;
