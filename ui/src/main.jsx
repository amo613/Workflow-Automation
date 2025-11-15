import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// Ensure CSRF token is available by making a GET request to trigger token generation
fetch('/api', {
  method: 'GET',
  credentials: 'include',
}).catch(() => {
  // Ignore errors - token will be set on first API call
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename="/">
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
