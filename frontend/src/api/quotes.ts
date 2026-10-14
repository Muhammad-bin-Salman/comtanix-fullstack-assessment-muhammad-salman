import { apiClient } from './client';
import type { PaginatedResponse, QuoteRequest } from '../types/api';

export type QuoteListParams = {
  search?: string;
  status?: string;
  assigned_user_id?: number;
  service_type?: string;
  sort_by: string;
  sort_direction: string;
  per_page: number;
  page: number;
};

export async function listQuoteRequests(
  params: QuoteListParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<QuoteRequest>> {
  const response = await apiClient.get<PaginatedResponse<QuoteRequest>>('/quote-requests', {
    params,
    signal,
  });

  return response.data;
}
