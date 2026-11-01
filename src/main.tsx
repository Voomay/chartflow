import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import {InstallAppPrompt} from './components/InstallAppPrompt';
import {AccessibilityWidget} from './components/AccessibilityWidget';

// Register only built deployments; keep development sessions free of worker caching.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then(reg => reg.update().catch(() => {}))
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
