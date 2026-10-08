import './styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyLanguage } from './i18n';
import { followSystemTheme } from './storage/theme';

followSystemTheme();

// A visitor whose language is not English waits for its texts (one small file) rather than seeing English flash by.
void applyLanguage().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
