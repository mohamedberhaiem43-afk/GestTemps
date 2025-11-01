import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { loadConfig, getConfig } from './config';

const queryClient = new QueryClient();

async function bootstrap() {
  // Load config BEFORE rendering
  await loadConfig();
console.log("Loaded config:", getConfig());

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </React.StrictMode>
  );
}

bootstrap();
