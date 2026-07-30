import PDFDocument from 'pdfkit';
import { body } from 'express-validator';
import { Gradebook } from '../models/Gradebook.js';
import { Student } from '../models/Student.js';
import { TeacherAssignment } from '../models/TeacherAssignment.js';
import { ClassModel } from '../models/Class.js';
import { Subject } from '../models/Subject.js';
import { SystemSettings } from '../models/SystemSettings.js';
import { School } from '../models/School.js';
import { AppError, asyncHandler } from '../middleware/error.js';
import { writeAudit } from '../services/audit.js';
import { dashboardBus } from '../services/dashboardBus.js';

export const createValidators = [
  body('classId').notEmpty(),
  body('subjectId').notEmpty(),
  body('term').trim().notEmpty(),
  body('title').trim().notEmpty(),
  body('academicYear').optional().isString(),
];

function serialize(doc) {
  return {
    id: doc._id,
    classId: doc.classId?._id || doc.classId,
    className: doc.classId?.name,
    subjectId: doc.subjectId?._id || doc.subjectId,
    subjectName: doc.subjectId?.name,
    subjectCode: doc.subjectId?.code,
    teacherId: doc.teacherId?._id || doc.teacherId,
    teacherName: doc.teacherId?.fullName,
    term: doc.term,
    academicYear: doc.academicYear,
    title: doc.title,
    status: doc.status,
    entries: (doc.entries || []).map((e) => ({
      studentId: e.studentId?._id || e.studentId,
      studentName: e.studentId?.fullName,
      studentCode: e.studentId?.studentId,
      score: e.score,
      maxScore: e.maxScore,
      remark: e.remark,
      percent:
        e.score != null && e.maxScore
          ? Math.round((Number(e.score) / Number(e.maxScore)) * 1000) / 10
          : null,
    })),
    submittedAt: doc.submittedAt,
    releasedAt: doc.releasedAt,
    createdAt: doc.createdAt,
  };
}

async function populateGradebook(id) {
  return Gradebook.findById(id)
    .populate('classId', 'name')
    .populate('subjectId', 'name code')
    .populate('teacherId', 'fullName')
    .populate('entries.studentId', 'fullName studentId');
}

export const listGradebooks = asyncHandler(async (req, res) => {
  const filter = { schoolId: req.user.schoolId };
  if (req.query.classId) filter.classId = req.query.classId;
  if (req.query.subjectId) filter.subjectId = req.query.subjectId;
  if (req.query.term) filter.term = req.query.term;
  if (req.query.academicYear) filter.academicYear = req.query.academicYear;
  if (req.query.status) filter.status = req.query.status;

  if (req.user.role === 'teacher') {
    filter.teacherId = req.user._id;
  }

  const docs = await Gradebook.find(filter)
    .populate('classId', 'name')
    .populate('subjectId', 'name code')
    .populate('teacherId', 'fullName')
    .populate('entries.studentId', 'fullName studentId')
    .sort({ updatedAt: -1 });

  res.json({ success: true, data: docs.map(serialize) });
});

export const getGradebook = asyncHandler(async (req, res) => {
  const doc = await populateGradebook(req.params.id);
  if (!doc || doc.schoolId.toString() !== req.user.schoolId.toString()) {
    throw new AppError('Gradebook not found', 404);
  }
  if (req.user.role === 'teacher' && doc.teacherId._id.toString() !== req.user._id.toString()) {
    throw new AppError('Insufficient permissions', 403);
  }
  res.json({ success: true, data: serialize(doc) });
});

export const createGradebook = asyncHandler(async (req, res) => {
  const settings = await SystemSettings.findOne({ schoolId: req.user.schoolId });
  const academicYear = req.body.academicYear || settings?.academicYear || '2025-2026';

  const [classDoc, subject] = await Promise.all([
    ClassModel.findOne({ _id: req.body.classId, schoolId: req.user.schoolId }),
    Subject.findOne({ _id: req.body.subjectId, schoolId: req.user.schoolId }),
  ]);
  if (!classDoc) throw new AppError('Class not found', 404);
  if (!subject) throw new AppError('Subject not found', 404);

  let teacherId = req.user._id;
  if (req.user.role === 'super_admin' && req.body.teacherId) {
    teacherId = req.body.teacherId;
  } else if (req.user.role === 'teacher') {
    const assignment = await TeacherAssignment.findOne({
      schoolId: req.user.schoolId,
      teacherId: req.user._id,
      classId: classDoc._id,
      subjectId: subject._id,
      academicYear,
    });
    if (!assignment) {
      throw new AppError('You are not assigned to this class/subject', 403);
    }
  } else if (req.user.role !== 'super_admin') {
    throw new AppError('Insufficient permissions', 403);
  }

  const students = await Student.find({
    schoolId: req.user.schoolId,
    classId: classDoc._id,
    status: 'active',
  }).sort({ fullName: 1 });

  let doc;
  try {
    doc = await Gradebook.create({
      schoolId: req.user.schoolId,
      classId: classDoc._id,
      subjectId: subject._id,
      teacherId,
      term: req.body.term.trim(),
      academicYear,
      title: req.body.title.trim(),
      status: 'draft',
      entries: students.map((s) => ({
        studentId: s._id,
        score: null,
        maxScore: Number(req.body.maxScore) || 100,
        remark: '',
      })),
    });
  } catch (err) {
    if (err?.code === 11000) {
      throw new AppError('A gradebook with this title already exists for the class/subject/term', 409);
    }
    throw err;
  }

  const populated = await populateGradebook(doc._id);
  await writeAudit({
    schoolId: req.user.schoolId,
    actorId: req.user._id,
    action: 'create_gradebook',
    entity: 'Gradebook',
    entityId: doc._id,
    after: { title: doc.title, classId: doc.classId, subjectId: doc.subjectId },
    ip: req.ip,
  });

  res.status(201).json({ success: true, data: serialize(populated) });
});

export const updateEntries = asyncHandler(async (req, res) => {
  const doc = await Gradebook.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!doc) throw new AppError('Gradebook not found', 404);
  if (doc.status !== 'draft') throw new AppError('Gradebook is locked and cannot be edited', 400);
  if (req.user.role === 'teacher' && doc.teacherId.toString() !== req.user._id.toString()) {
    throw new AppError('Insufficient permissions', 403);
  }

  const incoming = req.body.entries;
  if (!Array.isArray(incoming)) throw new AppError('entries array required', 400);

  const map = new Map(incoming.map((e) => [e.studentId.toString(), e]));
  doc.entries = doc.entries.map((entry) => {
    const next = map.get(entry.studentId.toString());
    if (!next) return entry;
    return {
      studentId: entry.studentId,
      score: next.score == null || next.score === '' ? null : Number(next.score),
      maxScore: next.maxScore != null ? Number(next.maxScore) : entry.maxScore,
      remark: next.remark != null ? String(next.remark) : entry.remark,
    };
  });

  await doc.save();
  const populated = await populateGradebook(doc._id);
  res.json({ success: true, data: serialize(populated) });
});

export const submitGradebook = asyncHandler(async (req, res) => {
  const doc = await Gradebook.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!doc) throw new AppError('Gradebook not found', 404);
  if (doc.status !== 'draft') throw new AppError('Only draft gradebooks can be submitted', 400);
  if (req.user.role === 'teacher' && doc.teacherId.toString() !== req.user._id.toString()) {
    throw new AppError('Insufficient permissions', 403);
  }

  const missing = doc.entries.filter((e) => e.score == null || Number.isNaN(e.score));
  if (missing.length) {
    throw new AppError(`Enter scores for all students (${missing.length} missing)`, 400);
  }

  doc.status = 'locked';
  doc.submittedAt = new Date();
  await doc.save();

  await writeAudit({
    schoolId: req.user.schoolId,
    actorId: req.user._id,
    action: 'submit_gradebook',
    entity: 'Gradebook',
    entityId: doc._id,
    after: { status: 'locked' },
    ip: req.ip,
  });

  dashboardBus.notify(req.user.schoolId, { type: 'gradebook' });
  const populated = await populateGradebook(doc._id);
  res.json({ success: true, data: serialize(populated), message: 'Gradebook locked for admin review' });
});

export const unlockGradebook = asyncHandler(async (req, res) => {
  const doc = await Gradebook.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!doc) throw new AppError('Gradebook not found', 404);
  if (doc.status === 'released') {
    throw new AppError('Released gradebooks cannot be unlocked; create a new assessment', 400);
  }
  if (doc.status !== 'locked') throw new AppError('Only locked gradebooks can be unlocked', 400);

  doc.status = 'draft';
  doc.submittedAt = undefined;
  await doc.save();

  await writeAudit({
    schoolId: req.user.schoolId,
    actorId: req.user._id,
    action: 'unlock_gradebook',
    entity: 'Gradebook',
    entityId: doc._id,
    after: { status: 'draft' },
    ip: req.ip,
  });

  dashboardBus.notify(req.user.schoolId, { type: 'gradebook' });
  const populated = await populateGradebook(doc._id);
  res.json({ success: true, data: serialize(populated) });
});

export const masterGrid = asyncHandler(async (req, res) => {
  const { classId, term, academicYear } = req.query;
  if (!classId || !term) throw new AppError('classId and term are required', 400);

  const settings = await SystemSettings.findOne({ schoolId: req.user.schoolId });
  const year = academicYear || settings?.academicYear || '2025-2026';

  const [classDoc, gradebooks, students] = await Promise.all([
    ClassModel.findOne({ _id: classId, schoolId: req.user.schoolId }),
    Gradebook.find({
      schoolId: req.user.schoolId,
      classId,
      term,
      academicYear: year,
    })
      .populate('subjectId', 'name code')
      .populate('teacherId', 'fullName'),
    Student.find({ schoolId: req.user.schoolId, classId, status: 'active' }).sort({ fullName: 1 }),
  ]);

  if (!classDoc) throw new AppError('Class not found', 404);

  const allLockedOrReleased =
    gradebooks.length > 0 && gradebooks.every((g) => g.status === 'locked' || g.status === 'released');
  const allReleased = gradebooks.length > 0 && gradebooks.every((g) => g.status === 'released');

  res.json({
    success: true,
    data: {
      class: { id: classDoc._id, name: classDoc.name },
      term,
      academicYear: year,
      canRelease: allLockedOrReleased && !allReleased,
      allReleased,
      subjects: gradebooks.map((g) => ({
        id: g._id,
        subjectName: g.subjectId?.name,
        subjectCode: g.subjectId?.code,
        teacherName: g.teacherId?.fullName,
        title: g.title,
        status: g.status,
        submittedAt: g.submittedAt,
        releasedAt: g.releasedAt,
      })),
      students: students.map((s) => ({
        id: s._id,
        studentId: s.studentId,
        fullName: s.fullName,
        scores: gradebooks.map((g) => {
          const entry = g.entries.find((e) => e.studentId.toString() === s._id.toString());
          return {
            gradebookId: g._id,
            subjectCode: g.subjectId?.code,
            score: entry?.score ?? null,
            maxScore: entry?.maxScore ?? 100,
            status: g.status,
          };
        }),
      })),
    },
  });
});

export const releaseClassResults = asyncHandler(async (req, res) => {
  const { classId, term, academicYear } = req.body;
  if (!classId || !term) throw new AppError('classId and term are required', 400);

  const settings = await SystemSettings.findOne({ schoolId: req.user.schoolId });
  const year = academicYear || settings?.academicYear || '2025-2026';

  const gradebooks = await Gradebook.find({
    schoolId: req.user.schoolId,
    classId,
    term,
    academicYear: year,
  });

  if (!gradebooks.length) throw new AppError('No gradebooks found for this class/term', 404);

  const notReady = gradebooks.filter((g) => g.status === 'draft');
  if (notReady.length) {
    throw new AppError(
      `${notReady.length} subject gradebook(s) still in draft. All must be submitted first.`,
      400
    );
  }

  const now = new Date();
  await Gradebook.updateMany(
    {
      schoolId: req.user.schoolId,
      classId,
      term,
      academicYear: year,
      status: 'locked',
    },
    { $set: { status: 'released', releasedAt: now, releasedBy: req.user._id } }
  );

  await writeAudit({
    schoolId: req.user.schoolId,
    actorId: req.user._id,
    action: 'release_class_results',
    entity: 'Gradebook',
    entityId: classId,
    after: { classId, term, academicYear: year, count: gradebooks.length },
    ip: req.ip,
  });

  dashboardBus.notify(req.user.schoolId, { type: 'gradebook' });
  res.json({ success: true, message: 'Class results released to student portal' });
});

export const myReportCard = asyncHandler(async (req, res) => {
  if (req.user.role !== 'student') throw new AppError('Students only', 403);

  const student = await Student.findOne({
    schoolId: req.user.schoolId,
    $or: [{ userId: req.user._id }, { _id: req.user.studentRef }],
  }).populate('classId', 'name');

  if (!student) throw new AppError('Student profile not linked', 404);

  const filter = {
    schoolId: req.user.schoolId,
    status: 'released',
    'entries.studentId': student._id,
  };
  if (req.query.term) filter.term = req.query.term;
  if (req.query.academicYear) filter.academicYear = req.query.academicYear;

  const gradebooks = await Gradebook.find(filter)
    .populate('subjectId', 'name code')
    .populate('classId', 'name')
    .sort({ term: 1, title: 1 });

  const subjects = gradebooks.map((g) => {
    const entry = g.entries.find((e) => e.studentId.toString() === student._id.toString());
    const percent =
      entry?.score != null && entry.maxScore
        ? Math.round((Number(entry.score) / Number(entry.maxScore)) * 1000) / 10
        : null;
    return {
      gradebookId: g._id,
      subjectName: g.subjectId?.name,
      subjectCode: g.subjectId?.code,
      title: g.title,
      term: g.term,
      academicYear: g.academicYear,
      score: entry?.score ?? null,
      maxScore: entry?.maxScore ?? 100,
      remark: entry?.remark || '',
      percent,
      releasedAt: g.releasedAt,
    };
  });

  const scored = subjects.filter((s) => s.percent != null);
  const gpa =
    scored.length > 0
      ? Math.round((scored.reduce((sum, s) => sum + s.percent, 0) / scored.length) * 10) / 10
      : null;

  res.json({
    success: true,
    data: {
      student: {
        id: student._id,
        studentId: student.studentId,
        fullName: student.fullName,
        className: student.classId?.name,
      },
      subjects,
      averagePercent: gpa,
    },
  });
});

export const downloadReportCardPdf = asyncHandler(async (req, res) => {
  if (req.user.role !== 'student' && req.user.role !== 'super_admin') {
    throw new AppError('Insufficient permissions', 403);
  }

  let student;
  if (req.user.role === 'student') {
    student = await Student.findOne({
      schoolId: req.user.schoolId,
      $or: [{ userId: req.user._id }, { _id: req.user.studentRef }],
    }).populate('classId', 'name');
  } else {
    student = await Student.findOne({
      _id: req.params.studentId,
      schoolId: req.user.schoolId,
    }).populate('classId', 'name');
  }
  if (!student) throw new AppError('Student not found', 404);

  const school = await School.findById(req.user.schoolId);
  const filter = {
    schoolId: req.user.schoolId,
    status: 'released',
    'entries.studentId': student._id,
  };
  if (req.query.term) filter.term = req.query.term;

  const gradebooks = await Gradebook.find(filter)
    .populate('subjectId', 'name code')
    .sort({ term: 1, title: 1 });

  const doc = new PDFDocument({ margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="report-card-${student.studentId}.pdf"`
  );
  doc.pipe(res);

  doc.fontSize(18).text(school?.name || 'Smart School', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(14).text('Official Report Card', { align: 'center' });
  doc.moveDown();
  doc.fontSize(11).text(`Student: ${student.fullName}`);
  doc.text(`ID: ${student.studentId}`);
  doc.text(`Class: ${student.classId?.name || '—'}`);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`);
  doc.moveDown();

  doc.fontSize(10);
  doc.text('Subject', 50, doc.y, { continued: false, width: 180 });
  let y = doc.y;
  doc.text('Term', 230, y);
  doc.text('Score', 300, y);
  doc.text('%', 370, y);
  doc.moveDown(0.3);
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(0.5);

  let total = 0;
  let count = 0;
  for (const g of gradebooks) {
    const entry = g.entries.find((e) => e.studentId.toString() === student._id.toString());
    const percent =
      entry?.score != null && entry.maxScore
        ? Math.round((Number(entry.score) / Number(entry.maxScore)) * 1000) / 10
        : null;
    if (percent != null) {
      total += percent;
      count += 1;
    }
    const lineY = doc.y;
    doc.text(g.subjectId?.name || g.title, 50, lineY, { width: 170 });
    doc.text(g.term, 230, lineY);
    doc.text(
      entry?.score != null ? `${entry.score}/${entry.maxScore}` : '—',
      300,
      lineY
    );
    doc.text(percent != null ? String(percent) : '—', 370, lineY);
    doc.moveDown();
  }

  doc.moveDown();
  if (count) {
    doc.fontSize(12).text(`Average: ${Math.round((total / count) * 10) / 10}%`);
  } else {
    doc.text('No released results yet.');
  }

  doc.end();
});
