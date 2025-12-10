import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import AdminApp from './AdminApp.jsx';
import Auth from './Auth.jsx';
import './index.css';

function MainApp() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const adminLoggedIn = localStorage.getItem('adminLoggedIn') === 'true';
    setIsAdmin(adminLoggedIn);
    setCheckingAuth(false);
  }, []);

  // Simple routing based on URL path
  const path = window.location.pathname;

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (path === '/admin') {
    if (!isAdmin) {
      return <Auth setAdmin={setIsAdmin} />;
    }
    return <AdminApp setAdmin={setIsAdmin} />;
  }

  return <App />;
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  document.body.innerHTML = '<h1 style="color: red; padding: 40px;">Error: Root element not found!</h1>';
} else {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <MainApp />
    </React.StrictMode>
  );
}
