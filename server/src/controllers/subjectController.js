import { body } from 'express-validator';
import { Subject } from '../models/Subject.js';
import { AppError, asyncHandler } from '../middleware/error.js';
import { writeAudit } from '../services/audit.js';

export const subjectValidators = [
  body('name').trim().notEmpty(),
  body('code').trim().notEmpty(),
];

function serialize(doc) {
  return {
    id: doc._id,
    name: doc.name,
    code: doc.code,
    isActive: doc.isActive,
    createdAt: doc.createdAt,
  };
}

export const listSubjects = asyncHandler(async (req, res) => {
  const filter = { schoolId: req.user.schoolId };
  if (req.query.active !== 'false') filter.isActive = true;
  const subjects = await Subject.find(filter).sort({ name: 1 });
  res.json({ success: true, data: subjects.map(serialize) });
});

export const createSubject = asyncHandler(async (req, res) => {
  const code = req.body.code.trim().toUpperCase();
  const exists = await Subject.findOne({ schoolId: req.user.schoolId, code });
  if (exists) throw new AppError('Subject code already exists', 409);

  const doc = await Subject.create({
    schoolId: req.user.schoolId,
    name: req.body.name.trim(),
    code,
    isActive: true,
  });

  await writeAudit({
    schoolId: req.user.schoolId,
    actorId: req.user._id,
    action: 'create_subject',
    entity: 'Subject',
    entityId: doc._id,
    after: serialize(doc),
    ip: req.ip,
  });

  res.status(201).json({ success: true, data: serialize(doc) });
});

export const updateSubject = asyncHandler(async (req, res) => {
  const doc = await Subject.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!doc) throw new AppError('Subject not found', 404);

  const before = serialize(doc);
  if (req.body.name !== undefined) doc.name = req.body.name.trim();
  if (req.body.code !== undefined) doc.code = req.body.code.trim().toUpperCase();
  if (req.body.isActive !== undefined) doc.isActive = Boolean(req.body.isActive);
  await doc.save();

  await writeAudit({
    schoolId: req.user.schoolId,
    actorId: req.user._id,
    action: 'update_subject',
    entity: 'Subject',
    entityId: doc._id,
    before,
    after: serialize(doc),
    ip: req.ip,
  });

  res.json({ success: true, data: serialize(doc) });
});
