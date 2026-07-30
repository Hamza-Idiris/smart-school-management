import { Router } from 'express';
import {
  listAssignments,
  createAssignment,
  deleteAssignment,
  assignmentValidators,
} from '../controllers/assignmentController.js';
import { authenticate, authorize, requirePasswordChanged } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.use(authenticate, requirePasswordChanged);

router.get('/', authorize('super_admin', 'teacher'), listAssignments);
router.post('/', authorize('super_admin'), assignmentValidators, validate, createAssignment);
router.delete('/:id', authorize('super_admin'), deleteAssignment);

export default router;
