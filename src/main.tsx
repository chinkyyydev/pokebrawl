import './polyfill-buffer';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { WalletProvider } from './solana/wallet';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WalletProvider>
      <App />
    </WalletProvider>
  </React.StrictMode>,
);
