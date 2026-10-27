import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/inter';
import './index.css';
import { App } from './app/App';
import { PrefsProvider } from './app/PrefsProvider';
import { db } from './data/db';
import { recordMigrations } from './data/migrations';

// Opening the DB applies any pending Dexie upgrade; failures (private mode, quota)
// must not stop the shell from rendering.
recordMigrations(db).catch((err) => console.warn('PantryPal: local database unavailable', err));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrefsProvider>
      <App />
    </PrefsProvider>
  </StrictMode>,
);
