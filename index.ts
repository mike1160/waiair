import 'react-native-gesture-handler';
import { Platform } from 'react-native';
import { initExpoAssetSafe } from './lib/safeAsset';
import { defineTrackedBackgroundTask } from './lib/backgroundRefresh';

initExpoAssetSafe();
defineTrackedBackgroundTask();

// Register home-screen widget layout in App Group storage before any sync.
if (Platform.OS === 'ios') {
  require('./widgets/FlightHomeWidget');
  console.warn('[Widget] layout registered');
}

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
