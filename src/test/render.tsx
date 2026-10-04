import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { AppRoutes } from '../App';
import type { Profile } from '../scoring/types';
import { reloadAllStores } from '../storage/store';
import type { FollowedEntry } from '../storage/types';

export function renderAt(path = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

export function seed(followed: FollowedEntry[], profiles: Profile[]) {
  localStorage.setItem('nflsw:v1:followed', JSON.stringify(followed));
  localStorage.setItem('nflsw:v1:profiles', JSON.stringify(profiles));
  reloadAllStores();
}
