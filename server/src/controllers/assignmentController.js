import { body } from 'express-validator';
import { TeacherAssignment } from '../models/TeacherAssignment.js';
import { User } from '../models/User.js';
import { ClassModel } from '../models/Class.js';
import { Subject } from '../models/Subject.js';
import { SystemSettings } from '../models/SystemSettings.js';
import { AppError, asyncHandler } from '../middleware/error.js';
import { writeAudit } from '../services/audit.js';

export const assignmentValidators = [
  body('teacherId').notEmpty(),
  body('classId').notEmpty(),
  body('subjectId').notEmpty(),
];

function serialize(doc) {
  return {
    id: doc._id,
    teacherId: doc.teacherId?._id || doc.teacherId,
    teacherName: doc.teacherId?.fullName,
    classId: doc.classId?._id || doc.classId,
    className: doc.classId?.name,
    subjectId: doc.subjectId?._id || doc.subjectId,
    subjectName: doc.subjectId?.name,
    subjectCode: doc.subjectId?.code,
    academicYear: doc.academicYear,
    createdAt: doc.createdAt,
  };
}

export const listAssignments = asyncHandler(async (req, res) => {
  const filter = { schoolId: req.user.schoolId };
  if (req.query.teacherId) filter.teacherId = req.query.teacherId;
  if (req.query.classId) filter.classId = req.query.classId;

  if (req.user.role === 'teacher') {
    filter.teacherId = req.user._id;
  }

  const docs = await TeacherAssignment.find(filter)
    .populate('teacherId', 'fullName username')
    .populate('classId', 'name')
    .populate('subjectId', 'name code')
    .sort({ createdAt: -1 });

  res.json({ success: true, data: docs.map(serialize) });
});

export const createAssignment = asyncHandler(async (req, res) => {
  const settings = await SystemSettings.findOne({ schoolId: req.user.schoolId });
  const academicYear = req.body.academicYear || settings?.academicYear || '2025-2026';

  const [teacher, classDoc, subject] = await Promise.all([
    User.findOne({
      _id: req.body.teacherId,
      schoolId: req.user.schoolId,
      role: 'teacher',
      status: 'active',
    }),
    ClassModel.findOne({ _id: req.body.classId, schoolId: req.user.schoolId }),
    Subject.findOne({ _id: req.body.subjectId, schoolId: req.user.schoolId }),
  ]);

  if (!teacher) throw new AppError('Active teacher not found', 404);
  if (!classDoc) throw new AppError('Class not found', 404);
  if (!subject) throw new AppError('Subject not found', 404);

  const exists = await TeacherAssignment.findOne({
    schoolId: req.user.schoolId,
    teacherId: teacher._id,
    classId: classDoc._id,
    subjectId: subject._id,
    academicYear,
  });
  if (exists) throw new AppError('Assignment already exists', 409);

  const doc = await TeacherAssignment.create({
    schoolId: req.user.schoolId,
    teacherId: teacher._id,
    classId: classDoc._id,
    subjectId: subject._id,
    academicYear,
  });

  const populated = await TeacherAssignment.findById(doc._id)
    .populate('teacherId', 'fullName username')
    .populate('classId', 'name')
    .populate('subjectId', 'name code');

  await writeAudit({
    schoolId: req.user.schoolId,
    actorId: req.user._id,
    action: 'create_assignment',
    entity: 'TeacherAssignment',
    entityId: doc._id,
    after: serialize(populated),
    ip: req.ip,
  });

  res.status(201).json({ success: true, data: serialize(populated) });
});

export const deleteAssignment = asyncHandler(async (req, res) => {
  const doc = await TeacherAssignment.findOneAndDelete({
    _id: req.params.id,
    schoolId: req.user.schoolId,
  });
  if (!doc) throw new AppError('Assignment not found', 404);

  await writeAudit({
    schoolId: req.user.schoolId,
    actorId: req.user._id,
    action: 'delete_assignment',
    entity: 'TeacherAssignment',
    entityId: doc._id,
    before: { teacherId: doc.teacherId, classId: doc.classId, subjectId: doc.subjectId },
    ip: req.ip,
  });

  res.json({ success: true, message: 'Assignment removed' });
});
