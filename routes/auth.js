import express from 'express';
import { login, getAllUsers, createUserController, updateUserController, deleteUserController, changeUserStateController, requestPasswordReset, verifyResetCode, recoverPassword, refreshToken, logout, obtenerMisSesiones } from '../controllers/authController.js';
import { verificarAccessToken } from '../middleware/auth.js';
import { auditContext } from '../middleware/auditContext.js';

const router = express.Router();

router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.get('/sesiones', verificarAccessToken, obtenerMisSesiones);
router.post('/request-reset', requestPasswordReset);
router.post('/verify-reset-code', verifyResetCode);
router.post('/recover-password', recoverPassword);
router.get('/users', getAllUsers);
router.post('/users', verificarAccessToken, auditContext('USUARIOS'), createUserController);
router.put('/users/:id', verificarAccessToken, auditContext('USUARIOS'), updateUserController);
router.delete('/users/:id', verificarAccessToken, auditContext('USUARIOS'), deleteUserController);
router.patch('/users/:id/state', verificarAccessToken, auditContext('USUARIOS'), changeUserStateController);

export default router;
