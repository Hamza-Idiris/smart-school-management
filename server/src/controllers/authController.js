import jwt from 'jsonwebtoken';
import { body } from 'express-validator';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import {
  signAccessToken,
  signRefreshToken,
  hashToken,
  setRefreshCookie,
  clearRefreshCookie,
} from '../middleware/auth.js';
import { AppError, asyncHandler } from '../middleware/error.js';
import { writeAudit } from '../services/audit.js';

const PASSWORD_RULE =
  /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export const loginValidators = [
  body('username').trim().notEmpty(),
  body('password').notEmpty(),
];

export const changePasswordValidators = [
  body('currentPassword').notEmpty(),
  body('newPassword')
    .matches(PASSWORD_RULE)
    .withMessage('Password must be 8+ chars with letter, number, and special character'),
];

function publicUser(user) {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    schoolId: user.schoolId,
    studentRef: user.studentRef,
  };
}

export const login = asyncHandler(async (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase();
  const { password } = req.body;

  const user = await User.findOne({ username });
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Invalid username or password', 401);
  }
  if (user.status !== 'active') {
    throw new AppError('Account is deactivated', 403);
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  const tokenHash = hashToken(refreshToken);
  const decoded = jwt.decode(refreshToken);

  user.refreshTokens.push({
    tokenHash,
    expiresAt: new Date(decoded.exp * 1000),
  });
  // keep last 5 refresh tokens
  if (user.refreshTokens.length > 5) {
    user.refreshTokens = user.refreshTokens.slice(-5);
  }
  user.lastLoginAt = new Date();
  await user.save();

  setRefreshCookie(res, refreshToken);
  await writeAudit({
    schoolId: user.schoolId,
    actorId: user._id,
    action: 'login',
    entity: 'User',
    entityId: user._id,
    ip: req.ip,
  });

  res.json({
    success: true,
    data: {
      accessToken,
      user: publicUser(user),
    },
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) throw new AppError('Refresh token missing', 401);

  let payload;
  try {
    payload = jwt.verify(token, env.refreshSecret);
  } catch {
    clearRefreshCookie(res);
    throw new AppError('Invalid refresh token', 401);
  }

  const tokenHash = hashToken(token);
  const user = await User.findById(payload.sub);
  if (!user || user.status !== 'active') {
    clearRefreshCookie(res);
    throw new AppError('Account inactive', 401);
  }

  const stored = user.refreshTokens.find((t) => t.tokenHash === tokenHash);
  if (!stored || stored.expiresAt < new Date()) {
    clearRefreshCookie(res);
    throw new AppError('Refresh token revoked', 401);
  }

  const accessToken = signAccessToken(user);
  const newRefresh = signRefreshToken(user);
  const newHash = hashToken(newRefresh);
  const decoded = jwt.decode(newRefresh);

  user.refreshTokens = user.refreshTokens.filter((t) => t.tokenHash !== tokenHash);
  user.refreshTokens.push({ tokenHash: newHash, expiresAt: new Date(decoded.exp * 1000) });
  await user.save();

  setRefreshCookie(res, newRefresh);
  res.json({ success: true, data: { accessToken, user: publicUser(user) } });
});

export const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (token && req.user) {
    const tokenHash = hashToken(token);
    req.user.refreshTokens = req.user.refreshTokens.filter((t) => t.tokenHash !== tokenHash);
    await req.user.save();
  }
  clearRefreshCookie(res);
  res.json({ success: true, message: 'Logged out' });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { user: publicUser(req.user) } });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = req.user;

  if (!(await user.comparePassword(currentPassword))) {
    throw new AppError('Current password is incorrect', 400);
  }

  user.passwordHash = await User.hashPassword(newPassword);
  user.mustChangePassword = false;
  user.refreshTokens = [];
  await user.save();

  await writeAudit({
    schoolId: user.schoolId,
    actorId: user._id,
    action: 'change_password',
    entity: 'User',
    entityId: user._id,
    ip: req.ip,
  });

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  const decoded = jwt.decode(refreshToken);
  user.refreshTokens.push({
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(decoded.exp * 1000),
  });
  await user.save();
  setRefreshCookie(res, refreshToken);

  res.json({
    success: true,
    message: 'Password updated',
    data: { accessToken, user: publicUser(user) },
  });
});
