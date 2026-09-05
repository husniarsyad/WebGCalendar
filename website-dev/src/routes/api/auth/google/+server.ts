import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { randomBytes } from 'node:crypto';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ cookies, url }) => {
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  const redirectUri = env.GOOGLE_REDIRECT_URI ?? `${url.origin}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    throw redirect(303, '/?calendar_error=missing_google_config');
  }

  const state = randomBytes(24).toString('hex');
  cookies.set('google_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: url.protocol === 'https:',
    path: '/',
    maxAge: 600
  });

  const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorizationUrl.searchParams.set('client_id', clientId);
  authorizationUrl.searchParams.set('redirect_uri', redirectUri);
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('scope', 'openid email profile https://www.googleapis.com/auth/calendar');
  authorizationUrl.searchParams.set('access_type', 'offline');
  authorizationUrl.searchParams.set('prompt', 'consent');
  authorizationUrl.searchParams.set('state', state);

  throw redirect(303, authorizationUrl.toString());
};