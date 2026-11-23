import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { readStoredLanguage } from './storageKeys.js';
import { formatText } from './utils.js';
import './styles/tokens.css';
import './styles.css';
import './styles/study.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
  navigator.serviceWorker?.addEventListener('message', (event) => {
    if (event.data?.type === 'APP_UPDATE_AVAILABLE') {
      const language = readStoredLanguage();
      const shouldReload = window.confirm(formatText(language, 'appUpdate'));
      if (shouldReload) window.location.reload();
    }
  });
}
