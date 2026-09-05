import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ cookies }) => {
  const token = cookies.get('google_access_token') ?? env.GOOGLE_ACCESS_TOKEN;
  if (!token) return json({ connected: false });

  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) return json({ connected: false }, { status: 401 });

  const profile = await response.json();
  return json({
    connected: true,
    user: {
      name: profile.name ?? profile.email ?? 'Google user',
      email: profile.email ?? '',
      picture: profile.picture ?? ''
    }
  });
};