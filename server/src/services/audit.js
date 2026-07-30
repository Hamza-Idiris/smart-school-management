import { AuditLog } from '../models/AuditLog.js';

export async function writeAudit({
  schoolId,
  actorId,
  action,
  entity,
  entityId,
  before,
  after,
  meta,
  ip,
}) {
  try {
    await AuditLog.create({
      schoolId,
      actorId,
      action,
      entity,
      entityId: entityId?.toString?.() || entityId,
      before,
      after,
      meta,
      ip,
    });
  } catch (err) {
    console.error('Audit log failed', err.message);
  }
}
