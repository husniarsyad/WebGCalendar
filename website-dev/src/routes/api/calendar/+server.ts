import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

type GoogleEvent = {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

const googleCalendarUrl = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

async function getAccessToken(cookies: Parameters<RequestHandler>[0]['cookies']) {
  const accessToken = cookies.get('google_access_token') ?? env.GOOGLE_ACCESS_TOKEN;
  if (accessToken) return accessToken;

  const refreshToken = cookies.get('google_refresh_token');
  if (!refreshToken || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return undefined;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });

  if (!response.ok) return undefined;
  const token = await response.json();
  cookies.set('google_access_token', token.access_token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: token.expires_in ?? 3600
  });
  return token.access_token as string;
}

function toIsoDate(value: string | undefined, fallback: string) {
  return value ? new Date(value).toISOString() : fallback;
}

function normalizeEvent(event: GoogleEvent) {
  const start = event.start?.dateTime ?? event.start?.date;
  const end = event.end?.dateTime ?? event.end?.date;

  return {
    id: event.id,
    title: event.summary || 'Untitled event',
    detail: start && end ? `${new Date(start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'All day',
    start: toIsoDate(start, new Date().toISOString()),
    end: toIsoDate(end, new Date().toISOString()),
    allDay: Boolean(event.start?.date)
  };
}

async function googleRequest(url: string, init: RequestInit, token: string) {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers }
  });

  if (!response.ok) {
    const message = await response.text();
    const error = new Error(`Google Calendar returned ${response.status}: ${message}`);
    Object.assign(error, { status: response.status });
    throw error;
  }

  return response.json();
}

export const GET: RequestHandler = async ({ cookies, url }) => {
  const token = await getAccessToken(cookies);
  if (!token) return json({ events: [], connected: false });

  const timeMin = url.searchParams.get('timeMin') ?? new Date().toISOString();
  const timeMax = url.searchParams.get('timeMax') ?? new Date(Date.now() + 7 * 86400000).toISOString();

  try {
    const data = await googleRequest(
      `${googleCalendarUrl}?singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`,
      { method: 'GET' },
      token
    );

    return json({ events: (data.items as GoogleEvent[]).map(normalizeEvent), connected: true });
  } catch (error) {
    console.error(error);
    return json({ events: [], connected: false, error: 'Unable to load Google Calendar.' }, { status: 502 });
  }
};

export const POST: RequestHandler = async ({ cookies, request }) => {
  let token = await getAccessToken(cookies);
  if (!token) return json({ error: 'Connect Google Calendar first.' }, { status: 401 });

  const event = await request.json();

  try {
    let created;
    try {
      created = await googleRequest(googleCalendarUrl, { method: 'POST', body: JSON.stringify(event) }, token);
    } catch (error) {
      if (!(error instanceof Error) || !('status' in error) || error.status !== 401) throw error;
      cookies.delete('google_access_token', { path: '/' });
      token = await getAccessToken(cookies);
      if (!token) return json({ error: 'Google Calendar authorization expired. Please connect again.' }, { status: 401 });
      created = await googleRequest(googleCalendarUrl, { method: 'POST', body: JSON.stringify(event) }, token);
    }
    return json({ event: normalizeEvent(created) }, { status: 201 });
  } catch (error) {
    console.error(error);
    return json({ error: 'Unable to create Google Calendar event.', details: error instanceof Error ? error.message : 'Unknown Google Calendar error.' }, { status: 502 });
  }
};
