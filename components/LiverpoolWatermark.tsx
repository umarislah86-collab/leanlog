import { ThemeView as View } from './ThemeSurfaces';
import React from 'react';
import { Image } from 'react-native';
/** Local Liver bird from the official Liverpool FC site; purely decorative. */
export function LiverpoolWatermark({ colour = '#E1C685', height = 80 }: { colour?: string; height?: number }) {
  return <View pointerEvents="none" style={{ position: 'absolute', right: 14, bottom: 4, width: height * 34 / 61, height }}><Image source={require('../assets/liverpool-liverbird.png')} accessible={false} resizeMode="contain" style={{ width: '100%', height: '100%', tintColor: colour, opacity: .12 }} /></View>;
}
