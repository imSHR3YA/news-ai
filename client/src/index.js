import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from './AuthContext';
import { Toaster } from 'react-hot-toast';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <App />
      <Toaster
        position="bottom-left"
        toastOptions={{
          duration: 2500,
          style: {
            background: 'var(--surface)',
            color: 'var(--ink)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            fontFamily: 'DM Sans, sans-serif',
            boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
            fontSize: '0.88rem',
          },
        }}
      />
    </AuthProvider>
  </React.StrictMode>
);
