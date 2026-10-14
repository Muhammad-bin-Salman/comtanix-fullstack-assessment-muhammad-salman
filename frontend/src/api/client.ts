import axios from 'axios';
import { announceUnauthorized, clearStoredToken, getStoredToken } from '../auth/storage';
import { environment } from '../config/environment';

export const apiClient = axios.create({
  baseURL: environment.apiBaseUrl,
  headers: {
    Accept: 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = getStoredToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401 && getStoredToken()) {
      clearStoredToken();
      announceUnauthorized();
    }

    return Promise.reject(error);
  },
);
