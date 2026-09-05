# Weeklight

A fast SvelteKit scheduling interface with a CSS-first weekly calendar.

## Configuration

- `svelte.config.js` uses `adapter-auto` so the deployment adapter can be selected by the hosting environment. `vitePreprocess` enables modern Svelte and TypeScript processing. Aliases keep component and data imports short.
- `vite.config.ts` keeps the SvelteKit plugin as the only required plugin, targets modern browsers, uses Lightning CSS minification, disables the legacy module-preload polyfill, and leaves chunking to Vite's default optimizer.
- `src/routes/api/calendar/+server.ts` is the server-only boundary for Google Calendar access. OAuth credentials and tokens stay on the server; do not put client secrets in `PUBLIC_` environment variables or browser code.

## Google Calendar setup

1. Create a Google Cloud OAuth web application and enable the Google Calendar API.
2. Add `http://localhost:5173/api/auth/google/callback` as an authorized redirect URI.
3. Set these server-only environment variables before starting the app:

```sh
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5173/api/auth/google/callback
```

Open the account menu and choose **Connect calendar**. The app stores OAuth tokens in HTTP-only cookies, refreshes access tokens when needed, and reads or creates events through Google Calendar. For local API testing without OAuth, `GOOGLE_ACCESS_TOKEN` can be set instead.

## Run locally

```sh
npm install
npm run dev
```

Run `npm run check` for Svelte and TypeScript validation, and `npm run build` for a production build.
