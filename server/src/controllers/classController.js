import { body } from 'express-validator';
import { ClassModel } from '../models/Class.js';
import { SystemSettings } from '../models/SystemSettings.js';
import { AppError, asyncHandler } from '../middleware/error.js';
import { writeAudit } from '../services/audit.js';

export const classValidators = [
  body('name').trim().notEmpty(),
  body('gradeLevel').optional({ nullable: true }).isString(),
  body('section').optional({ nullable: true }).isString(),
  body('academicYear').optional({ nullable: true }).isString(),
];

function serialize(doc) {
  return {
    id: doc._id,
    name: doc.name,
    gradeLevel: doc.gradeLevel,
    section: doc.section,
    academicYear: doc.academicYear,
    isActive: doc.isActive,
    createdAt: doc.createdAt,
  };
}

export const listClasses = asyncHandler(async (req, res) => {
  const filter = { schoolId: req.user.schoolId };
  if (req.query.active !== 'false') filter.isActive = true;
  const classes = await ClassModel.find(filter).sort({ name: 1 });
  res.json({ success: true, data: classes.map(serialize) });
});

export const createClass = asyncHandler(async (req, res) => {
  const settings = await SystemSettings.findOne({ schoolId: req.user.schoolId });
  const academicYear = req.body.academicYear || settings?.academicYear || '2025-2026';

  const exists = await ClassModel.findOne({
    schoolId: req.user.schoolId,
    name: req.body.name.trim(),
    academicYear,
  });
  if (exists) throw new AppError('Class already exists for this academic year', 409);

  const doc = await ClassModel.create({
    schoolId: req.user.schoolId,
    name: req.body.name.trim(),
    gradeLevel: req.body.gradeLevel?.trim() || '',
    section: req.body.section?.trim() || '',
    academicYear,
    isActive: true,
  });

  await writeAudit({
    schoolId: req.user.schoolId,
    actorId: req.user._id,
    action: 'create_class',
    entity: 'Class',
    entityId: doc._id,
    after: serialize(doc),
    ip: req.ip,
  });

  res.status(201).json({ success: true, data: serialize(doc) });
});

export const updateClass = asyncHandler(async (req, res) => {
  const doc = await ClassModel.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!doc) throw new AppError('Class not found', 404);

  const before = serialize(doc);
  if (req.body.name !== undefined) doc.name = req.body.name.trim();
  if (req.body.gradeLevel !== undefined) doc.gradeLevel = req.body.gradeLevel.trim();
  if (req.body.section !== undefined) doc.section = req.body.section.trim();
  if (req.body.academicYear !== undefined) doc.academicYear = req.body.academicYear.trim();
  if (req.body.isActive !== undefined) doc.isActive = Boolean(req.body.isActive);
  await doc.save();

  await writeAudit({
    schoolId: req.user.schoolId,
    actorId: req.user._id,
    action: 'update_class',
    entity: 'Class',
    entityId: doc._id,
    before,
    after: serialize(doc),
    ip: req.ip,
  });

  res.json({ success: true, data: serialize(doc) });
});
