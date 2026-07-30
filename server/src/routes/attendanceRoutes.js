import { Router } from 'express';
import { body } from 'express-validator';
import {
  getRoster,
  submitSession,
  excuseAbsence,
  listUnexcused,
  getMyAttendance,
  submitValidators,
} from '../controllers/attendanceController.js';
import { authenticate, authorize, requirePasswordChanged } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.use(authenticate, requirePasswordChanged);

router.get('/me', authorize('student'), getMyAttendance);
router.get('/roster', authorize('super_admin', 'staff'), getRoster);
router.get('/unexcused', authorize('super_admin'), listUnexcused);
router.post(
  '/sessions',
  authorize('super_admin', 'staff'),
  submitValidators,
  validate,
  submitSession
);
router.patch(
  '/sessions/:id/excuse/:studentId',
  authorize('super_admin'),
  body('note').trim().notEmpty(),
  validate,
  excuseAbsence
);

export default router;
