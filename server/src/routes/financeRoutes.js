import { Router } from 'express';
import { body } from 'express-validator';
import {
  generateInvoices,
  listInvoices,
  getInvoice,
  recordPayment,
  waiveInvoice,
  listPayments,
  financeSummary,
  myFees,
  generateValidators,
  paymentValidators,
} from '../controllers/financeController.js';
import { authenticate, authorize, requirePasswordChanged } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.use(authenticate, requirePasswordChanged);

router.get('/me', authorize('student'), myFees);
router.get('/summary', authorize('super_admin', 'cashier'), financeSummary);
router.get('/payments', authorize('super_admin', 'cashier'), listPayments);
router.get('/invoices', authorize('super_admin', 'cashier'), listInvoices);
router.get('/invoices/:id', authorize('super_admin', 'cashier'), getInvoice);
router.post(
  '/invoices/generate',
  authorize('super_admin'),
  generateValidators,
  validate,
  generateInvoices
);
router.post(
  '/payments',
  authorize('super_admin', 'cashier'),
  paymentValidators,
  validate,
  recordPayment
);
router.post(
  '/invoices/:id/waive',
  authorize('super_admin'),
  body('note').optional().isString(),
  validate,
  waiveInvoice
);

export default router;
