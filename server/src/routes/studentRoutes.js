import { Router } from 'express';
import { body } from 'express-validator';
import {
  listStudents,
  getStudent,
  createStudent,
  updateStudent,
  getMyStudentProfile,
  studentValidators,
} from '../controllers/studentController.js';
import { authenticate, authorize, requirePasswordChanged } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.use(authenticate, requirePasswordChanged);

router.get('/me', authorize('student'), getMyStudentProfile);
router.get('/', authorize('super_admin', 'staff', 'teacher', 'cashier'), listStudents);
router.get('/:id', authorize('super_admin', 'staff', 'teacher', 'cashier', 'student'), getStudent);
router.post('/', authorize('super_admin'), studentValidators, validate, createStudent);
router.patch(
  '/:id',
  authorize('super_admin'),
  body('fullName').optional().trim().notEmpty(),
  body('feeTag').optional().isIn(['standard', 'scholarship', 'discounted']),
  validate,
  updateStudent
);

export default router;
