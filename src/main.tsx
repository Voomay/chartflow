import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import {InstallAppPrompt} from './components/InstallAppPrompt';
import {AccessibilityWidget} from './components/AccessibilityWidget';

// Automatically recover from stale chunk references after a new deployment so clients never need to manually hard-refresh.
window.addEventListener('vite:preloadError', event => {
  try {
    const key = 'chart_replay_chunk_reload_ts';
    const last = Number(sessionStorage.getItem(key) || '0');
    if (Date.now() - last > 10000) {
      event.preventDefault();
      sessionStorage.setItem(key, String(Date.now()));
      window.location.reload();
    }
  } catch {
    window.location.reload();
  }
});

// Register only built deployments; keep development sessions free of worker caching.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then(reg => {
        reg.update().catch(() => {});
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            reg.update().catch(() => {});
          }
        });
      })
      .catch(error => console.warn('App offline support unavailable', error));
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <InstallAppPrompt />
    <AccessibilityWidget />
  </React.StrictMode>
);
