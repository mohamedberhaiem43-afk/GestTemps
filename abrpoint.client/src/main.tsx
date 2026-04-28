import React from 'react';
import ReactDOM from 'react-dom/client';
// Importé en TOUT premier : enregistre les interceptors X-Tenant-Slug sur l'instance
// axios globale + patche axios.create() AVANT que n'importe quel autre module
// (UtilisateurService, FilterPointageMois, etc.) ne crée sa propre instance axios.
// Sans ça, ces appels partent sans header tenant et le backend retombe sur la base legacy.
import './components/API/apiInstance';
import App from './App';
import './index.css';
import './i18n.js';


async function bootstrap() {
  // Load config BEFORE rendering
  //await loadConfig();

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
  );
}

bootstrap();
