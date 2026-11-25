import express from 'express';
import {
  getEmailConfig,
  putEmailConfig,
  testEmailConfig,
} from '../controllers/emailConfigController.js';
import { verificarAccessToken, verificarAdmin } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = express.Router();

router.get(
  '/config-correo',
  verificarAccessToken,
  verificarAdmin,
  rateLimit({
    windowMs: 60_000,
    max: 60,
    message: 'Demasiadas consultas. Inténtalo de nuevo en un minuto.',
  }),
  getEmailConfig,
);
router.put(
  '/config-correo',
  verificarAccessToken,
  verificarAdmin,
  rateLimit({
    windowMs: 15 * 60_000,
    max: 8,
    message: 'Demasiados cambios de configuración. Inténtalo de nuevo más tarde.',
  }),
  putEmailConfig,
);
router.post(
  '/config-correo/probar',
  verificarAccessToken,
  verificarAdmin,
  rateLimit({
    windowMs: 15 * 60_000,
    max: 5,
    message: 'Se alcanzó el límite de pruebas de correo. Inténtalo de nuevo más tarde.',
  }),
  testEmailConfig,
);

export default router;
