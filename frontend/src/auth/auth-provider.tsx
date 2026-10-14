import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { currentUserRequest, loginRequest, logoutRequest } from '../api/auth';
import type { User } from '../types/api';
import { AuthContext } from './auth-context';
import {
  clearStoredToken,
  getStoredToken,
  storeToken,
  unauthorizedEventName,
} from './storage';

export function AuthProvider({ children }: PropsWithChildren) {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const clearAuthentication = useCallback(() => {
    clearStoredToken();
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    window.addEventListener(unauthorizedEventName, clearAuthentication);
    return () => window.removeEventListener(unauthorizedEventName, clearAuthentication);
  }, [clearAuthentication]);

  useEffect(() => {
    let active = true;

    if (!token) {
      setIsInitializing(false);
      return () => {
        active = false;
      };
    }

    setIsInitializing(true);
    currentUserRequest()
      .then(({ user: restoredUser }) => {
        if (active) {
          setUser(restoredUser);
        }
      })
      .catch(() => {
        if (active) {
          clearAuthentication();
        }
      })
      .finally(() => {
        if (active) {
          setIsInitializing(false);
        }
      });

    return () => {
      active = false;
    };
  }, [clearAuthentication, token]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await loginRequest(email, password);
    storeToken(response.token);
    setToken(response.token);
    setUser(response.user);
    setIsInitializing(false);
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      clearAuthentication();
    }
  }, [clearAuthentication]);

  const value = useMemo(() => ({
    user,
    token,
    isInitializing,
    login,
    logout,
  }), [isInitializing, login, logout, token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
