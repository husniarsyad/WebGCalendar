# Weeklight Calendar

SvelteKit calendar UI connected to Google Calendar, with Playwright browser automation.

![CI](https://github.com/YOUR_GITHUB_OWNER/YOUR_GITHUB_REPOSITORY/actions/workflows/calendar-ci.yml/badge.svg)

## Projects

- `website-dev`: the SvelteKit application.
- `automation-testing`: Playwright scenarios for calendar navigation, event rendering, event creation, profile display, and the favicon.

## Run the app

```sh
cd website-dev
npm install
npm run dev
```

Google OAuth variables are required for a real Calendar connection. See [website-dev/README.md](website-dev/README.md).

## Run automation

```sh
cd automation-testing
npm install
npx playwright install
npm test
npm run report
```

The test suite mocks Google API responses so CI validates the app workflow without exposing Google credentials. Every scenario captures screenshots, which are attached to the Playwright report and uploaded by GitHub Actions.

## GitHub results

Every push to `main` and every pull request runs:

1. Svelte type checking and production build.
2. Chromium Playwright scenarios.
3. Playwright HTML report upload.
4. Screenshot, trace, and failure artifact upload.

Open the workflow run in GitHub and download `playwright-report` to inspect the automation result.