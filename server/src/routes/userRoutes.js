import { Router } from 'express';
import {
  listUsers,
  createUser,
  updateUserStatus,
  resetUserPassword,
  createUserValidators,
} from '../controllers/userController.js';
import { authenticate, authorize, requirePasswordChanged } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { body } from 'express-validator';

const router = Router();

router.use(authenticate, requirePasswordChanged, authorize('super_admin'));

router.get('/', listUsers);
router.post('/', createUserValidators, validate, createUser);
router.patch(
  '/:id/status',
  body('status').isIn(['active', 'deactivated']),
  validate,
  updateUserStatus
);
router.post('/:id/reset-password', resetUserPassword);

export default router;
