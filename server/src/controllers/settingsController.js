import { body } from 'express-validator';
import { SystemSettings } from '../models/SystemSettings.js';
import { School } from '../models/School.js';
import { AppError, asyncHandler } from '../middleware/error.js';
import { writeAudit } from '../services/audit.js';

export const updateSettingsValidators = [
  body('teacherCutoffTime')
    .optional()
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('Use HH:MM 24h format'),
  body('currency').optional().isString().isLength({ min: 3, max: 3 }),
  body('academicYear').optional().isString(),
  body('schoolName').optional().isString().trim().notEmpty(),
  body('monthlyTuition').optional().isFloat({ min: 0 }),
];

function serialize(settings, school) {
  return {
    schoolName: school.name,
    schoolCode: school.code,
    teacherCutoffTime: settings.teacherCutoffTime,
    currency: settings.currency,
    academicYear: settings.academicYear,
    monthlyTuition: settings.monthlyTuition ?? 100,
  };
}

export const getSettings = asyncHandler(async (req, res) => {
  const settings = await SystemSettings.findOne({ schoolId: req.user.schoolId });
  const school = await School.findById(req.user.schoolId);
  if (!settings || !school) throw new AppError('Settings not found', 404);
  res.json({ success: true, data: serialize(settings, school) });
});

export const updateSettings = asyncHandler(async (req, res) => {
  const settings = await SystemSettings.findOne({ schoolId: req.user.schoolId });
  const school = await School.findById(req.user.schoolId);
  if (!settings || !school) throw new AppError('Settings not found', 404);

  const before = serialize(settings, school);

  if (req.body.teacherCutoffTime) settings.teacherCutoffTime = req.body.teacherCutoffTime;
  if (req.body.currency) settings.currency = req.body.currency.toUpperCase();
  if (req.body.academicYear) settings.academicYear = req.body.academicYear;
  if (req.body.schoolName) school.name = req.body.schoolName;
  if (req.body.monthlyTuition != null) settings.monthlyTuition = Number(req.body.monthlyTuition);

  await settings.save();
  await school.save();

  await writeAudit({
    schoolId: req.user.schoolId,
    actorId: req.user._id,
    action: 'update_settings',
    entity: 'SystemSettings',
    entityId: settings._id,
    before,
    after: serialize(settings, school),
    ip: req.ip,
  });

  res.json({ success: true, data: serialize(settings, school) });
});
