import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';

function toFileUri(uri: string): string {
  if (!uri) return uri;
  if (uri.startsWith('file://') || uri.startsWith('content:') || uri.startsWith('data:')) return uri;
  return `file://${uri}`;
}

/** Save/share an image without media-library permissions (Android Photo Picker / share sheet). */
export async function saveImageToPhotos(uri: string): Promise<boolean> {
  const fileUri = toFileUri(uri);
  if (Platform.OS === 'web') return false;
  try {
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(fileUri, {
      mimeType: 'image/jpeg',
      UTI: 'public.jpeg',
      dialogTitle: 'Save image',
    });
    return true;
  } catch (e) {
    console.warn('[saveImage] failed', e);
    return false;
  }
}
