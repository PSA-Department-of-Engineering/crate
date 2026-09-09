import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';
import { applyTheme, getStoredTheme } from './theme';

// Apply the local preference before React mounts so the shell does not flash
// the cream palette while the selected theme is being restored.
applyTheme(getStoredTheme());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
