import { TeacherCheckIn } from '../models/TeacherCheckIn.js';
import { SystemSettings } from '../models/SystemSettings.js';
import { User } from '../models/User.js';
import { AppError, asyncHandler } from '../middleware/error.js';
import { writeAudit } from '../services/audit.js';
import { dashboardBus } from '../services/dashboardBus.js';

function todayIso(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function isLateAgainstCutoff(clockInAt, cutoffHHMM) {
  const [h, m] = cutoffHHMM.split(':').map(Number);
  const cutoff = new Date(clockInAt);
  cutoff.setHours(h, m, 0, 0);
  return clockInAt.getTime() > cutoff.getTime();
}

function serialize(doc) {
  return {
    id: doc._id,
    teacherId: doc.teacherId?._id || doc.teacherId,
    teacherName: doc.teacherId?.fullName,
    date: doc.date,
    clockInAt: doc.clockInAt,
    isLate: doc.isLate,
    cutoffTime: doc.cutoffTime,
  };
}

export const clockIn = asyncHandler(async (req, res) => {
  if (req.user.role !== 'teacher') throw new AppError('Teachers only', 403);

  const settings = await SystemSettings.findOne({ schoolId: req.user.schoolId });
  const cutoffTime = settings?.teacherCutoffTime || '07:30';
  const now = new Date();
  const date = todayIso(now);

  const existing = await TeacherCheckIn.findOne({
    schoolId: req.user.schoolId,
    teacherId: req.user._id,
    date,
  });
  if (existing) {
    throw new AppError('Already checked in today', 409);
  }

  const late = isLateAgainstCutoff(now, cutoffTime);
  const doc = await TeacherCheckIn.create({
    schoolId: req.user.schoolId,
    teacherId: req.user._id,
    date,
    clockInAt: now,
    isLate: late,
    cutoffTime,
  });

  await writeAudit({
    schoolId: req.user.schoolId,
    actorId: req.user._id,
    action: 'teacher_check_in',
    entity: 'TeacherCheckIn',
    entityId: doc._id,
    after: { date, isLate: late, clockInAt: now },
    ip: req.ip,
  });

  dashboardBus.notify(req.user.schoolId, { type: 'teacher_check_in' });

  res.status(201).json({ success: true, data: serialize(doc) });
});

export const myCheckInToday = asyncHandler(async (req, res) => {
  const date = todayIso();
  const doc = await TeacherCheckIn.findOne({
    schoolId: req.user.schoolId,
    teacherId: req.user._id,
    date,
  });
  res.json({ success: true, data: doc ? serialize(doc) : null });
});

export const listCheckIns = asyncHandler(async (req, res) => {
  const filter = { schoolId: req.user.schoolId };
  if (req.query.date) filter.date = req.query.date;
  if (req.query.month) {
    filter.date = new RegExp(`^${req.query.month}`);
  }
  if (req.query.teacherId) filter.teacherId = req.query.teacherId;

  const docs = await TeacherCheckIn.find(filter)
    .populate('teacherId', 'fullName username')
    .sort({ clockInAt: -1 });

  res.json({ success: true, data: docs.map(serialize) });
});

export const teacherPunctualitySummary = asyncHandler(async (req, res) => {
  const date = req.query.date || todayIso();
  const teachers = await User.find({
    schoolId: req.user.schoolId,
    role: 'teacher',
    status: 'active',
  }).select('fullName');

  const checkIns = await TeacherCheckIn.find({ schoolId: req.user.schoolId, date });
  const map = new Map(checkIns.map((c) => [c.teacherId.toString(), c]));

  const rows = teachers.map((t) => {
    const c = map.get(t._id.toString());
    return {
      teacherId: t._id,
      teacherName: t.fullName,
      checkedIn: Boolean(c),
      isLate: c?.isLate || false,
      clockInAt: c?.clockInAt || null,
      cutoffTime: c?.cutoffTime || null,
    };
  });

  res.json({
    success: true,
    data: {
      date,
      present: rows.filter((r) => r.checkedIn && !r.isLate).length,
      late: rows.filter((r) => r.checkedIn && r.isLate).length,
      missing: rows.filter((r) => !r.checkedIn).length,
      teachers: rows,
    },
  });
});
