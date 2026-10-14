import { z } from 'zod';
import { auditEventTypes } from '../types/audit-event';

export const auditEventSchema = z.object({
  eventId: z.uuid(),
  type: z.enum(auditEventTypes),
  quoteRequestId: z.number().int().positive(),
  actorId: z.number().int().positive().nullable(),
  data: z.record(z.string(), z.unknown()),
  occurredAt: z.iso.datetime({ offset: true }),
}).strict();
