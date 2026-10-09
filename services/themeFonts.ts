import * as Font from 'expo-font';

// Direct asset references keep unused Google Fonts weights/images out of Metro.
export const themeFontAssets = {
  LeanLogLoraRegular: require('@expo-google-fonts/lora/400Regular/Lora_400Regular.ttf'),
  LeanLogLoraMedium: require('@expo-google-fonts/lora/500Medium/Lora_500Medium.ttf'),
  LeanLogLoraBold: require('@expo-google-fonts/lora/700Bold/Lora_700Bold.ttf'),
  LeanLogManropeRegular: require('@expo-google-fonts/manrope/400Regular/Manrope_400Regular.ttf'),
  LeanLogManropeMedium: require('@expo-google-fonts/manrope/500Medium/Manrope_500Medium.ttf'),
  LeanLogManropeBold: require('@expo-google-fonts/manrope/700Bold/Manrope_700Bold.ttf'),
  LeanLogSpaceGroteskRegular: require('@expo-google-fonts/space-grotesk/400Regular/SpaceGrotesk_400Regular.ttf'),
  LeanLogSpaceGroteskMedium: require('@expo-google-fonts/space-grotesk/500Medium/SpaceGrotesk_500Medium.ttf'),
  LeanLogSpaceGroteskBold: require('@expo-google-fonts/space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf'),
};
export const loadThemeFonts = () => Font.loadAsync(themeFontAssets);
