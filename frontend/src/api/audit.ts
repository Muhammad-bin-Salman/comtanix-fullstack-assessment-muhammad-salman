import { apiClient } from './client';
import type { AuditEventResponse } from '../types/api';

export async function listQuoteAuditEvents(quoteId: number): Promise<AuditEventResponse> {
  const response = await apiClient.get<AuditEventResponse>(`/quote-requests/${quoteId}/audit-events`, {
    params: { page: 1, per_page: 100 },
  });
  return response.data;
}
