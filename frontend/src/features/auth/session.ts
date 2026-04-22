const AUTH_TOKEN_KEY = "bobooks_auth_token";
const AUTH_EMAIL_KEY = "bobooks_auth_email";
const AUTH_USER_ID_KEY = "bobooks_auth_user_id";

export type AuthSession = {
  token: string;
  email: string;
  userId: number;
};

export function getAuthSession(): AuthSession | null {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const email = localStorage.getItem(AUTH_EMAIL_KEY);
  const userIdStr = localStorage.getItem(AUTH_USER_ID_KEY);

  if (!token || !email || !userIdStr) {
    return null;
  }

  const userId = Number.parseInt(userIdStr, 10);
  if (!Number.isFinite(userId)) {
    return null;
  }

  return { token, email, userId };
}

export function saveAuthSession(session: AuthSession): void {
  localStorage.setItem(AUTH_TOKEN_KEY, session.token);
  localStorage.setItem(AUTH_EMAIL_KEY, session.email);
  localStorage.setItem(AUTH_USER_ID_KEY, String(session.userId));
}

export function clearAuthSession(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_EMAIL_KEY);
  localStorage.removeItem(AUTH_USER_ID_KEY);
}
