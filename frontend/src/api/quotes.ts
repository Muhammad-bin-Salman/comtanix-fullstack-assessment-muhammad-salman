import { apiClient } from './client';
import type { PaginatedResponse, QuoteRequest, QuoteStatus, ResourceResponse } from '../types/api';

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

export async function getQuoteRequest(id: number): Promise<QuoteRequest> {
  const response = await apiClient.get<ResourceResponse<QuoteRequest>>(`/quote-requests/${id}`);
  return response.data.data;
}

export async function updateQuoteStatus(id: number, status: QuoteStatus): Promise<QuoteRequest> {
  const response = await apiClient.patch<ResourceResponse<QuoteRequest>>(`/quote-requests/${id}/status`, { status });
  return response.data.data;
}

export async function assignQuoteRequest(id: number, assignedUserId: number): Promise<QuoteRequest> {
  const response = await apiClient.patch<ResourceResponse<QuoteRequest>>(`/quote-requests/${id}/assign`, {
    assigned_user_id: assignedUserId,
  });
  return response.data.data;
}

export async function deleteQuoteRequest(id: number): Promise<void> {
  await apiClient.delete(`/quote-requests/${id}`);
}
