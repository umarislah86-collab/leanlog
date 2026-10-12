import { themeArtwork, type ArtworkPlace } from '../services/themeArtwork';
import React from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { AppThemeId } from '../services/appTheme';
import { themeMotif } from '../services/themeMotifs';
export function ThemeMotif({ id, onHero = false, size = 24, artwork }: { artwork?: ArtworkPlace; id: AppThemeId; onHero?: boolean; size?: number }) {
  const motif = artwork ? themeArtwork(id, artwork, onHero) : themeMotif(id, onHero);
  return <SvgXml xml={motif.svg} width={size} height={size} accessible={false} />;
}
export function ThemeWatermark({ id, onHero = false, placement = 'card', artwork }: { artwork?: ArtworkPlace; id: AppThemeId; onHero?: boolean; placement?: 'card' | 'home' | 'dock' | 'page' }) {
  const size = (placement === 'home' || placement === 'page') ? 220 : placement === 'dock' ? 110 : 76;
  const position = placement === 'page' ? { right: -12, top: 42 } : placement === 'home' ? { right: -12, top: 24 } : placement === 'dock' ? { right: 78, bottom: -25 } : { right: 12, bottom: 3 };
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, overflow: 'hidden' }}>
    <View style={{ position: 'absolute', ...position, opacity: placement === 'card' ? .10 : .045 }}><ThemeMotif id={id} onHero={onHero} size={size} artwork={artwork ?? (placement === 'dock' ? 'widget' : 'home')}/></View>
  </View>;
}
