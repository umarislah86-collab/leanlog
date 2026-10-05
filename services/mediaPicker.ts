import type * as ImagePicker from 'expo-image-picker';

/** Do not open a redundant permission Activity before the system picker. */
export async function openNativeImagePicker(picker: typeof ImagePicker, useCamera: boolean) {
  if (!useCamera) {
    return picker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 });
  }
  let permission = await picker.getCameraPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) {
    permission = await picker.requestCameraPermissionsAsync();
  }
  if (!permission.granted) return null;
  return picker.launchCameraAsync({ mediaTypes: 'images', quality: 0.8 });
}
