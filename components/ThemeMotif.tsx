import React from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { AppThemeId } from '../services/appTheme';
import { themeMotif } from '../services/themeMotifs';
export function ThemeMotif({ id, onHero = false, size = 24 }: { id: AppThemeId; onHero?: boolean; size?: number }) {
  const motif = themeMotif(id, onHero);
  return <SvgXml xml={motif.svg} width={size} height={size} accessible={false} />;
}
export function ThemeWatermark({ id, onHero = false }: { id: AppThemeId; onHero?: boolean }) {
  return <View pointerEvents="none" accessible={false} style={{ position: 'absolute', right: 12, bottom: 3, opacity: .10 }}><ThemeMotif id={id} onHero={onHero} size={76}/></View>;
}
