import { body } from 'express-validator';
import { Invoice, Payment } from '../models/Finance.js';
import { Student } from '../models/Student.js';
import { SystemSettings } from '../models/SystemSettings.js';
import { AppError, asyncHandler } from '../middleware/error.js';
import { writeAudit } from '../services/audit.js';
import { dashboardBus } from '../services/dashboardBus.js';

export const generateValidators = [
  body('month')
    .matches(/^\d{4}-\d{2}$/)
    .withMessage('Use YYYY-MM'),
];

export const paymentValidators = [
  body('invoiceId').notEmpty(),
  body('amount').isFloat({ gt: 0 }),
  body('method').isIn(['cash', 'mobile_money', 'card']),
];

function computeTuition(student, baseTuition) {
  if (student.feeTag === 'scholarship') {
    return { amountDue: 0, waived: true };
  }
  if (student.feeTag === 'discounted') {
    if (student.discountType === 'percent') {
      const amount = Math.max(0, baseTuition * (1 - Number(student.discountValue || 0) / 100));
      return { amountDue: Math.round(amount * 100) / 100, waived: false };
    }
    if (student.discountType === 'amount') {
      return {
        amountDue: Math.max(0, Math.round((baseTuition - Number(student.discountValue || 0)) * 100) / 100),
        waived: false,
      };
    }
  }
  return { amountDue: baseTuition, waived: false };
}

function serializeInvoice(doc) {
  const balance = Math.max(0, Number(doc.amountDue) - Number(doc.amountPaid));
  return {
    id: doc._id,
    studentId: doc.studentId?._id || doc.studentId,
    studentName: doc.studentId?.fullName,
    studentCode: doc.studentId?.studentId,
    className: doc.studentId?.classId?.name,
    month: doc.month,
    amountDue: doc.amountDue,
    amountPaid: doc.amountPaid,
    balance,
    status: doc.status,
    feeTagSnapshot: doc.feeTagSnapshot,
    notes: doc.notes,
    createdAt: doc.createdAt,
  };
}

function serializePayment(doc) {
  return {
    id: doc._id,
    invoiceId: doc.invoiceId?._id || doc.invoiceId,
    studentId: doc.studentId?._id || doc.studentId,
    studentName: doc.studentId?.fullName,
    studentCode: doc.studentId?.studentId,
    amount: doc.amount,
    method: doc.method,
    receiptNumber: doc.receiptNumber,
    note: doc.note,
    receivedBy: doc.receivedBy?._id || doc.receivedBy,
    receivedByName: doc.receivedBy?.fullName,
    createdAt: doc.createdAt,
    month: doc.invoiceId?.month,
  };
}

function makeReceiptNumber() {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RCP-${stamp}-${rand}`;
}

function refreshInvoiceStatus(invoice) {
  if (invoice.status === 'waived') return;
  if (invoice.amountPaid <= 0) invoice.status = 'unpaid';
  else if (invoice.amountPaid >= invoice.amountDue) invoice.status = 'paid';
  else invoice.status = 'partial';
}

export const generateInvoices = asyncHandler(async (req, res) => {
  const { month } = req.body;
  const settings = await SystemSettings.findOne({ schoolId: req.user.schoolId });
  const baseTuition = Number(settings?.monthlyTuition ?? 100);

  const students = await Student.find({
    schoolId: req.user.schoolId,
    status: 'active',
  });

  let created = 0;
  let skipped = 0;
  let waived = 0;

  for (const student of students) {
    const existing = await Invoice.findOne({
      schoolId: req.user.schoolId,
      studentId: student._id,
      month,
    });
    if (existing) {
      skipped += 1;
      continue;
    }

    const { amountDue, waived: isWaived } = computeTuition(student, baseTuition);
    await Invoice.create({
      schoolId: req.user.schoolId,
      studentId: student._id,
      month,
      amountDue,
      amountPaid: 0,
      status: isWaived || amountDue === 0 ? 'waived' : 'unpaid',
      feeTagSnapshot: student.feeTag,
      notes: isWaived ? 'Scholarship / exempt' : '',
    });
    created += 1;
    if (isWaived || amountDue === 0) waived += 1;
  }

  await writeAudit({
    schoolId: req.user.schoolId,
    actorId: req.user._id,
    action: 'generate_invoices',
    entity: 'Invoice',
    entityId: month,
    after: { month, created, skipped, waived, baseTuition },
    ip: req.ip,
  });

  dashboardBus.notify(req.user.schoolId, { type: 'finance' });

  res.status(201).json({
    success: true,
    data: { month, created, skipped, waived, baseTuition },
    message: `Generated ${created} invoices for ${month}`,
  });
});

export const listInvoices = asyncHandler(async (req, res) => {
  const filter = { schoolId: req.user.schoolId };
  if (req.query.month) filter.month = req.query.month;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.studentId) filter.studentId = req.query.studentId;

  if (req.query.q) {
    const students = await Student.find({
      schoolId: req.user.schoolId,
      $or: [
        { fullName: new RegExp(req.query.q, 'i') },
        { studentId: new RegExp(req.query.q, 'i') },
      ],
    }).select('_id');
    filter.studentId = { $in: students.map((s) => s._id) };
  }

  if (req.query.debtors === 'true') {
    filter.status = { $in: ['unpaid', 'partial'] };
  }

  const invoices = await Invoice.find(filter)
    .populate({
      path: 'studentId',
      select: 'fullName studentId classId',
      populate: { path: 'classId', select: 'name' },
    })
    .sort({ month: -1, createdAt: -1 });

  res.json({ success: true, data: invoices.map(serializeInvoice) });
});

export const getInvoice = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findOne({
    _id: req.params.id,
    schoolId: req.user.schoolId,
  }).populate({
    path: 'studentId',
    select: 'fullName studentId classId feeTag',
    populate: { path: 'classId', select: 'name' },
  });
  if (!invoice) throw new AppError('Invoice not found', 404);

  const payments = await Payment.find({ invoiceId: invoice._id })
    .populate('receivedBy', 'fullName')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: {
      invoice: serializeInvoice(invoice),
      payments: payments.map(serializePayment),
    },
  });
});

export const recordPayment = asyncHandler(async (req, res) => {
  const { invoiceId, amount, method, note } = req.body;
  const invoice = await Invoice.findOne({ _id: invoiceId, schoolId: req.user.schoolId });
  if (!invoice) throw new AppError('Invoice not found', 404);
  if (invoice.status === 'waived') throw new AppError('Cannot pay a waived invoice', 400);
  if (invoice.status === 'paid') throw new AppError('Invoice already paid', 400);

  const balance = Math.max(0, invoice.amountDue - invoice.amountPaid);
  const payAmount = Number(amount);
  if (payAmount > balance + 0.001) {
    throw new AppError(`Amount exceeds balance (${balance})`, 400);
  }

  const payment = await Payment.create({
    schoolId: req.user.schoolId,
    invoiceId: invoice._id,
    studentId: invoice.studentId,
    amount: payAmount,
    method,
    receivedBy: req.user._id,
    receiptNumber: makeReceiptNumber(),
    note: note || '',
  });

  invoice.amountPaid = Math.round((invoice.amountPaid + payAmount) * 100) / 100;
  refreshInvoiceStatus(invoice);
  await invoice.save();

  await writeAudit({
    schoolId: req.user.schoolId,
    actorId: req.user._id,
    action: 'record_payment',
    entity: 'Payment',
    entityId: payment._id,
    after: {
      invoiceId: invoice._id,
      amount: payAmount,
      method,
      receiptNumber: payment.receiptNumber,
      invoiceStatus: invoice.status,
    },
    ip: req.ip,
  });

  dashboardBus.notify(req.user.schoolId, { type: 'finance' });

  const populatedPayment = await Payment.findById(payment._id)
    .populate('receivedBy', 'fullName')
    .populate('studentId', 'fullName studentId')
    .populate('invoiceId', 'month');

  const populatedInvoice = await Invoice.findById(invoice._id).populate({
    path: 'studentId',
    select: 'fullName studentId classId',
    populate: { path: 'classId', select: 'name' },
  });

  res.status(201).json({
    success: true,
    data: {
      payment: serializePayment(populatedPayment),
      invoice: serializeInvoice(populatedInvoice),
    },
    message: 'Payment recorded',
  });
});

export const waiveInvoice = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!invoice) throw new AppError('Invoice not found', 404);

  const before = { status: invoice.status, notes: invoice.notes };
  invoice.status = 'waived';
  invoice.notes = req.body.note?.trim() || invoice.notes || 'Fee waiver';
  await invoice.save();

  await writeAudit({
    schoolId: req.user.schoolId,
    actorId: req.user._id,
    action: 'waive_invoice',
    entity: 'Invoice',
    entityId: invoice._id,
    before,
    after: { status: invoice.status, notes: invoice.notes },
    ip: req.ip,
  });

  dashboardBus.notify(req.user.schoolId, { type: 'finance' });

  const populated = await Invoice.findById(invoice._id).populate({
    path: 'studentId',
    select: 'fullName studentId classId',
    populate: { path: 'classId', select: 'name' },
  });

  res.json({ success: true, data: serializeInvoice(populated) });
});

export const listPayments = asyncHandler(async (req, res) => {
  const filter = { schoolId: req.user.schoolId };
  if (req.query.studentId) filter.studentId = req.query.studentId;

  const payments = await Payment.find(filter)
    .populate('studentId', 'fullName studentId')
    .populate('receivedBy', 'fullName')
    .populate('invoiceId', 'month')
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(req.query.limit) || 100, 300));

  res.json({ success: true, data: payments.map(serializePayment) });
});

export const financeSummary = asyncHandler(async (req, res) => {
  const month = req.query.month;
  const match = { schoolId: req.user.schoolId };
  if (month) match.month = month;

  const [agg, paymentAgg] = await Promise.all([
    Invoice.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          amountDue: { $sum: '$amountDue' },
          amountPaid: { $sum: '$amountPaid' },
        },
      },
    ]),
    Payment.aggregate([
      {
        $match: {
          schoolId: req.user.schoolId,
          ...(month
            ? {}
            : {}),
        },
      },
      {
        $lookup: {
          from: 'invoices',
          localField: 'invoiceId',
          foreignField: '_id',
          as: 'invoice',
        },
      },
      { $unwind: '$invoice' },
      ...(month ? [{ $match: { 'invoice.month': month } }] : []),
      {
        $group: {
          _id: '$method',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const byStatus = Object.fromEntries(
    agg.map((row) => [
      row._id,
      { count: row.count, amountDue: row.amountDue, amountPaid: row.amountPaid },
    ])
  );

  const collected = agg.reduce((sum, row) => sum + row.amountPaid, 0);
  const billed = agg.reduce((sum, row) => sum + row.amountDue, 0);
  const outstanding = Math.max(0, billed - collected);

  res.json({
    success: true,
    data: {
      month: month || 'all',
      billed,
      collected,
      outstanding,
      clearanceRate: billed ? Math.round((collected / billed) * 1000) / 10 : 0,
      byStatus,
      byMethod: Object.fromEntries(paymentAgg.map((p) => [p._id, { total: p.total, count: p.count }])),
    },
  });
});

export const myFees = asyncHandler(async (req, res) => {
  if (req.user.role !== 'student') throw new AppError('Students only', 403);

  const student = await Student.findOne({
    schoolId: req.user.schoolId,
    $or: [{ userId: req.user._id }, { _id: req.user.studentRef }],
  });
  if (!student) throw new AppError('Student profile not linked', 404);

  const invoices = await Invoice.find({
    schoolId: req.user.schoolId,
    studentId: student._id,
  }).sort({ month: -1 });

  const outstanding = invoices
    .filter((i) => ['unpaid', 'partial'].includes(i.status))
    .reduce((sum, i) => sum + Math.max(0, i.amountDue - i.amountPaid), 0);

  res.json({
    success: true,
    data: {
      feeTag: student.feeTag,
      outstanding: Math.round(outstanding * 100) / 100,
      invoices: invoices.map(serializeInvoice),
    },
  });
});
