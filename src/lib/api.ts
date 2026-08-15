import { supabase } from './supabase';

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown[];

  constructor(message: string, status: number = 500, code?: string, details?: unknown[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export async function authenticatedApi<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  // Admin console routes authenticate via the ADMIN_AUTH_SECRET stored by the
  // login screens (sessionStorage). Everything else uses the Supabase session.
  const adminSecret = sessionStorage.getItem('fmd_admin_secret');
  const token = path.startsWith('/api/admin') && adminSecret
    ? adminSecret
    : (session?.access_token || '');

  const response = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.error || payload.message || 'Request failed. Please try again.';
    throw new ApiError(message, response.status, payload.code, payload.details);
  }
  return payload as T;
}
