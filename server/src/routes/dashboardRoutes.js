import { Router } from 'express';
import { getKpis, streamKpis } from '../controllers/dashboardController.js';
import { authenticate, authorize, requirePasswordChanged } from '../middleware/auth.js';

const router = Router();

router.use(authenticate, requirePasswordChanged);

router.get('/kpis', authorize('super_admin', 'staff', 'cashier'), getKpis);
router.get('/stream', authorize('super_admin'), streamKpis);

export default router;
