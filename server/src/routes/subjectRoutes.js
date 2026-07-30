import { Router } from 'express';
import { body } from 'express-validator';
import {
  listSubjects,
  createSubject,
  updateSubject,
  subjectValidators,
} from '../controllers/subjectController.js';
import { authenticate, authorize, requirePasswordChanged } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.use(authenticate, requirePasswordChanged);

router.get('/', authorize('super_admin', 'staff', 'teacher'), listSubjects);
router.post('/', authorize('super_admin'), subjectValidators, validate, createSubject);
router.patch(
  '/:id',
  authorize('super_admin'),
  body('name').optional().trim().notEmpty(),
  validate,
  updateSubject
);

export default router;
