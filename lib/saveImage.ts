import { Platform } from 'react-native';

function toFileUri(uri: string): string {
  if (!uri) return uri;
  if (uri.startsWith('file://') || uri.startsWith('content:') || uri.startsWith('data:')) return uri;
  return `file://${uri}`;
}

export async function saveImageToPhotos(uri: string): Promise<boolean> {
  const fileUri = toFileUri(uri);
  if (Platform.OS === 'web') return false;
  try {
    const MediaLibrary = require('expo-media-library') as typeof import('expo-media-library');
    const perm = await MediaLibrary.requestPermissionsAsync(true);
    if (!perm.granted) return false;
    await MediaLibrary.saveToLibraryAsync(fileUri);
    return true;
  } catch {
    return false;
  }
}
