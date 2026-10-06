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
import './styles/layout.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
