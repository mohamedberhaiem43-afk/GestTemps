import React from 'react';
import ReactDOM from 'react-dom/client';
// Importé en TOUT premier : enregistre les interceptors X-Tenant-Slug sur l'instance
// axios globale + patche axios.create() AVANT que n'importe quel autre module
// (UtilisateurService, FilterPointageMois, etc.) ne crée sa propre instance axios.
// Sans ça, ces appels partent sans header tenant et le backend retombe sur la base legacy.
import './components/API/apiInstance';
import App from './App';

// Polices auto-hébergées (remplace les CDN Google Fonts pour passer le scan SRI/CSP)
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/dm-sans/300.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/dm-mono/400.css';
import '@fontsource/dm-mono/500.css';
import 'material-symbols/outlined.css';

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
