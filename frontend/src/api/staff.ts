import { apiClient } from './client';
import type { StaffUser } from '../types/api';

export async function listStaffUsers(): Promise<StaffUser[]> {
  const response = await apiClient.get<{ data: StaffUser[] }>('/staff-users');
  return response.data.data;
}
