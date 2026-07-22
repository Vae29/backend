import express from 'express';
import { login, getAllUsers, createUserController, updateUserController, deleteUserController, changeUserStateController, requestPasswordReset, verifyResetCode, recoverPassword, refreshToken, logout, obtenerMisSesiones } from '../controllers/authController.js';
import { verificarAccessToken, verificarAdmin } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.get('/sesiones', verificarAccessToken, obtenerMisSesiones);
router.post('/request-reset', requestPasswordReset);
router.post('/verify-reset-code', verifyResetCode);
router.post('/recover-password', recoverPassword);
router.get('/users', verificarAccessToken, verificarAdmin, getAllUsers);
router.post('/users', verificarAccessToken, verificarAdmin, createUserController);
router.put('/users/:id', verificarAccessToken, verificarAdmin, updateUserController);
router.delete('/users/:id', verificarAccessToken, verificarAdmin, deleteUserController);
router.patch('/users/:id/state', verificarAccessToken, verificarAdmin, changeUserStateController);

export default router;
