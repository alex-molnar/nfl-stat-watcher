import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { AppRoutes, queryDefaults } from '../App';
import { applyLanguage, languageStore } from '../i18n';
import type { Profile } from '../scoring/types';
import { reloadAllStores } from '../storage/store';
import type { FollowedEntry } from '../storage/types';

/** A fresh query client without retries, as a wrapper for render and renderHook. */
export function clientWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { ...queryDefaults.queries, retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export const renderWithClient = (ui: ReactElement) => render(ui, { wrapper: clientWrapper() });

export function renderAt(path = '/') {
  return renderWithClient(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

export function seed(followed: FollowedEntry[], profiles: Profile[]) {
  localStorage.setItem('nflsw:v1:followed', JSON.stringify(followed));
  localStorage.setItem('nflsw:v1:profiles', JSON.stringify(profiles));
  reloadAllStores();
}

/** For tests about the pages' own mascots: a first-run user is offered Rookie camp, whose mascot would take theirs, so the offer is turned down first. */
export function declineCamp() {
  localStorage.setItem('nflsw:v1:camp', JSON.stringify({ phase: 'declined', step: 0 }));
  reloadAllStores();
}

/** Shows the site in Hungarian for the rest of the test (the setup puts English back). Call before rendering. */
export async function inHungarian() {
  languageStore.set('hu');
  await applyLanguage();
}
