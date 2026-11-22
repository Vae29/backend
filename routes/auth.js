import express from 'express';
import { login, getAllUsers, createUserController, updateUserController, deleteUserController, changeUserStateController, requestPasswordReset, requestUserPasswordReset, verifyResetCode, recoverPassword, refreshToken, logout, obtenerMisSesiones } from '../controllers/authController.js';
import { verificarAccessToken, verificarAdmin } from '../middleware/auth.js';
import { auditContext } from '../middleware/auditContext.js';

const router = express.Router();

router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.get('/sesiones', verificarAccessToken, obtenerMisSesiones);
router.post('/request-reset', requestPasswordReset);
router.post('/verify-reset-code', verifyResetCode);
router.post('/recover-password', recoverPassword);
router.get('/users', verificarAccessToken, verificarAdmin, getAllUsers);
router.post('/users', verificarAccessToken, verificarAdmin, auditContext('USUARIOS'), createUserController);
router.put('/users/:id', verificarAccessToken, verificarAdmin, auditContext('USUARIOS'), updateUserController);
router.delete('/users/:id', verificarAccessToken, verificarAdmin, auditContext('USUARIOS'), deleteUserController);
router.patch('/users/:id/state', verificarAccessToken, verificarAdmin, auditContext('USUARIOS'), changeUserStateController);
router.post('/users/:id/request-reset', verificarAccessToken, verificarAdmin, auditContext('USUARIOS'), requestUserPasswordReset);

export default router;
