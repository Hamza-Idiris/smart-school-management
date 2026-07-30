import { Router } from 'express';
import {
  login,
  refresh,
  logout,
  me,
  changePassword,
  loginValidators,
  changePasswordValidators,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.post('/login', loginValidators, validate, login);
router.post('/refresh', refresh);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, me);
router.post('/change-password', authenticate, changePasswordValidators, validate, changePassword);

export default router;
