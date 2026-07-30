import { Router } from 'express';
import {
  listReportCatalog,
  exportAttendance,
  exportTeacherPunctuality,
  exportAcademic,
  exportFinance,
  exportAudit,
} from '../controllers/reportController.js';
import { authenticate, authorize, requirePasswordChanged } from '../middleware/auth.js';

const router = Router();

router.use(authenticate, requirePasswordChanged);

router.get('/', authorize('super_admin', 'cashier'), listReportCatalog);
router.get('/attendance', authorize('super_admin', 'staff'), exportAttendance);
router.get('/punctuality', authorize('super_admin'), exportTeacherPunctuality);
router.get('/academic', authorize('super_admin'), exportAcademic);
router.get('/finance', authorize('super_admin', 'cashier'), exportFinance);
router.get('/audit', authorize('super_admin'), exportAudit);

export default router;
