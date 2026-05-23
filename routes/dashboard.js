import { Router } from 'express';
import { getDashboardByFinca } from '../controllers/dashboardController.js';

const router = Router();

router.get('/finca/:id', getDashboardByFinca);

export default router;
