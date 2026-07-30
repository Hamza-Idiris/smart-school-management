import { Router } from 'express';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import settingsRoutes from './settingsRoutes.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'Smart School API is running' });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/settings', settingsRoutes);

export default router;
