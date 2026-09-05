import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
  cookies.delete('google_access_token', { path: '/' });
  cookies.delete('google_refresh_token', { path: '/' });
  return json({ connected: false });
};