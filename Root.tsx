import { useEffect } from 'react';
import * as ExpoSplash from 'expo-splash-screen';
import App from './App';

export default function Root() {
  useEffect(() => {
    void ExpoSplash.hideAsync();
  }, []);
  return <App />;
}
