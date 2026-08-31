import { useEffect } from 'react';
import * as ExpoSplash from 'expo-splash-screen';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

export default function Root() {
  useEffect(() => {
    void ExpoSplash.hideAsync();
  }, []);
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
