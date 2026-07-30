import { Router } from 'express';
import {
  clockIn,
  myCheckInToday,
  listCheckIns,
  teacherPunctualitySummary,
} from '../controllers/checkInController.js';
import { authenticate, authorize, requirePasswordChanged } from '../middleware/auth.js';

const router = Router();

router.use(authenticate, requirePasswordChanged);

router.post('/clock-in', authorize('teacher'), clockIn);
router.get('/me/today', authorize('teacher'), myCheckInToday);
router.get('/', authorize('super_admin'), listCheckIns);
router.get('/summary', authorize('super_admin'), teacherPunctualitySummary);

export default router;
