import { z } from 'zod';
import { auditEventTypes } from '../types/audit-event';

export const listEventsQuerySchema = z.object({
  quoteRequestId: z.coerce.number().int().positive().optional(),
  type: z.enum(auditEventTypes).optional(),
  page: z.coerce.number().int().positive().default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;
