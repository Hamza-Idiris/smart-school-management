import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { AppError, asyncHandler } from './error.js';

export function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      schoolId: user.schoolId.toString(),
      mustChangePassword: user.mustChangePassword,
    },
    env.accessSecret,
    { expiresIn: env.accessExpires }
  );
}

export function signRefreshToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), type: 'refresh' },
    env.refreshSecret,
    { expiresIn: env.refreshExpires }
  );
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function setRefreshCookie(res, token) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: env.nodeEnv === 'production' ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  });
}

export function clearRefreshCookie(res) {
  res.clearCookie('refreshToken', { path: '/api/auth' });
}

export const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new AppError('Authentication required', 401);
  }
  const token = header.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, env.accessSecret);
  } catch {
    throw new AppError('Invalid or expired access token', 401);
  }

  const user = await User.findById(payload.sub);
  if (!user || user.status !== 'active') {
    throw new AppError('Account inactive or not found', 401);
  }

  req.user = user;
  req.auth = payload;
  next();
});

export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError('Insufficient permissions', 403));
    }
    next();
  };
}

export function requirePasswordChanged(req, res, next) {
  if (req.user?.mustChangePassword) {
    return next(new AppError('Password change required before continuing', 403));
  }
  next();
}
