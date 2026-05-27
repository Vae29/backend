import { Router } from 'express';
import { getDashboardByFinca } from '../controllers/dashboardController.js';

console.log('routes/dashboard.js loaded');

const router = Router();

router.get('/finca/:id', getDashboardByFinca);

export default router;
