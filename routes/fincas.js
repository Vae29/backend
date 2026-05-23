import { Router } from 'express';
import { getFincas, createFinca, updateFinca, deleteFinca } from '../controllers/fincaController.js';

const router = Router();

router.get('/', getFincas);
router.post('/', createFinca);
router.put('/:id', updateFinca);
router.delete('/:id', deleteFinca);

export default router;
