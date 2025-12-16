import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider, useAuth } from '@clerk/clerk-react';
import { App } from './App';
import { setGlobalToken } from './hooks/useApi';
import './styles.css';

// Get Clerk publishable key
const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Component to sync Clerk token to global API token
function TokenSync({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      getToken().then(token => {
        if (token) setGlobalToken(token);
      }).catch(() => {
        // Token fetch failed, will use dev token
      });
    }
  }, [getToken, isLoaded, isSignedIn]);

  return <>{children}</>;
}

// If no Clerk key, render app without ClerkProvider (dev/demo mode)
if (!CLERK_PUBLISHABLE_KEY) {
  console.warn('No VITE_CLERK_PUBLISHABLE_KEY - running in demo mode');
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
        <TokenSync>
          <App />
        </TokenSync>
      </ClerkProvider>
    </React.StrictMode>
  );
}
