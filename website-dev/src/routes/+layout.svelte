<svelte:head>
  <meta name="theme-color" content="#f4f6f2" />
  <meta name="description" content="A calm, lightweight weekly schedule." />
  <title>Weeklight | Schedule</title>
</svelte:head>

<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  let { children } = $props();
  let accountMenuOpen = $state(false);
  let user = $state<{ name: string; email: string; picture: string } | null>(null);

  const navigation = [
    { label: 'Week', href: '/' },
    { label: 'Today', href: '/?today=1#today' }
  ];

  function initials(name: string) {
    return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  }

  async function disconnectCalendar() {
    if (!browser) return;
    await fetch('/api/auth/logout', { method: 'POST' });
    user = null;
    accountMenuOpen = false;
  }

  onMount(async () => {
    if (!browser) return;
    const response = await fetch('/api/auth/google/profile');
    if (response.ok) {
      const data = await response.json();
      user = data.user ?? null;
    }
  });
</script>

<div class="app-shell">
  <header class="site-header">
    <a class="brand" href="/" aria-label="Weeklight home">
      <span class="brand-mark" aria-hidden="true">W</span>
      <span>weeklight</span>
    </a>

    <nav aria-label="Primary navigation">
      {#each navigation as item}
        <a
          href={item.href}
          onclick={(event) => {
            if (item.label !== 'Today') return;
            event.preventDefault();
            window.location.assign('/?today=1#today');
          }}
        >{item.label}</a>
      {/each}
    </nav>

    <div class="account-area">
      <button
        class="avatar"
        type="button"
        aria-label="Open account menu"
        aria-expanded={accountMenuOpen}
        aria-controls="account-menu"
        onclick={() => (accountMenuOpen = !accountMenuOpen)}
      >{user ? initials(user.name) : '?'}</button>
      {#if accountMenuOpen}
        <div class="account-menu" id="account-menu" role="menu" aria-label="Account menu">
          {#if user}
            <strong>{user.name}</strong>
            <span>{user.email}</span>
            <span>Google Calendar connected</span>
            <button type="button" role="menuitem" onclick={disconnectCalendar}>Disconnect calendar</button>
          {:else}
            <strong>Not connected</strong>
            <span>Google Calendar</span>
            <a href="/api/auth/google" role="menuitem">Connect calendar</a>
          {/if}
          <button type="button" role="menuitem" onclick={() => (accountMenuOpen = false)}>Close menu</button>
        </div>
      {/if}
    </div>
  </header>

  <main>
    {@render children()}
  </main>
</div>

<style>
  :global(*) {
    box-sizing: border-box;
  }

  :global(html) {
    background: #f4f6f2;
    color: #1f2826;
    font-family: 'DM Sans', 'Segoe UI', sans-serif;
  }

  :global(body) {
    margin: 0;
    min-width: 320px;
  }

  .app-shell {
    min-height: 100vh;
    background: radial-gradient(circle at 90% 0%, #e8eee5 0, transparent 30rem), #f4f6f2;
  }

  .site-header {
    align-items: center;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    margin: 0 auto;
    max-width: 1440px;
    padding: 24px clamp(20px, 4vw, 64px);
  }

  .brand {
    align-items: center;
    color: inherit;
    display: inline-flex;
    font-family: Georgia, serif;
    font-size: 20px;
    font-weight: 700;
    gap: 10px;
    letter-spacing: -0.02em;
    text-decoration: none;
  }

  .brand-mark {
    align-items: center;
    background: #de6b4a;
    border-radius: 50%;
    color: white;
    display: inline-flex;
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    height: 28px;
    justify-content: center;
    width: 28px;
  }

  nav {
    display: flex;
    gap: 28px;
  }

  nav a {
    color: #73807a;
    font-size: 13px;
    text-decoration: none;
  }

  nav a:first-child,
  nav a:hover {
    color: #1f2826;
  }

  .avatar {
    align-self: center;
    background: #dce7dc;
    border: 0;
    border-radius: 50%;
    color: #456052;
    font-size: 11px;
    font-weight: 700;
    height: 34px;
    justify-self: end;
    width: 34px;
  }

  .account-area {
    justify-self: end;
    position: relative;
  }

  .account-menu {
    background: #fbfcfa;
    border: 1px solid #dfe5df;
    border-radius: 6px;
    box-shadow: 0 12px 32px rgb(48 70 56 / 12%);
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 170px;
    padding: 14px;
    position: absolute;
    right: 0;
    top: 44px;
    z-index: 2;
  }

  .account-menu strong {
    color: #26322d;
    font-size: 12px;
  }

  .account-menu span {
    color: #85918b;
    font-size: 10px;
    margin-bottom: 8px;
  }

  .account-menu button {
    background: transparent;
    border: 1px solid #ccd5cd;
    border-radius: 4px;
    color: #53615a;
    font: inherit;
    font-size: 11px;
    padding: 8px;
  }

  .account-menu a {
    border: 1px solid #ccd5cd;
    border-radius: 4px;
    color: #53615a;
    font-size: 11px;
    padding: 8px;
    text-decoration: none;
  }

  @media (max-width: 560px) {
    .site-header {
      grid-template-columns: 1fr auto;
    }

    nav {
      display: none;
    }
  }
</style>
