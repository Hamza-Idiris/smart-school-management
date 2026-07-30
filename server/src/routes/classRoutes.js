import { Router } from 'express';
import { body } from 'express-validator';
import {
  listClasses,
  createClass,
  updateClass,
  classValidators,
} from '../controllers/classController.js';
import { authenticate, authorize, requirePasswordChanged } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.use(authenticate, requirePasswordChanged);

router.get('/', authorize('super_admin', 'staff', 'teacher', 'cashier'), listClasses);
router.post('/', authorize('super_admin'), classValidators, validate, createClass);
router.patch(
  '/:id',
  authorize('super_admin'),
  body('name').optional().trim().notEmpty(),
  validate,
  updateClass
);

export default router;
