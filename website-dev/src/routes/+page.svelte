<script lang="ts">
  import { onMount } from 'svelte';
  import { afterNavigate } from '$app/navigation';
  import { browser } from '$app/environment';

  type CalendarEvent = {
    id?: string;
    day: number;
    start: number;
    span: number;
    title: string;
    detail: string;
    tone: string;
  };

  type ApiCalendarEvent = {
    id?: string;
    title: string;
    detail: string;
    start: string;
    end: string;
  };

  type CalendarResponse = {
    connected?: boolean;
    error?: string;
    events?: ApiCalendarEvent[];
  };

  function getMonday(date: Date) {
    const monday = new Date(date);
    const day = monday.getDay();
    monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  function formatDateInput(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  let selectedDate = $state(new Date());
  let selectedDateInput = $state(formatDateInput(new Date()));
  let weekStart = $derived(getMonday(selectedDate));
  let weekEnd = $derived(new Date(weekStart.getTime() + 7 * 86400000));
  let days = $derived(Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    return {
      name: date.toLocaleDateString(undefined, { weekday: 'short' }),
      date: date.getDate().toString(),
      value: date
    };
  }));
  let weekLabel = $derived(weekStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }));
  let weekRangeLabel = $derived(`${days[0].name} ${days[0].date} to ${days[6].name} ${days[6].date}, ${days[6].value.getFullYear()}`);
  const todayKey = new Date().toDateString();

  const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

  let events = $state<CalendarEvent[]>([]);
  let connected = $state(false);
  let loading = $state(true);
  let loadError = $state('');
  let configurationError = $state('');

  let calendarSection: HTMLElement;
  let eventDialog: HTMLDialogElement;
  let eventDraft = $state({ title: '', day: '1', start: '08:00', duration: '1' });

  function toGridEvent(event: ApiCalendarEvent, index: number): CalendarEvent | null {
    const start = new Date(event.start);
    const end = new Date(event.end);
    const day = start.getDay() === 0 ? 7 : start.getDay();
    const startHour = start.getHours();
    const span = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 3600000));

    if (day < 1 || day > 7 || startHour < 8 || startHour >= 17) return null;
    return { id: event.id, day, start: startHour - 8, span: Math.min(span, 10 - (startHour - 8)), title: event.title, detail: event.detail, tone: ['mint', 'peach', 'blue', 'yellow'][index % 4] };
  }

  async function loadEvents(anchorDate = selectedDate) {
    if (!browser) return;
    loading = true;
    try {
      const requestedWeekStart = getMonday(anchorDate);
      const requestedWeekEnd = new Date(requestedWeekStart.getTime() + 7 * 86400000);
      const response = await fetch(`/api/calendar?timeMin=${encodeURIComponent(requestedWeekStart.toISOString())}&timeMax=${encodeURIComponent(requestedWeekEnd.toISOString())}`);
      const data: CalendarResponse = await response.json();
      connected = data.connected ?? false;
      loadError = data.error ?? '';
      events = (data.events ?? [])
        .map(toGridEvent)
        .filter((event): event is CalendarEvent => event !== null);
    } catch {
      loadError = 'Unable to reach the calendar service.';
    }
    loading = false;
  }

  onMount(() => {
    void loadEvents(selectedDate);
  });

  function changeWeek(amount: number) {
    selectedDate = new Date(selectedDate);
    selectedDate.setDate(selectedDate.getDate() + amount * 7);
    selectedDateInput = formatDateInput(selectedDate);
    void loadEvents(selectedDate);
  }

  function chooseDate() {
    const date = new Date(`${selectedDateInput}T12:00:00`);
    if (Number.isNaN(date.getTime())) return;
    selectedDate = date;
    void loadEvents(selectedDate);
  }

  function goToToday() {
    selectedDate = new Date();
    selectedDateInput = formatDateInput(selectedDate);
    void loadEvents(selectedDate);
    scrollToToday();
  }

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('today') === '1') {
      selectedDate = new Date();
      selectedDateInput = formatDateInput(selectedDate);
      requestAnimationFrame(scrollToToday);
    }
    const error = params.get('calendar_error');
    if (error === 'missing_google_config') {
      configurationError = 'Google Calendar is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to website-dev/.env, then restart the dev server.';
    } else if (error === 'invalid_google_callback') {
      configurationError = 'Google Calendar authorization could not be verified. Please try connecting again.';
    } else if (error === 'google_token_exchange_failed') {
      configurationError = 'Google rejected the authorization. Check the OAuth redirect URI and try again.';
    }
  });

  afterNavigate(() => {
    if (new URLSearchParams(window.location.search).get('today') !== '1') return;
    selectedDate = new Date();
    selectedDateInput = formatDateInput(selectedDate);
    void loadEvents(selectedDate);
    requestAnimationFrame(scrollToToday);
  });

  function scrollToToday() {
    calendarSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function openEventDialog() {
    eventDialog.showModal();
  }

  function closeEventDialog() {
    eventDialog.close();
    eventDraft.title = '';
    eventDraft.day = '1';
    eventDraft.start = '08:00';
    eventDraft.duration = '1';
  }

  async function addEvent(event: SubmitEvent) {
    event.preventDefault();
    const startIndex = hours.indexOf(eventDraft.start);
    const duration = Number(eventDraft.duration);
    const start = new Date(days[Number(eventDraft.day) - 1].value);
    start.setHours(8 + startIndex, 0, 0, 0);
    const end = new Date(start.getTime() + duration * 3600000);
    const response = await fetch('/api/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: eventDraft.title.trim(), start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() } })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      loadError = error.details ?? error.error ?? 'Unable to create Google Calendar event.';
      return;
    }

    const data = await response.json();
    const created = toGridEvent(data.event, events.length);
    if (created) events.push(created);
    closeEventDialog();
  }
</script>

<svelte:head>
  <title>Week of {weekLabel} | Weeklight</title>
</svelte:head>

<section class="page-intro" id="today">
  <div>
    <p class="eyebrow">{weekLabel}</p>
    <h1>Make room for<br /><em>what matters.</em></h1>
  </div>
  <div class="actions" aria-label="Calendar actions">
    <div class="week-controls" aria-label="Choose calendar week">
      <button class="secondary icon-button" type="button" aria-label="Previous week" onclick={() => changeWeek(-1)}>←</button>
      <input aria-label="Choose a date" type="date" bind:value={selectedDateInput} onchange={chooseDate} />
      <button class="secondary icon-button" type="button" aria-label="Next week" onclick={() => changeWeek(1)}>→</button>
      <button class="secondary" type="button" onclick={goToToday}>Today</button>
    </div>
    <button class="primary" type="button" onclick={openEventDialog}><span aria-hidden="true">+</span> Add event</button>
  </div>
</section>

<section bind:this={calendarSection} class="calendar-wrap" aria-label={`Weekly calendar for ${weekRangeLabel}`} tabindex="-1">
  <div class="calendar-scroll">
    <div class="calendar" style={`--day-count: ${days.length}`}>
      <div class="corner"></div>
      <div class="day-headings">
        {#each days as day, index}
          <div class:current={day.value.toDateString() === todayKey} class="day-heading">
            <span>{day.name}</span>
            <strong>{day.date}</strong>
          </div>
        {/each}
      </div>

      <div class="time-labels">
        {#each hours as hour}
          <span>{hour}</span>
        {/each}
      </div>

      <div class="grid-area">
        <div class="grid-lines" aria-hidden="true">
          {#each hours as _}
            <span></span>
          {/each}
        </div>
        <div class="events">
          {#each events as event}
            <article class={`event ${event.tone}`} style={`grid-column: ${event.day}; grid-row: ${event.start + 1} / span ${event.span}`}>
              <strong>{event.title}</strong>
              <span>{event.detail}</span>
            </article>
          {/each}
        </div>
        <span class="current-time" style={`top: ${Math.max(0, Math.min(100, (new Date().getHours() - 8) * 10 + new Date().getMinutes() / 6))}%`}><i></i></span>
      </div>
    </div>
  </div>
</section>

{#if loading}
  <p class="calendar-message">Loading Google Calendar...</p>
{:else if configurationError}
  <p class="calendar-message error">{configurationError}</p>
{:else if !connected}
  <p class="calendar-message"><a href="/api/auth/google">Connect Google Calendar</a> to see and manage your events.</p>
{:else if loadError}
  <p class="calendar-message error">{loadError}</p>
{/if}

<p class="timezone">All times shown in your local timezone · {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>

<dialog bind:this={eventDialog} aria-labelledby="event-dialog-title">
  <form method="dialog" onsubmit={addEvent}>
    <div class="dialog-header">
      <div>
        <p class="eyebrow">New calendar item</p>
        <h2 id="event-dialog-title">Add an event</h2>
      </div>
      <button class="close-dialog" type="button" aria-label="Close add event dialog" onclick={closeEventDialog}>×</button>
    </div>

    <label>
      Event name
      <input bind:value={eventDraft.title} name="title" placeholder="e.g. Team stand-up" required />
    </label>
    <div class="form-row">
      <label>
        Day
        <select bind:value={eventDraft.day} name="day">
          {#each days as day, index}
            <option value={String(index + 1)}>{day.name} {day.date}</option>
          {/each}
        </select>
      </label>
      <label>
        Starts
        <select bind:value={eventDraft.start} name="start">
          {#each hours.slice(0, -1) as hour}
            <option value={hour}>{hour}</option>
          {/each}
        </select>
      </label>
      <label>
        Hours
        <select bind:value={eventDraft.duration} name="duration">
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
        </select>
      </label>
    </div>
    <div class="dialog-actions">
      <button class="secondary" type="button" onclick={closeEventDialog}>Cancel</button>
      <button class="primary" type="submit">Save event</button>
    </div>
  </form>
</dialog>

<style>
  .page-intro {
    align-items: end;
    display: flex;
    justify-content: space-between;
    margin: 52px auto 44px;
    max-width: 1312px;
    padding: 0 clamp(20px, 4vw, 64px);
  }

  .eyebrow {
    color: #de6b4a;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    margin: 0 0 14px;
    text-transform: uppercase;
  }

  h1 {
    color: #26322d;
    font-family: Georgia, serif;
    font-size: clamp(42px, 5vw, 70px);
    font-weight: 400;
    letter-spacing: -0.055em;
    line-height: 0.98;
    margin: 0;
  }

  h1 em {
    color: #74957e;
    font-style: italic;
  }

  .actions {
    display: flex;
    gap: 10px;
  }

  .week-controls {
    align-items: center;
    display: flex;
    gap: 8px;
  }

  .week-controls input {
    background: #fbfcfa;
    border: 1px solid #ccd5cd;
    border-radius: 6px;
    color: #53615a;
    font: inherit;
    font-size: 12px;
    padding: 11px 10px;
  }

  button {
    border-radius: 6px;
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    font-weight: 700;
    padding: 12px 16px;
  }

  .secondary {
    background: transparent;
    border: 1px solid #ccd5cd;
    color: #53615a;
  }

  .icon-button {
    font-size: 18px;
    line-height: 12px;
    padding: 11px 12px;
  }

  .primary {
    background: #263b31;
    border: 1px solid #263b31;
    color: white;
  }

  .primary span {
    font-size: 18px;
    font-weight: 400;
    line-height: 0;
    margin-right: 5px;
    vertical-align: -1px;
  }

  .calendar-wrap {
    background: #fbfcfa;
    border-block: 1px solid #dfe5df;
    box-shadow: 0 16px 50px rgb(48 70 56 / 5%);
    padding: 0 clamp(20px, 4vw, 64px) 28px;
  }

  .calendar-message {
    color: #73807a;
    font-size: 12px;
    margin: 18px auto 0;
    max-width: 1312px;
    padding: 0 clamp(20px, 4vw, 64px);
  }

  .calendar-message a {
    color: #de6b4a;
    font-weight: 700;
  }

  .calendar-message.error {
    color: #a94f38;
  }

  .calendar-scroll {
    margin: 0 auto;
    max-width: 1312px;
    overflow-x: auto;
  }

  .calendar {
    display: grid;
    grid-template-columns: 66px minmax(840px, 1fr);
    min-width: 906px;
  }

  .corner {
    border-bottom: 1px solid #dfe5df;
    height: 76px;
  }

  .day-headings {
    display: grid;
    grid-template-columns: repeat(var(--day-count), 1fr);
  }

  .day-heading {
    align-items: center;
    border-bottom: 1px solid #dfe5df;
    border-left: 1px solid #edf0ed;
    display: flex;
    gap: 10px;
    height: 76px;
    padding: 0 15px;
  }

  .day-heading span {
    color: #85918b;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
  }

  .day-heading strong {
    color: #3b4841;
    font-family: Georgia, serif;
    font-size: 25px;
    font-weight: 400;
  }

  .day-heading.current strong {
    align-items: center;
    background: #de6b4a;
    border-radius: 50%;
    color: white;
    display: inline-flex;
    height: 34px;
    justify-content: center;
    width: 34px;
  }

  .time-labels {
    display: grid;
    grid-template-rows: repeat(10, 58px);
  }

  .time-labels span {
    color: #9aa49e;
    font-size: 10px;
    padding-top: 10px;
    text-align: left;
  }

  .grid-area {
    min-height: 580px;
    position: relative;
  }

  .grid-lines,
  .events {
    display: grid;
    grid-template-columns: repeat(var(--day-count), 1fr);
    grid-template-rows: repeat(10, 58px);
    inset: 0;
    position: absolute;
  }

  .grid-lines span {
    border-bottom: 1px solid #edf0ed;
    border-left: 1px solid #edf0ed;
    grid-column: 1 / -1;
  }

  .event {
    border-left: 3px solid;
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 5px 6px;
    min-width: 0;
    overflow: hidden;
    padding: 11px 10px;
  }

  .event strong,
  .event span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .event strong {
    color: #37453e;
    font-size: 11px;
  }

  .event span {
    color: #77847c;
    font-size: 10px;
  }

  .mint { background: #e0eee4; border-color: #73a283; }
  .peach { background: #f8e4d9; border-color: #df8b69; }
  .blue { background: #e1eaf0; border-color: #7295aa; }
  .yellow { background: #f4edce; border-color: #c8a94d; }

  .current-time {
    background: #de6b4a;
    height: 1px;
    left: 0;
    position: absolute;
    right: 0;
  }

  .current-time i {
    background: #de6b4a;
    border-radius: 50%;
    display: block;
    height: 7px;
    left: -3px;
    position: absolute;
    top: -3px;
    width: 7px;
  }

  .timezone {
    color: #9aa49e;
    font-size: 10px;
    margin: 20px auto;
    max-width: 1312px;
    padding: 0 clamp(20px, 4vw, 64px);
  }

  dialog {
    background: #fbfcfa;
    border: 1px solid #dfe5df;
    border-radius: 8px;
    box-shadow: 0 24px 80px rgb(38 59 49 / 20%);
    color: #26322d;
    max-width: min(460px, calc(100vw - 40px));
    padding: 28px;
    width: 100%;
  }

  dialog::backdrop {
    background: rgb(31 40 38 / 35%);
  }

  .dialog-header {
    align-items: start;
    display: flex;
    justify-content: space-between;
    margin-bottom: 24px;
  }

  h2 {
    font-family: Georgia, serif;
    font-size: 30px;
    font-weight: 400;
    letter-spacing: -0.04em;
    margin: 0;
  }

  .dialog-header .eyebrow {
    margin-bottom: 8px;
  }

  .close-dialog {
    background: transparent;
    border: 0;
    color: #73807a;
    font-size: 24px;
    line-height: 1;
    padding: 0 4px;
  }

  label {
    color: #53615a;
    display: flex;
    flex: 1;
    flex-direction: column;
    font-size: 11px;
    font-weight: 700;
    gap: 7px;
  }

  input,
  select {
    background: white;
    border: 1px solid #ccd5cd;
    border-radius: 5px;
    color: #26322d;
    font: inherit;
    font-size: 13px;
    min-width: 0;
    padding: 11px 10px;
  }

  input:focus,
  select:focus,
  button:focus-visible {
    outline: 3px solid rgb(222 107 74 / 28%);
    outline-offset: 2px;
  }

  .form-row {
    display: flex;
    gap: 10px;
    margin-top: 16px;
  }

  .dialog-actions {
    display: flex;
    gap: 10px;
    justify-content: end;
    margin-top: 26px;
  }

  @media (max-width: 640px) {
    .page-intro {
      align-items: start;
      flex-direction: column;
      gap: 28px;
      margin-top: 36px;
    }

    .actions {
      align-items: start;
      flex-direction: column;
      width: 100%;
    }

    .week-controls {
      flex-wrap: wrap;
    }
  }
</style>
