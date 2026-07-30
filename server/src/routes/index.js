import { Router } from 'express';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import settingsRoutes from './settingsRoutes.js';
import classRoutes from './classRoutes.js';
import subjectRoutes from './subjectRoutes.js';
import assignmentRoutes from './assignmentRoutes.js';
import studentRoutes from './studentRoutes.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'Smart School API is running' });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/settings', settingsRoutes);
router.use('/classes', classRoutes);
router.use('/subjects', subjectRoutes);
router.use('/assignments', assignmentRoutes);
router.use('/students', studentRoutes);

export default router;
