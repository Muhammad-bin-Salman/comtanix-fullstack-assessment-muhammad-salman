const tokenKey = 'comtanix_auth_token';

export const unauthorizedEventName = 'comtanix:unauthorized';

export function getStoredToken(): string | null {
  return sessionStorage.getItem(tokenKey);
}

export function storeToken(token: string): void {
  sessionStorage.setItem(tokenKey, token);
}

export function clearStoredToken(): void {
  sessionStorage.removeItem(tokenKey);
}

export function announceUnauthorized(): void {
  window.dispatchEvent(new Event(unauthorizedEventName));
}
