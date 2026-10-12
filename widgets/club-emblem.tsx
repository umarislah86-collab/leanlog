'use no memo';
import React from 'react';
import { SvgWidget } from 'react-native-android-widget';
import type { AppThemeId } from '../services/appTheme';
import { themeMotif } from '../services/themeMotifs';
export function clubEmblem(id: AppThemeId, onHero = false) {
  const motif = themeMotif(id, onHero);
  const height = id === 'arsenal' ? 11 : 18;
  return <SvgWidget svg={motif.svg} style={{ width: Math.round(height * motif.ratio), height, marginRight: 5 }} />;
}
