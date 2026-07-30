import { body } from 'express-validator';
import { Student } from '../models/Student.js';
import { ClassModel } from '../models/Class.js';
import { User } from '../models/User.js';
import { AppError, asyncHandler } from '../middleware/error.js';
import { writeAudit } from '../services/audit.js';

export const studentValidators = [
  body('studentId').trim().notEmpty(),
  body('fullName').trim().notEmpty(),
  body('feeTag').isIn(['standard', 'scholarship', 'discounted']),
  body('parent.primaryPhone').trim().notEmpty().withMessage('Primary phone is required'),
  body('classId').optional({ nullable: true }),
  body('discountType').optional({ nullable: true }).isIn(['percent', 'amount', null]),
  body('discountValue').optional({ nullable: true }).isFloat({ min: 0 }),
];

function serialize(doc, includeTemp = null) {
  const data = {
    id: doc._id,
    studentId: doc.studentId,
    fullName: doc.fullName,
    dateOfBirth: doc.dateOfBirth,
    gender: doc.gender,
    classId: doc.classId?._id || doc.classId || null,
    className: doc.classId?.name || null,
    parent: doc.parent,
    feeTag: doc.feeTag,
    discountType: doc.discountType,
    discountValue: doc.discountValue,
    status: doc.status,
    userId: doc.userId,
    createdAt: doc.createdAt,
  };
  if (includeTemp) data.temporaryPassword = includeTemp;
  return data;
}

function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let out = '';
  for (let i = 0; i < 12; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export const listStudents = asyncHandler(async (req, res) => {
  const filter = { schoolId: req.user.schoolId };
  if (req.query.classId) filter.classId = req.query.classId;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.feeTag) filter.feeTag = req.query.feeTag;
  if (req.query.q) {
    const q = req.query.q.trim();
    filter.$or = [
      { fullName: new RegExp(q, 'i') },
      { studentId: new RegExp(q, 'i') },
    ];
  }

  const students = await Student.find(filter)
    .populate('classId', 'name')
    .sort({ fullName: 1 });

  res.json({ success: true, data: students.map((s) => serialize(s)) });
});

export const getStudent = asyncHandler(async (req, res) => {
  const student = await Student.findOne({
    _id: req.params.id,
    schoolId: req.user.schoolId,
  }).populate('classId', 'name');

  if (!student) throw new AppError('Student not found', 404);

  if (req.user.role === 'student' && !student.userId?.equals?.(req.user._id) && !student._id.equals(req.user.studentRef)) {
    throw new AppError('Insufficient permissions', 403);
  }

  res.json({ success: true, data: serialize(student) });
});

export const createStudent = asyncHandler(async (req, res) => {
  const studentId = req.body.studentId.trim().toUpperCase();
  const exists = await Student.findOne({ schoolId: req.user.schoolId, studentId });
  if (exists) throw new AppError('Student ID already exists', 409);

  if (req.body.classId) {
    const classDoc = await ClassModel.findOne({
      _id: req.body.classId,
      schoolId: req.user.schoolId,
    });
    if (!classDoc) throw new AppError('Class not found', 404);
  }

  if (req.body.feeTag === 'discounted') {
    if (!req.body.discountType || req.body.discountValue == null) {
      throw new AppError('Discounted students require discountType and discountValue', 400);
    }
  }

  const createPortal = req.body.createPortal !== false;
  let tempPassword = null;
  let userId = null;

  if (createPortal) {
    const username = studentId.toLowerCase();
    const userExists = await User.findOne({ schoolId: req.user.schoolId, username });
    if (userExists) throw new AppError('A user with this student ID username already exists', 409);

    tempPassword = generateTempPassword();
    const portalUser = await User.create({
      schoolId: req.user.schoolId,
      username,
      fullName: req.body.fullName.trim(),
      role: 'student',
      status: 'active',
      mustChangePassword: true,
      passwordHash: await User.hashPassword(tempPassword),
      phone: req.body.parent?.primaryPhone,
    });
    userId = portalUser._id;
  }

  const student = await Student.create({
    schoolId: req.user.schoolId,
    studentId,
    fullName: req.body.fullName.trim(),
    dateOfBirth: req.body.dateOfBirth || undefined,
    gender: req.body.gender || '',
    classId: req.body.classId || undefined,
    parent: {
      fullName: req.body.parent?.fullName?.trim() || '',
      primaryPhone: req.body.parent.primaryPhone.trim(),
      secondaryPhone: req.body.parent?.secondaryPhone?.trim() || '',
      whatsappNumber: req.body.parent?.whatsappNumber?.trim() || '',
      relationship: req.body.parent?.relationship?.trim() || 'Parent',
    },
    feeTag: req.body.feeTag,
    discountType: req.body.feeTag === 'discounted' ? req.body.discountType : null,
    discountValue: req.body.feeTag === 'discounted' ? Number(req.body.discountValue) : 0,
    status: 'active',
    userId,
  });

  if (userId) {
    await User.findByIdAndUpdate(userId, { studentRef: student._id });
  }

  const populated = await Student.findById(student._id).populate('classId', 'name');

  await writeAudit({
    schoolId: req.user.schoolId,
    actorId: req.user._id,
    action: 'create_student',
    entity: 'Student',
    entityId: student._id,
    after: serialize(populated),
    ip: req.ip,
  });

  res.status(201).json({ success: true, data: serialize(populated, tempPassword) });
});

export const updateStudent = asyncHandler(async (req, res) => {
  const student = await Student.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!student) throw new AppError('Student not found', 404);

  const before = serialize(student);

  if (req.body.fullName !== undefined) student.fullName = req.body.fullName.trim();
  if (req.body.dateOfBirth !== undefined) student.dateOfBirth = req.body.dateOfBirth || null;
  if (req.body.gender !== undefined) student.gender = req.body.gender;
  if (req.body.status !== undefined) student.status = req.body.status;

  if (req.body.classId !== undefined) {
    if (req.body.classId) {
      const classDoc = await ClassModel.findOne({
        _id: req.body.classId,
        schoolId: req.user.schoolId,
      });
      if (!classDoc) throw new AppError('Class not found', 404);
      student.classId = classDoc._id;
    } else {
      student.classId = undefined;
    }
  }

  if (req.body.parent) {
    student.parent = {
      fullName: req.body.parent.fullName?.trim() || student.parent?.fullName || '',
      primaryPhone: req.body.parent.primaryPhone?.trim() || student.parent.primaryPhone,
      secondaryPhone: req.body.parent.secondaryPhone?.trim() || '',
      whatsappNumber: req.body.parent.whatsappNumber?.trim() || '',
      relationship: req.body.parent.relationship?.trim() || 'Parent',
    };
  }

  if (req.body.feeTag !== undefined) {
    student.feeTag = req.body.feeTag;
    if (req.body.feeTag === 'discounted') {
      student.discountType = req.body.discountType || student.discountType;
      student.discountValue =
        req.body.discountValue != null ? Number(req.body.discountValue) : student.discountValue;
      if (!student.discountType || student.discountValue == null) {
        throw new AppError('Discounted students require discountType and discountValue', 400);
      }
    } else {
      student.discountType = null;
      student.discountValue = 0;
    }
  }

  await student.save();
  const populated = await Student.findById(student._id).populate('classId', 'name');

  await writeAudit({
    schoolId: req.user.schoolId,
    actorId: req.user._id,
    action: 'update_student',
    entity: 'Student',
    entityId: student._id,
    before,
    after: serialize(populated),
    ip: req.ip,
  });

  res.json({ success: true, data: serialize(populated) });
});

export const getMyStudentProfile = asyncHandler(async (req, res) => {
  if (req.user.role !== 'student') throw new AppError('Students only', 403);

  const student = await Student.findOne({
    schoolId: req.user.schoolId,
    $or: [{ userId: req.user._id }, { _id: req.user.studentRef }],
  }).populate('classId', 'name');

  if (!student) throw new AppError('Student profile not linked', 404);
  res.json({ success: true, data: serialize(student) });
});
