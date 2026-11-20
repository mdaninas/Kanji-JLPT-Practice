import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
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

function readStoredLanguage() {
  try {
    const raw = localStorage.getItem('kanjiApp:language');
    if (!raw) return 'id';
    const parsed = JSON.parse(raw);
    return parsed === 'en' ? 'en' : 'id';
  } catch {
    return 'id';
  }
}

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
