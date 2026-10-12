import { ThemeView as View } from './ThemeSurfaces';
import React from 'react';
import { Image } from 'react-native';
/** Decorative cannon from Arsenal's official website; bundled for offline use. */
export function ArsenalWatermark({ colour = '#DCC18A', width = 160 }: { colour?: string; width?: number }) {
  return <View pointerEvents="none" style={{ position: 'absolute', right: -12, bottom: 8, width, height: width * 120 / 315 }}><Image source={require('../assets/arsenal-cannon.png')} accessible={false} resizeMode="contain" style={{ width: '100%', height: '100%', tintColor: colour, opacity: .12 }} /></View>;
}
