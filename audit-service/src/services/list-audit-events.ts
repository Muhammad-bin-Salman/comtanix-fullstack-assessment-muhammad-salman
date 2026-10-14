import type { FilterQuery } from 'mongoose';
import { AuditEvent, type AuditEventDocument } from '../models/audit-event';
import type { ListEventsQuery } from '../validation/list-events';

export type AuditEventResponse = {
  eventId: string;
  type: string;
  quoteRequestId: number;
  actorId: number | null;
  data: Record<string, unknown>;
  occurredAt: string;
};

export type PaginatedAuditEvents = {
  data: AuditEventResponse[];
  meta: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
};

export async function listAuditEvents(query: ListEventsQuery): Promise<PaginatedAuditEvents> {
  const filter: FilterQuery<AuditEventDocument> = {};

  if (query.quoteRequestId !== undefined) {
    filter.quoteRequestId = query.quoteRequestId;
  }

  if (query.type !== undefined) {
    filter.type = query.type;
  }

  const skip = (query.page - 1) * query.per_page;
  const [events, total] = await Promise.all([
    AuditEvent.find(filter)
      .sort({ occurredAt: -1, createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(query.per_page)
      .lean(),
    AuditEvent.countDocuments(filter),
  ]);

  return {
    data: events.map((event) => ({
      eventId: event.eventId,
      type: event.type,
      quoteRequestId: event.quoteRequestId,
      actorId: event.actorId,
      data: event.data,
      occurredAt: event.occurredAt.toISOString(),
    })),
    meta: {
      page: query.page,
      per_page: query.per_page,
      total,
      total_pages: Math.ceil(total / query.per_page),
    },
  };
}
