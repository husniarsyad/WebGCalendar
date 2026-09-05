import { expect, test, type Page, type Route, type TestInfo } from '@playwright/test';

async function captureStep(page: Page, testInfo: TestInfo, step: string) {
  const screenshotPath = testInfo.outputPath('screenshots', `${step}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach(step, { path: screenshotPath, contentType: 'image/png' });
}

function localIso(year: number, month: number, day: number, hour: number, duration = 1) {
  const start = new Date(year, month - 1, day, hour, 0, 0, 0);
  const end = new Date(start.getTime() + duration * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function currentWeekday(offset: number, hour: number, duration = 1) {
  const date = new Date();
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1) + offset);
  return localIso(date.getFullYear(), date.getMonth() + 1, date.getDate(), hour, duration);
}

async function mockGoogleCalendar(page: Page) {
  const currentEvents = [
    { id: 'event-1', title: 'Product sync', detail: '09:00 - 10:00', ...currentWeekday(0, 9) },
    { id: 'event-2', title: 'Design review', detail: '11:00 - 13:00', ...currentWeekday(2, 11, 2) }
  ];
  let createdEvent: { id: string; title: string; detail: string; start: string; end: string } | undefined;

  await page.route('**/api/auth/google/profile', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ connected: true, user: { name: 'Taylor Morgan', email: 'taylor@example.com', picture: '' } })
    })
  );

  await page.route('**/api/calendar*', async (route: Route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as { summary: string; start: { dateTime: string }; end: { dateTime: string } };
      createdEvent = {
        id: 'created-event',
        title: body.summary,
        detail: '10:00 - 11:00',
        start: body.start.dateTime,
        end: body.end.dateTime
      };
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ event: createdEvent }) });
      return;
    }

    const url = new URL(route.request().url());
    const selectedWeek = new Date(url.searchParams.get('timeMin') ?? '');
    const events = selectedWeek.getFullYear() === 2030
      ? [{ id: 'future-event', title: 'Future planning', detail: '10:00 - 11:00', ...localIso(2030, 5, 15, 10) }]
      : [...currentEvents, ...(createdEvent ? [createdEvent] : [])];

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connected: true, events }) });
  });
}

test.describe('Google-backed calendar experience', () => {
  test.beforeEach(async ({ page }) => {
    await mockGoogleCalendar(page);
    await page.goto('/');
    await expect(page.getByText('Product sync')).toBeVisible();
  });

  test('renders the connected Google profile and multiple calendar events', async ({ page }, testInfo) => {
    await captureStep(page, testInfo, '01-calendar-loaded');
    await page.getByRole('button', { name: 'Open account menu' }).click();
    await captureStep(page, testInfo, '02-account-menu-open');

    await expect(page.getByRole('menu', { name: 'Account menu' })).toContainText('Taylor Morgan');
    await expect(page.getByRole('menu', { name: 'Account menu' })).toContainText('taylor@example.com');
    await expect(page.getByText('Product sync')).toBeVisible();
    await expect(page.getByText('Design review')).toBeVisible();
  });

  test('changes to any selected date and year', async ({ page }, testInfo) => {
    await captureStep(page, testInfo, '01-date-picker-before-change');
    const datePicker = page.getByRole('textbox', { name: 'Choose a date' });
    await datePicker.fill('2030-05-15');
    await captureStep(page, testInfo, '02-date-picker-filled');
    await datePicker.dispatchEvent('change');
    await captureStep(page, testInfo, '03-date-year-selected');

    await expect(datePicker).toHaveValue('2030-05-15');
    await expect(page.getByText('May 2030')).toBeVisible();
    await expect(page.getByRole('region', { name: /Weekly calendar for.*2030/i })).toBeVisible();
    await expect(page.getByText('Future planning')).toBeVisible();
  });

  test('moves between weeks and returns to the current week from the header', async ({ page }, testInfo) => {
    await captureStep(page, testInfo, '01-current-week');
    const datePicker = page.getByRole('textbox', { name: 'Choose a date' });
    const initialDate = await datePicker.inputValue();
    await page.getByRole('button', { name: 'Next week' }).click();
    await captureStep(page, testInfo, '02-next-week');
    await expect(datePicker).not.toHaveValue(initialDate);

    await page.getByRole('link', { name: 'Today' }).click();
    await captureStep(page, testInfo, '03-header-today');
    const today = new Date();
    const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    await expect(page).toHaveURL(/\/\?today=1#today$/);
    await expect(datePicker).toHaveValue(todayValue);
  });

  test('creates an event through the calendar API', async ({ page }, testInfo) => {
    await captureStep(page, testInfo, '01-before-event');
    await page.getByRole('button', { name: 'Add event' }).click();
    await captureStep(page, testInfo, '02-event-dialog-open');
    const dialog = page.getByRole('dialog', { name: 'Add an event' });
    await dialog.getByLabel('Event name').fill('Team stand-up');
    await captureStep(page, testInfo, '03-event-form-filled');
    await dialog.getByRole('button', { name: 'Save event' }).click();
    await captureStep(page, testInfo, '04-event-created');

    await expect(dialog).not.toBeVisible();
    await expect(page.getByText('Team stand-up')).toBeVisible();
  });

  test('serves the favicon asset', async ({ page, request }, testInfo) => {
    const response = await request.get('/favicon.svg');
    expect(response.ok()).toBeTruthy();
    expect(response.headers()['content-type']).toContain('image/svg+xml');
    await captureStep(page, testInfo, '01-favicon-checked');
  });
});
