import { AuditEvent } from '../models/audit-event';
import type { AuditEventPayload } from '../types/audit-event';

export type StoreResult = 'stored' | 'duplicate';

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 11000;
}

export async function storeAuditEvent(payload: AuditEventPayload): Promise<StoreResult> {
  try {
    await AuditEvent.create({
      ...payload,
      occurredAt: new Date(payload.occurredAt),
    });

    return 'stored';
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return 'duplicate';
    }

    throw error;
  }
}
