import express from 'express';
import { login, getAllUsers, createUserController, updateUserController, deleteUserController, changeUserStateController, requestPasswordReset, verifyResetCode, recoverPassword, refreshToken, logout, obtenerMisSesiones } from '../controllers/authController.js';
import { verificarAccessToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.get('/sesiones', verificarAccessToken, obtenerMisSesiones);
router.post('/request-reset', requestPasswordReset);
router.post('/verify-reset-code', verifyResetCode);
router.post('/recover-password', recoverPassword);
router.get('/users', getAllUsers);
router.post('/users', createUserController);
router.put('/users/:id', updateUserController);
router.delete('/users/:id', deleteUserController);
router.patch('/users/:id/state', verificarAccessToken, changeUserStateController);

export default router;
