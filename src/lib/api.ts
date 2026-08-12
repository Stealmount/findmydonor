import { supabase } from './supabase';

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
  if (!response.ok) throw new Error(payload.error || 'Request failed. Please try again.');
  return payload as T;
}
