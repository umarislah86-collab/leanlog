import { Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export async function deliverExport(uri: string, name: string, mimeType: string): Promise<boolean> {
  const choice = await new Promise<'save' | 'share' | null>((resolve) => Alert.alert('Export file', name, [
    { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
    ...(Platform.OS === 'android' ? [{ text: 'Save to folder', onPress: () => resolve('save' as const) }] : []),
    { text: 'Share', onPress: () => resolve('share') },
  ], { cancelable: true, onDismiss: () => resolve(null) }));
  if (!choice) return false;
  if (choice === 'save') {
    const access = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!access.granted) return false;
    const data = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    const target = await FileSystem.StorageAccessFramework.createFileAsync(access.directoryUri, name, mimeType);
    await FileSystem.writeAsStringAsync(target, data, { encoding: FileSystem.EncodingType.Base64 });
    Alert.alert('File saved', `${name} saved in your selected folder.`);
  } else {
    await Sharing.shareAsync(uri, { mimeType, dialogTitle: `Export ${name}`, ...(mimeType === 'application/pdf' ? { UTI: 'com.adobe.pdf' } : {}) });
  }
  return true;
}
