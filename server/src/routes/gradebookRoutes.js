import { Router } from 'express';
import { body } from 'express-validator';
import {
  listGradebooks,
  getGradebook,
  createGradebook,
  updateEntries,
  submitGradebook,
  unlockGradebook,
  masterGrid,
  releaseClassResults,
  myReportCard,
  downloadReportCardPdf,
  createValidators,
} from '../controllers/gradebookController.js';
import { authenticate, authorize, requirePasswordChanged } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.use(authenticate, requirePasswordChanged);

router.get('/me/report-card', authorize('student'), myReportCard);
router.get('/me/report-card.pdf', authorize('student'), downloadReportCardPdf);
router.get(
  '/report-card/:studentId.pdf',
  authorize('super_admin'),
  downloadReportCardPdf
);
router.get('/master-grid', authorize('super_admin'), masterGrid);
router.post(
  '/release',
  authorize('super_admin'),
  body('classId').notEmpty(),
  body('term').trim().notEmpty(),
  validate,
  releaseClassResults
);

router.get('/', authorize('super_admin', 'teacher'), listGradebooks);
router.post('/', authorize('super_admin', 'teacher'), createValidators, validate, createGradebook);
router.get('/:id', authorize('super_admin', 'teacher'), getGradebook);
router.put(
  '/:id/entries',
  authorize('super_admin', 'teacher'),
  body('entries').isArray(),
  validate,
  updateEntries
);
router.post('/:id/submit', authorize('super_admin', 'teacher'), submitGradebook);
router.post('/:id/unlock', authorize('super_admin'), unlockGradebook);

export default router;
