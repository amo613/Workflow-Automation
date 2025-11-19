import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// Dark Theme als Standard setzen
document.documentElement.classList.add('dark');
document.body.classList.add('dark');

// Set canonical URL dynamically
const canonicalLink = document.getElementById('canonical-link');
if (canonicalLink) {
  canonicalLink.href = window.location.href.split('?')[0]; // Remove query params
}

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
