import { useEffect } from 'react';
import * as ExpoSplash from 'expo-splash-screen';
import * as Font from 'expo-font';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

export default function Root() {
  useEffect(() => {
    // TODO: FontRegistrationFailedException red box in __DEV__ is acceptable
    // while icons render and launch does not crash; do not loadAsync at startup.
    console.log(`[fonts] ionicons loaded: ${Font.isLoaded('ionicons')}`);
    void ExpoSplash.hideAsync();
  }, []);
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
