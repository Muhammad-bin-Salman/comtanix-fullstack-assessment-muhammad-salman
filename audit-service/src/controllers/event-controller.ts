import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../errors/http-error';
import { storeAuditEvent } from '../services/store-audit-event';
import type { AuditEventPayload } from '../types/audit-event';
import { auditEventSchema } from '../validation/audit-event';

export async function storeEvent(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    let body: unknown;

    try {
      body = JSON.parse((request.body as Buffer).toString('utf8'));
    } catch {
      throw new HttpError(400, 'Malformed JSON.');
    }

    const result = auditEventSchema.safeParse(body);

    if (!result.success) {
      throw new HttpError(422, 'The event payload is invalid.', result.error.flatten().fieldErrors);
    }

    const payload = result.data as AuditEventPayload;
    const status = await storeAuditEvent(payload);

    response.status(status === 'stored' ? 201 : 200).json({
      status,
      eventId: payload.eventId,
    });
  } catch (error) {
    next(error);
  }
}
