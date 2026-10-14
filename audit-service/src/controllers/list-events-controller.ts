import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../errors/http-error';
import { listAuditEvents } from '../services/list-audit-events';
import { listEventsQuerySchema } from '../validation/list-events';

export async function listEvents(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = listEventsQuerySchema.safeParse(request.query);

    if (!result.success) {
      throw new HttpError(422, 'The query parameters are invalid.', result.error.flatten().fieldErrors);
    }

    response.json(await listAuditEvents(result.data));
  } catch (error) {
    next(error);
  }
}
