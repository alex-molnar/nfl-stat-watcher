import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigationType } from 'react-router';
import { MainPage } from './ui/MainPage';
import { CampFinish } from './ui/CampFinish';
import { CampWelcome } from './ui/CampWelcome';
import { RookieCamp } from './ui/RookieCamp';
import { LeaguesPage } from './ui/LeaguesPage';
import { SettingsPage } from './ui/SettingsPage';
import { VsPage } from './ui/VsPage';

// networkMode 'always': while the browser is offline, react-query would otherwise pause fetches
// silently and the retry note would never show.
export const queryDefaults = { queries: { networkMode: 'always' as const } };
const queryClient = new QueryClient({ defaultOptions: queryDefaults });

/** After a navigation the Header link that had focus unmounts, so focus goes to the page heading. Not on first load or redirects. */
function FocusPageHeading() {
  const { key } = useLocation();
  const type = useNavigationType();
  const seen = useRef(key); // compared, not flagged, so StrictMode's double effect cannot focus on mount
  useEffect(() => {
    if (seen.current === key) return;
    seen.current = key;
    if (type !== 'REPLACE') document.querySelector<HTMLElement>('[data-page-title]')?.focus();
  }, [key, type]);
  return null;
}

export function AppRoutes() {
  return (
    <>
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/vs" element={<VsPage />} />
        <Route path="/leagues" element={<LeaguesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <FocusPageHeading />
      <RookieCamp />
      <CampWelcome />
      <CampFinish />
    </>
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
