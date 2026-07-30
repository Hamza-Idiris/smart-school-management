import { body } from 'express-validator';
import { User, ROLES } from '../models/User.js';
import { AppError, asyncHandler } from '../middleware/error.js';
import { writeAudit } from '../services/audit.js';

function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let out = '';
  for (let i = 0; i < 12; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function publicUser(user, includeTemp = null) {
  const base = {
    id: user._id,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    phone: user.phone,
    schoolId: user.schoolId,
    createdAt: user.createdAt,
  };
  if (includeTemp) base.temporaryPassword = includeTemp;
  return base;
}

export const createUserValidators = [
  body('username').trim().isLength({ min: 3 }).toLowerCase(),
  body('fullName').trim().notEmpty(),
  body('role').isIn(ROLES.filter((r) => r !== 'student')),
  body('email').optional({ nullable: true }).isEmail().normalizeEmail(),
  body('phone').optional({ nullable: true }).isString(),
];

export const listUsers = asyncHandler(async (req, res) => {
  const filter = { schoolId: req.user.schoolId };
  if (req.query.role) filter.role = req.query.role;
  if (req.query.status) filter.status = req.query.status;

  const users = await User.find(filter).sort({ createdAt: -1 }).select('-passwordHash -refreshTokens');
  res.json({
    success: true,
    data: users.map((u) => publicUser(u)),
  });
});

export const createUser = asyncHandler(async (req, res) => {
  const { username, email, fullName, role, phone } = req.body;
  const tempPassword = req.body.temporaryPassword || generateTempPassword();

  const exists = await User.findOne({
    schoolId: req.user.schoolId,
    $or: [{ username: username.toLowerCase() }, ...(email ? [{ email }] : [])],
  });
  if (exists) throw new AppError('Username or email already exists', 409);

  const user = await User.create({
    schoolId: req.user.schoolId,
    username: username.toLowerCase(),
    email: email || undefined,
    fullName,
    role,
    phone,
    passwordHash: await User.hashPassword(tempPassword),
    mustChangePassword: true,
    status: 'active',
  });

  await writeAudit({
    schoolId: req.user.schoolId,
    actorId: req.user._id,
    action: 'create_user',
    entity: 'User',
    entityId: user._id,
    after: { username: user.username, role: user.role },
    ip: req.ip,
  });

  res.status(201).json({
    success: true,
    data: publicUser(user, tempPassword),
  });
});

export const updateUserStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['active', 'deactivated'].includes(status)) {
    throw new AppError('Invalid status', 400);
  }

  const user = await User.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!user) throw new AppError('User not found', 404);
  if (user._id.equals(req.user._id)) throw new AppError('Cannot change your own status', 400);

  const before = { status: user.status };
  user.status = status;
  if (status === 'deactivated') {
    user.refreshTokens = [];
  }
  await user.save();

  await writeAudit({
    schoolId: req.user.schoolId,
    actorId: req.user._id,
    action: status === 'deactivated' ? 'deactivate_user' : 'activate_user',
    entity: 'User',
    entityId: user._id,
    before,
    after: { status: user.status },
    ip: req.ip,
  });

  res.json({ success: true, data: publicUser(user) });
});

export const resetUserPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!user) throw new AppError('User not found', 404);

  const tempPassword = generateTempPassword();
  user.passwordHash = await User.hashPassword(tempPassword);
  user.mustChangePassword = true;
  user.refreshTokens = [];
  await user.save();

  await writeAudit({
    schoolId: req.user.schoolId,
    actorId: req.user._id,
    action: 'reset_password',
    entity: 'User',
    entityId: user._id,
    ip: req.ip,
  });

  res.json({
    success: true,
    data: publicUser(user, tempPassword),
    message: 'Password reset. Share the temporary password securely.',
  });
});
