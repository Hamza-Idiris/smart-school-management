import { body } from 'express-validator';
import { AttendanceSession } from '../models/AttendanceSession.js';
import { Student } from '../models/Student.js';
import { ClassModel } from '../models/Class.js';
import { AppError, asyncHandler } from '../middleware/error.js';
import { writeAudit } from '../services/audit.js';
import { dashboardBus } from '../services/dashboardBus.js';

const MARK_STATUSES = ['present', 'absent', 'late'];

export const submitValidators = [
  body('classId').notEmpty(),
  body('date').matches(/^\d{4}-\d{2}-\d{2}$/),
  body('slot').isIn([1, 2]),
  body('marks').isArray({ min: 1 }),
  body('marks.*.studentId').notEmpty(),
  body('marks.*.status').isIn(MARK_STATUSES),
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function serializeSession(doc) {
  return {
    id: doc._id,
    classId: doc.classId?._id || doc.classId,
    className: doc.classId?.name,
    date: doc.date,
    slot: doc.slot,
    marks: (doc.marks || []).map((m) => ({
      studentId: m.studentId?._id || m.studentId,
      studentName: m.studentId?.fullName,
      studentCode: m.studentId?.studentId,
      status: m.status,
      note: m.note,
      excusedBy: m.excusedBy,
      excusedAt: m.excusedAt,
    })),
    submittedBy: doc.submittedBy?._id || doc.submittedBy,
    submittedByName: doc.submittedBy?.fullName,
    submittedAt: doc.submittedAt,
  };
}

async function applyTruancy(schoolId, classId, date, slot2Marks) {
  const slot1 = await AttendanceSession.findOne({ schoolId, classId, date, slot: 1 });
  if (!slot1) return slot2Marks;

  const slot1Map = new Map(slot1.marks.map((m) => [m.studentId.toString(), m.status]));

  return slot2Marks.map((mark) => {
    const prior = slot1Map.get(mark.studentId.toString());
    const wasPresent = prior === 'present' || prior === 'late';
    if (wasPresent && mark.status === 'absent') {
      return { ...mark, status: 'truant', note: mark.note || 'Absent after present in Slot 1' };
    }
    return mark;
  });
}

export const getRoster = asyncHandler(async (req, res) => {
  const { classId, date } = req.query;
  if (!classId) throw new AppError('classId is required', 400);
  const day = date || todayIso();

  const classDoc = await ClassModel.findOne({ _id: classId, schoolId: req.user.schoolId });
  if (!classDoc) throw new AppError('Class not found', 404);

  const students = await Student.find({
    schoolId: req.user.schoolId,
    classId,
    status: 'active',
  }).sort({ fullName: 1 });

  const sessions = await AttendanceSession.find({
    schoolId: req.user.schoolId,
    classId,
    date: day,
  }).populate('submittedBy', 'fullName');

  res.json({
    success: true,
    data: {
      class: { id: classDoc._id, name: classDoc.name },
      date: day,
      students: students.map((s) => ({
        id: s._id,
        studentId: s.studentId,
        fullName: s.fullName,
      })),
      sessions: sessions.map(serializeSession),
    },
  });
});

export const submitSession = asyncHandler(async (req, res) => {
  const { classId, date, slot } = req.body;
  let marks = req.body.marks.map((m) => ({
    studentId: m.studentId,
    status: m.status,
    note: m.note || '',
  }));

  const classDoc = await ClassModel.findOne({ _id: classId, schoolId: req.user.schoolId });
  if (!classDoc) throw new AppError('Class not found', 404);

  const studentIds = marks.map((m) => m.studentId);
  const count = await Student.countDocuments({
    schoolId: req.user.schoolId,
    classId,
    _id: { $in: studentIds },
    status: 'active',
  });
  if (count !== studentIds.length) {
    throw new AppError('One or more students are invalid for this class', 400);
  }

  if (Number(slot) === 2) {
    marks = await applyTruancy(req.user.schoolId, classId, date, marks);
  }

  const existing = await AttendanceSession.findOne({
    schoolId: req.user.schoolId,
    classId,
    date,
    slot,
  });

  let doc;
  if (existing) {
    existing.marks = marks;
    existing.submittedBy = req.user._id;
    existing.submittedAt = new Date();
    await existing.save();
    doc = existing;
  } else {
    doc = await AttendanceSession.create({
      schoolId: req.user.schoolId,
      classId,
      date,
      slot,
      marks,
      submittedBy: req.user._id,
      submittedAt: new Date(),
    });
  }

  const populated = await AttendanceSession.findById(doc._id)
    .populate('classId', 'name')
    .populate('submittedBy', 'fullName')
    .populate('marks.studentId', 'fullName studentId');

  await writeAudit({
    schoolId: req.user.schoolId,
    actorId: req.user._id,
    action: existing ? 'update_attendance' : 'submit_attendance',
    entity: 'AttendanceSession',
    entityId: doc._id,
    after: { classId, date, slot, markCount: marks.length },
    ip: req.ip,
  });

  dashboardBus.notify(req.user.schoolId, { type: 'attendance' });

  res.status(existing ? 200 : 201).json({ success: true, data: serializeSession(populated) });
});

export const excuseAbsence = asyncHandler(async (req, res) => {
  const { note } = req.body;
  if (!note?.trim()) throw new AppError('Excuse note is required', 400);

  const session = await AttendanceSession.findOne({
    _id: req.params.id,
    schoolId: req.user.schoolId,
  });
  if (!session) throw new AppError('Attendance session not found', 404);

  const mark = session.marks.find((m) => m.studentId.toString() === req.params.studentId);
  if (!mark) throw new AppError('Student mark not found', 404);
  if (!['absent', 'truant'].includes(mark.status)) {
    throw new AppError('Only absent or truant marks can be excused', 400);
  }

  const before = { status: mark.status, note: mark.note };
  mark.status = 'excused';
  mark.note = note.trim();
  mark.excusedBy = req.user._id;
  mark.excusedAt = new Date();
  await session.save();

  await writeAudit({
    schoolId: req.user.schoolId,
    actorId: req.user._id,
    action: 'excuse_absence',
    entity: 'AttendanceSession',
    entityId: session._id,
    before,
    after: { status: mark.status, note: mark.note, studentId: req.params.studentId },
    ip: req.ip,
  });

  dashboardBus.notify(req.user.schoolId, { type: 'attendance' });

  const populated = await AttendanceSession.findById(session._id)
    .populate('classId', 'name')
    .populate('submittedBy', 'fullName')
    .populate('marks.studentId', 'fullName studentId');

  res.json({ success: true, data: serializeSession(populated) });
});

export const listUnexcused = asyncHandler(async (req, res) => {
  const date = req.query.date || todayIso();
  const sessions = await AttendanceSession.find({
    schoolId: req.user.schoolId,
    date,
    'marks.status': { $in: ['absent', 'truant'] },
  })
    .populate('classId', 'name')
    .populate('marks.studentId', 'fullName studentId');

  const rows = [];
  for (const session of sessions) {
    for (const mark of session.marks) {
      if (mark.status === 'absent' || mark.status === 'truant') {
        rows.push({
          sessionId: session._id,
          classId: session.classId?._id || session.classId,
          className: session.classId?.name,
          date: session.date,
          slot: session.slot,
          studentId: mark.studentId?._id || mark.studentId,
          studentName: mark.studentId?.fullName,
          studentCode: mark.studentId?.studentId,
          status: mark.status,
          note: mark.note,
        });
      }
    }
  }

  res.json({ success: true, data: rows });
});

export const getMyAttendance = asyncHandler(async (req, res) => {
  if (req.user.role !== 'student') throw new AppError('Students only', 403);
  const student = await Student.findOne({
    schoolId: req.user.schoolId,
    $or: [{ userId: req.user._id }, { _id: req.user.studentRef }],
  });
  if (!student) throw new AppError('Student profile not linked', 404);

  const limit = Math.min(Number(req.query.limit) || 30, 90);
  const sessions = await AttendanceSession.find({
    schoolId: req.user.schoolId,
    'marks.studentId': student._id,
  })
    .populate('classId', 'name')
    .sort({ date: -1, slot: -1 })
    .limit(limit);

  const rows = sessions.map((session) => {
    const mark = session.marks.find((m) => m.studentId.toString() === student._id.toString());
    return {
      date: session.date,
      slot: session.slot,
      className: session.classId?.name,
      status: mark?.status,
      note: mark?.note,
    };
  });

  res.json({ success: true, data: rows });
});
