import { apiClient } from './client';
import type { PublicQuotePayload, QuoteRequest, ResourceResponse } from '../types/api';

export async function submitPublicQuote(payload: PublicQuotePayload): Promise<QuoteRequest> {
  const response = await apiClient.post<ResourceResponse<QuoteRequest>>('/public/quote-requests', payload);
  return response.data.data;
}
