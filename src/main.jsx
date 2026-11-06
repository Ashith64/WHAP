// src/main.jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './context/AuthContext';
import { RealtimeProvider } from './context/RealtimeContext';
import { App } from './App';
import './index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root not found');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <AuthProvider>
      <RealtimeProvider>
        <App />
      </RealtimeProvider>
    </AuthProvider>
  </React.StrictMode>
);
