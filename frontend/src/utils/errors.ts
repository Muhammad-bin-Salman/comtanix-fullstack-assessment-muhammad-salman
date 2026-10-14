import axios from 'axios';
import type { ValidationErrorResponse } from '../types/api';

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError<ValidationErrorResponse>(error)) {
    return fallback;
  }

  if (!error.response) {
    return 'Unable to reach the API. Please check that the service is running.';
  }

  const validationMessage = Object.values(error.response.data.errors ?? {}).flat()[0];
  return validationMessage ?? error.response.data.message ?? fallback;
}
