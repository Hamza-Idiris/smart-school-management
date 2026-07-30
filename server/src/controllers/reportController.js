import { AttendanceSession } from '../models/AttendanceSession.js';
import { TeacherCheckIn } from '../models/TeacherCheckIn.js';
import { Gradebook } from '../models/Gradebook.js';
import { Invoice, Payment } from '../models/Finance.js';
import { AuditLog } from '../models/AuditLog.js';
import { Student } from '../models/Student.js';
import { School } from '../models/School.js';
import { asyncHandler } from '../middleware/error.js';
import { sendExport } from '../services/exportFormats.js';

function parseDateRange(query) {
  const from = query.from || query.dateFrom;
  const to = query.to || query.dateTo;
  return { from, to };
}

export const exportAttendance = asyncHandler(async (req, res) => {
  const filter = { schoolId: req.user.schoolId };
  if (req.query.classId) filter.classId = req.query.classId;
  if (req.query.slot) filter.slot = Number(req.query.slot);
  const { from, to } = parseDateRange(req.query);
  if (from && to) filter.date = { $gte: from, $lte: to };
  else if (from) filter.date = { $gte: from };
  else if (to) filter.date = { $lte: to };
  else if (req.query.date) filter.date = req.query.date;

  const sessions = await AttendanceSession.find(filter)
    .populate('classId', 'name')
    .populate('marks.studentId', 'fullName studentId')
    .sort({ date: -1, slot: 1 });

  const statusFilter = req.query.status;
  const rows = [];
  for (const session of sessions) {
    for (const mark of session.marks) {
      if (statusFilter === 'truant' && mark.status !== 'truant') continue;
      if (statusFilter === 'excused' && mark.status !== 'excused') continue;
      if (statusFilter === 'unexcused' && !['absent', 'truant'].includes(mark.status)) continue;
      rows.push({
        date: session.date,
        slot: session.slot,
        className: session.classId?.name || '',
        studentId: mark.studentId?.studentId || '',
        studentName: mark.studentId?.fullName || '',
        status: mark.status,
        note: mark.note || '',
      });
    }
  }

  const headers = [
    { key: 'date', label: 'Date' },
    { key: 'slot', label: 'Slot' },
    { key: 'className', label: 'Class' },
    { key: 'studentId', label: 'Student ID' },
    { key: 'studentName', label: 'Student' },
    { key: 'status', label: 'Status' },
    { key: 'note', label: 'Note' },
  ];

  const school = await School.findById(req.user.schoolId);
  await sendExport(res, {
    format: req.query.format,
    filename: 'attendance-report',
    title: 'Student Attendance Report',
    headers,
    rows,
    metaLines: [
      school?.name || 'Smart School',
      `Generated ${new Date().toISOString()}`,
      `Rows: ${rows.length}`,
    ],
  });
});

export const exportTeacherPunctuality = asyncHandler(async (req, res) => {
  const filter = { schoolId: req.user.schoolId };
  if (req.query.teacherId) filter.teacherId = req.query.teacherId;
  if (req.query.month) filter.date = new RegExp(`^${req.query.month}`);
  const { from, to } = parseDateRange(req.query);
  if (from && to) filter.date = { $gte: from, $lte: to };

  const docs = await TeacherCheckIn.find(filter)
    .populate('teacherId', 'fullName username')
    .sort({ date: -1 });

  const rows = docs.map((d) => ({
    date: d.date,
    teacher: d.teacherId?.fullName || '',
    username: d.teacherId?.username || '',
    clockInAt: d.clockInAt ? new Date(d.clockInAt).toISOString() : '',
    cutoffTime: d.cutoffTime,
    isLate: d.isLate ? 'YES' : 'NO',
  }));

  await sendExport(res, {
    format: req.query.format || 'xlsx',
    filename: 'teacher-punctuality',
    title: 'Teacher Punctuality Audit',
    headers: [
      { key: 'date', label: 'Date' },
      { key: 'teacher', label: 'Teacher' },
      { key: 'username', label: 'Username' },
      { key: 'clockInAt', label: 'Clock In' },
      { key: 'cutoffTime', label: 'Cutoff' },
      { key: 'isLate', label: 'Late' },
    ],
    rows,
    metaLines: [`Generated ${new Date().toISOString()}`, `Records: ${rows.length}`],
  });
});

export const exportAcademic = asyncHandler(async (req, res) => {
  const filter = { schoolId: req.user.schoolId, status: 'released' };
  if (req.query.classId) filter.classId = req.query.classId;
  if (req.query.subjectId) filter.subjectId = req.query.subjectId;
  if (req.query.term) filter.term = req.query.term;
  if (req.query.academicYear) filter.academicYear = req.query.academicYear;

  const gradebooks = await Gradebook.find(filter)
    .populate('classId', 'name')
    .populate('subjectId', 'name code')
    .populate('entries.studentId', 'fullName studentId');

  const rows = [];
  for (const g of gradebooks) {
    for (const entry of g.entries) {
      const percent =
        entry.score != null && entry.maxScore
          ? Math.round((Number(entry.score) / Number(entry.maxScore)) * 1000) / 10
          : null;
      rows.push({
        className: g.classId?.name || '',
        subject: g.subjectId?.name || '',
        subjectCode: g.subjectId?.code || '',
        term: g.term,
        title: g.title,
        studentId: entry.studentId?.studentId || '',
        studentName: entry.studentId?.fullName || '',
        score: entry.score ?? '',
        maxScore: entry.maxScore,
        percent: percent ?? '',
        result: percent == null ? '' : percent >= 50 ? 'PASS' : 'FAIL',
        gpa: '',
        rank: '',
      });
    }
  }

  if (req.query.includeRank === 'true') {
    const byStudent = new Map();
    for (const row of rows) {
      const key = `${row.className}|${row.term}|${row.studentId}`;
      if (!byStudent.has(key)) byStudent.set(key, { sum: 0, count: 0 });
      if (row.percent !== '') {
        const bucket = byStudent.get(key);
        bucket.sum += Number(row.percent);
        bucket.count += 1;
      }
    }
    const averages = [...byStudent.entries()].map(([key, v]) => ({
      key,
      avg: v.count ? v.sum / v.count : 0,
      classTerm: key.split('|').slice(0, 2).join('|'),
    }));
    const rankMap = new Map();
    const groups = new Map();
    for (const item of averages) {
      if (!groups.has(item.classTerm)) groups.set(item.classTerm, []);
      groups.get(item.classTerm).push(item);
    }
    for (const [, list] of groups) {
      list.sort((a, b) => b.avg - a.avg);
      list.forEach((item, idx) => rankMap.set(item.key, idx + 1));
    }
    const avgMap = new Map(averages.map((a) => [a.key, a.avg]));
    for (const row of rows) {
      const key = `${row.className}|${row.term}|${row.studentId}`;
      row.rank = rankMap.get(key) || '';
      const avg = avgMap.get(key);
      row.gpa = avg != null ? Math.round(avg * 10) / 10 : '';
    }
  }

  const headers = [
    { key: 'className', label: 'Class' },
    { key: 'subject', label: 'Subject' },
    { key: 'term', label: 'Term' },
    { key: 'studentId', label: 'Student ID' },
    { key: 'studentName', label: 'Student' },
    { key: 'score', label: 'Score' },
    { key: 'maxScore', label: 'Max' },
    { key: 'percent', label: '%' },
    { key: 'result', label: 'Pass/Fail' },
  ];
  if (req.query.includeRank === 'true') {
    headers.push({ key: 'gpa', label: 'Avg %' }, { key: 'rank', label: 'Rank' });
  }

  await sendExport(res, {
    format: req.query.format || 'xlsx',
    filename: 'academic-performance',
    title: 'Academic Performance Matrix',
    headers,
    rows,
    metaLines: [`Generated ${new Date().toISOString()}`, `Rows: ${rows.length}`],
  });
});

export const exportFinance = asyncHandler(async (req, res) => {
  const type = req.query.type || 'invoices';
  const schoolId = req.user.schoolId;

  if (type === 'payments') {
    const payments = await Payment.find({ schoolId })
      .populate('studentId', 'fullName studentId')
      .populate('receivedBy', 'fullName')
      .populate('invoiceId', 'month')
      .sort({ createdAt: -1 });
    const rows = payments.map((p) => ({
      receiptNumber: p.receiptNumber,
      date: p.createdAt?.toISOString?.() || '',
      studentId: p.studentId?.studentId || '',
      studentName: p.studentId?.fullName || '',
      month: p.invoiceId?.month || '',
      amount: p.amount,
      method: p.method,
      cashier: p.receivedBy?.fullName || '',
      note: p.note || '',
    }));
    await sendExport(res, {
      format: req.query.format,
      filename: 'cashier-ledger',
      title: 'Cashier Ledger',
      headers: [
        { key: 'receiptNumber', label: 'Receipt' },
        { key: 'date', label: 'Date' },
        { key: 'studentId', label: 'Student ID' },
        { key: 'studentName', label: 'Student' },
        { key: 'month', label: 'Invoice Month' },
        { key: 'amount', label: 'Amount' },
        { key: 'method', label: 'Method' },
        { key: 'cashier', label: 'Cashier' },
        { key: 'note', label: 'Note' },
      ],
      rows,
      metaLines: [`Generated ${new Date().toISOString()}`],
    });
    return;
  }

  if (type === 'scholarships') {
    const students = await Student.find({
      schoolId,
      feeTag: { $in: ['scholarship', 'discounted'] },
    })
      .populate('classId', 'name')
      .sort({ fullName: 1 });
    const rows = students.map((s) => ({
      studentId: s.studentId,
      fullName: s.fullName,
      className: s.classId?.name || '',
      feeTag: s.feeTag,
      discountType: s.discountType || '',
      discountValue: s.discountValue || 0,
      status: s.status,
    }));
    await sendExport(res, {
      format: req.query.format,
      filename: 'scholarship-roster',
      title: 'Scholarship / Discount Roster',
      headers: [
        { key: 'studentId', label: 'Student ID' },
        { key: 'fullName', label: 'Name' },
        { key: 'className', label: 'Class' },
        { key: 'feeTag', label: 'Fee Tag' },
        { key: 'discountType', label: 'Discount Type' },
        { key: 'discountValue', label: 'Discount Value' },
        { key: 'status', label: 'Status' },
      ],
      rows,
      metaLines: [`Generated ${new Date().toISOString()}`],
    });
    return;
  }

  const filter = { schoolId };
  if (req.query.month) filter.month = req.query.month;
  if (type === 'debtors') filter.status = { $in: ['unpaid', 'partial'] };
  if (type === 'paid') filter.status = 'paid';

  const invoices = await Invoice.find(filter)
    .populate({
      path: 'studentId',
      select: 'fullName studentId classId feeTag',
      populate: { path: 'classId', select: 'name' },
    })
    .sort({ month: -1 });

  const rows = invoices.map((inv) => ({
    month: inv.month,
    studentId: inv.studentId?.studentId || '',
    studentName: inv.studentId?.fullName || '',
    className: inv.studentId?.classId?.name || '',
    feeTag: inv.feeTagSnapshot || inv.studentId?.feeTag || '',
    amountDue: inv.amountDue,
    amountPaid: inv.amountPaid,
    balance: Math.max(0, inv.amountDue - inv.amountPaid),
    status: inv.status,
  }));

  await sendExport(res, {
    format: req.query.format,
    filename: type === 'debtors' ? 'outstanding-debtors' : 'fee-collection',
    title: type === 'debtors' ? 'Outstanding Debtors' : 'Financial & Fee Collection',
    headers: [
      { key: 'month', label: 'Month' },
      { key: 'studentId', label: 'Student ID' },
      { key: 'studentName', label: 'Student' },
      { key: 'className', label: 'Class' },
      { key: 'feeTag', label: 'Fee Tag' },
      { key: 'amountDue', label: 'Due' },
      { key: 'amountPaid', label: 'Paid' },
      { key: 'balance', label: 'Balance' },
      { key: 'status', label: 'Status' },
    ],
    rows,
    metaLines: [`Generated ${new Date().toISOString()}`, `Rows: ${rows.length}`],
  });
});

export const exportAudit = asyncHandler(async (req, res) => {
  const filter = { schoolId: req.user.schoolId };
  if (req.query.action) filter.action = req.query.action;
  if (req.query.entity) filter.entity = req.query.entity;

  const logs = await AuditLog.find(filter)
    .populate('actorId', 'fullName username role')
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(req.query.limit) || 1000, 5000));

  const rows = logs.map((log) => ({
    at: log.createdAt?.toISOString?.() || '',
    actor: log.actorId?.fullName || '',
    username: log.actorId?.username || '',
    role: log.actorId?.role || '',
    action: log.action,
    entity: log.entity,
    entityId: log.entityId || '',
    ip: log.ip || '',
  }));

  await sendExport(res, {
    format: req.query.format || 'csv',
    filename: 'audit-logs',
    title: 'Staff & User Audit Logs',
    headers: [
      { key: 'at', label: 'Timestamp' },
      { key: 'actor', label: 'Actor' },
      { key: 'username', label: 'Username' },
      { key: 'role', label: 'Role' },
      { key: 'action', label: 'Action' },
      { key: 'entity', label: 'Entity' },
      { key: 'entityId', label: 'Entity ID' },
      { key: 'ip', label: 'IP' },
    ],
    rows,
    metaLines: [`Generated ${new Date().toISOString()}`, `Rows: ${rows.length}`],
  });
});

export const listReportCatalog = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: 'attendance',
        name: 'Student Attendance',
        formats: ['pdf', 'xlsx', 'csv'],
        path: '/api/reports/attendance',
      },
      {
        id: 'punctuality',
        name: 'Teacher Punctuality Audit',
        formats: ['pdf', 'xlsx'],
        path: '/api/reports/punctuality',
      },
      {
        id: 'academic',
        name: 'Academic Performance Matrix',
        formats: ['pdf', 'xlsx'],
        path: '/api/reports/academic',
      },
      {
        id: 'finance',
        name: 'Financial & Fee Collection',
        formats: ['pdf', 'xlsx', 'csv'],
        path: '/api/reports/finance',
      },
      {
        id: 'audit',
        name: 'Staff & User Audit Logs',
        formats: ['pdf', 'csv'],
        path: '/api/reports/audit',
      },
    ],
  });
});
