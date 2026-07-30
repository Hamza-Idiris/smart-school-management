import { Router } from 'express';
import {
  getSettings,
  updateSettings,
  updateSettingsValidators,
} from '../controllers/settingsController.js';
import { authenticate, authorize, requirePasswordChanged } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.use(authenticate, requirePasswordChanged);

router.get('/', authorize('super_admin', 'staff', 'teacher', 'cashier'), getSettings);
router.patch('/', authorize('super_admin'), updateSettingsValidators, validate, updateSettings);

export default router;
