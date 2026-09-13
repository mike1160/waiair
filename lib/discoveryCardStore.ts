import AsyncStorage from '@react-native-async-storage/async-storage';
import { DISCOVERY_STORAGE_KEY, parseShownDiscoveryIds, withShownDiscoveryId } from './landingDiscovery';

async function readShown(): Promise<string[]> {
  try {
    return parseShownDiscoveryIds(await AsyncStorage.getItem(DISCOVERY_STORAGE_KEY));
  } catch {
    return [];
  }
}

/** Never show the landing discovery card twice for the same tracked flight. */
export async function hasShownDiscoveryCard(flightId: string): Promise<boolean> {
  if (!flightId) return false;
  return (await readShown()).includes(flightId);
}

export async function markDiscoveryCardShown(flightId: string): Promise<void> {
  if (!flightId) return;
  try {
    const next = withShownDiscoveryId(await readShown(), flightId);
    await AsyncStorage.setItem(DISCOVERY_STORAGE_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
}
