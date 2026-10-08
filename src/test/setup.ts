import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { setPaused } from '../storage/pause';
import { applyLanguage, i18n } from '../i18n';
import { reloadAllStores } from '../storage/store';

// Tests never reach the network. Tests that need data call mockFetch().
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn(); // jsdom has none
  vi.stubGlobal('fetch', vi.fn(async () => new Response('not mocked', { status: 404 })));
});

afterEach(async () => {
  cleanup();
  setPaused(false);
  localStorage.clear();
  reloadAllStores();
  if (i18n.language !== 'en') await applyLanguage(); // back to English, which every test but the Hungarian ones reads
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// jsdom does not implement <dialog>.
HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
  this.setAttribute('open', '');
};
HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
  this.removeAttribute('open');
  this.dispatchEvent(new Event('close'));
};

// jsdom does not implement the popover API or its top-layer visibility.
HTMLElement.prototype.showPopover = function (this: HTMLElement) {
  this.style.display = 'block';
};
