import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { MainPage } from './ui/MainPage';
import { SettingsPage } from './ui/SettingsPage';

// networkMode 'always': while the browser is offline, react-query would otherwise pause fetches
// silently and the retry note would never show.
export const queryDefaults = { queries: { networkMode: 'always' as const } };
const queryClient = new QueryClient({ defaultOptions: queryDefaults });

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<MainPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
