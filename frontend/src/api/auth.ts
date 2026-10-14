import { apiClient } from './client';
import type { CurrentUserResponse, LoginResponse } from '../types/api';

export async function loginRequest(email: string, password: string): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/login', { email, password });
  return response.data;
}

export async function currentUserRequest(): Promise<CurrentUserResponse> {
  const response = await apiClient.get<CurrentUserResponse>('/user');
  return response.data;
}

export async function logoutRequest(): Promise<void> {
  await apiClient.post('/logout');
}
