export const auditEventTypes = [
  'quote.created',
  'quote.status_changed',
  'quote.assigned',
] as const;

export type AuditEventType = (typeof auditEventTypes)[number];

export type AuditEventPayload = {
  eventId: string;
  type: AuditEventType;
  quoteRequestId: number;
  actorId: number | null;
  data: Record<string, unknown>;
  occurredAt: string;
};
