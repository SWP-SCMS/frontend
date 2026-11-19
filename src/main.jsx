// Entry point.
//
// Order matters:
//   1. Bootstrap CSS first so our overrides can win the cascade.
//   2. SCMS theme overrides.
//   3. React root.
//
// Vite + React 19 + StrictMode is the default scaffold, kept as-is.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css';
import './styles/app-shell.css';
import './styles/app-components.css';
import './styles/layout.css';
import './styles/status.css';
import App from './App.jsx';

// A tab opened before a deployment can still request chunks from the old build.
window.addEventListener('vite:preloadError', (event) => {
  if (!/failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module/i.test(event.payload?.message)) return;
  const key = 'scms:last-chunk-reload';
  try {
    if (sessionStorage.getItem(key) === import.meta.url) return;
    sessionStorage.setItem(key, import.meta.url);
  } catch {
    return;
  }
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
