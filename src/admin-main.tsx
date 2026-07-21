import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AdminPanel from './components/AdminPanel';
import { LanguageProvider } from './lib/LanguageContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <AdminPanel />
    </LanguageProvider>
  </StrictMode>,
);
