import { Router } from 'express';
import { verificarAccessToken, verificarAdmin } from '../middleware/auth.js';
import { getAuditEvent, getAuditEvents } from '../controllers/auditoriaController.js';

const router = Router();

router.use(verificarAccessToken, verificarAdmin);
router.get('/', getAuditEvents);
router.get('/:id', getAuditEvent);

export default router;
