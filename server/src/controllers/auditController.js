import { AuditLog } from '../models/AuditLog.js';
import { asyncHandler } from '../middleware/error.js';

export const listAuditLogs = asyncHandler(async (req, res) => {
  const filter = { schoolId: req.user.schoolId };
  if (req.query.action) filter.action = new RegExp(req.query.action, 'i');
  if (req.query.entity) filter.entity = req.query.entity;
  if (req.query.actorId) filter.actorId = req.query.actorId;

  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const skip = (page - 1) * limit;

  const [total, logs] = await Promise.all([
    AuditLog.countDocuments(filter),
    AuditLog.find(filter)
      .populate('actorId', 'fullName username role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
  ]);

  res.json({
    success: true,
    data: {
      total,
      page,
      limit,
      items: logs.map((log) => ({
        id: log._id,
        at: log.createdAt,
        actorName: log.actorId?.fullName,
        actorUsername: log.actorId?.username,
        actorRole: log.actorId?.role,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        before: log.before,
        after: log.after,
        ip: log.ip,
      })),
    },
  });
});
