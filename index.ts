import 'react-native-gesture-handler';
import { initExpoAssetSafe } from './lib/safeAsset';
import { defineTrackedBackgroundTask } from './lib/backgroundRefresh';
import { defineGmailSyncTask } from './lib/gmailAutoSync';
import * as ExpoSplash from 'expo-splash-screen';

initExpoAssetSafe();
defineTrackedBackgroundTask();
defineGmailSyncTask();
void ExpoSplash.preventAutoHideAsync();

import { registerRootComponent } from 'expo';

import Root from './Root';

registerRootComponent(Root);
