import { validationResult } from 'express-validator';
import { AppError } from './error.js';

export function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError('Validation failed', 422, errors.array()));
  }
  next();
}
