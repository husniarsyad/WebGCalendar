# Schedule Light E2E Tests

Playwright tests for the local SvelteKit app in `../website-dev`.

## Run

```sh
npm install
npx playwright install
npm test
```

The config starts the SvelteKit dev server automatically at `http://localhost:5173` when needed. Use `npm run report` to open the HTML report after a run.
