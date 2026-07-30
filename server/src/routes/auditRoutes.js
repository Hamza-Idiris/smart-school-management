import { Router } from 'express';
import { listAuditLogs } from '../controllers/auditController.js';
import { authenticate, authorize, requirePasswordChanged } from '../middleware/auth.js';

const router = Router();

router.use(authenticate, requirePasswordChanged, authorize('super_admin'));
router.get('/', listAuditLogs);

export default router;
