import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { reloadAllStores } from '../storage/store';

// Tests never reach the network. Tests that need data call mockFetch().
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('not mocked', { status: 404 })));
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  reloadAllStores();
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
