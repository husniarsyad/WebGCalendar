import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ cookies, url }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expectedState = cookies.get('google_oauth_state');
  const redirectUri = env.GOOGLE_REDIRECT_URI ?? `${url.origin}/api/auth/google/callback`;

  cookies.delete('google_oauth_state', { path: '/' });

  if (!code || !state || !expectedState || state !== expectedState) {
    throw redirect(303, '/?calendar_error=invalid_google_callback');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID ?? '',
      client_secret: env.GOOGLE_CLIENT_SECRET ?? '',
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    })
  });

  if (!response.ok) throw redirect(303, '/?calendar_error=google_token_exchange_failed');

  const token = await response.json();
  cookies.set('google_access_token', token.access_token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: url.protocol === 'https:',
    path: '/',
    maxAge: token.expires_in ?? 3600
  });

  if (token.refresh_token) {
    cookies.set('google_refresh_token', token.refresh_token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: url.protocol === 'https:',
      path: '/',
      maxAge: 60 * 60 * 24 * 30
    });
  }

  throw redirect(303, '/');
};