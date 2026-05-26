import express from 'express';
import { login, getAllUsers, createUserController, updateUserController, deleteUserController, requestPasswordReset, verifyResetCode, recoverPassword } from '../controllers/authController.js';

const router = express.Router();

router.post('/login', login);
router.post('/request-reset', requestPasswordReset);
router.post('/verify-reset-code', verifyResetCode);
router.post('/recover-password', recoverPassword);
router.get('/users', getAllUsers);
router.post('/users', createUserController);
router.put('/users/:id', updateUserController);
router.delete('/users/:id', deleteUserController);

export default router;
