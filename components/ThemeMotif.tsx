import { themeArtwork, type ArtworkPlace } from '../services/themeArtwork';
import React, { useState } from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { AppThemeId } from '../services/appTheme';
import { themeMotif } from '../services/themeMotifs';
export function ThemeMotif({ id, onHero = false, size = 24, artwork }: { artwork?: ArtworkPlace; id: AppThemeId; onHero?: boolean; size?: number }) {
  const motif = artwork ? themeArtwork(id, artwork, onHero) : themeMotif(id, onHero);
  return <SvgXml xml={motif.svg} width={size} height={size} accessible={false} />;
}
export function ThemeWatermark({ id, onHero = false, placement = 'card', artwork }: { artwork?: ArtworkPlace; id: AppThemeId; onHero?: boolean; placement?: 'card' | 'home' | 'dock' | 'page' }) {
  const [dockHeight, setDockHeight] = useState(90);
  // Fill the dock with the central emblem, with roughly 2/3 of its height visible.
  // A wide cannon needs a larger SVG box than a circular/portrait motif.
  const emblemAspect = id === 'arsenal' ? 120 / 315 : id === 'liverpool' ? 1 : 1;
  const size = placement === 'dock' ? Math.round(dockHeight / (2 / 3) / (.875 * emblemAspect))
    : (placement === 'home' || placement === 'page') ? 280 : 140;
  const position = placement === 'page' ? { right: -18, top: 24 } : placement === 'home' ? { right: -18, top: 12 }
    : placement === 'dock' ? { right: 20, top: '50%' as const, transform: [{ translateY: -size / 2 }] } : { right: -10, bottom: -12 };
  const opacity = placement === 'home' ? .24 : placement === 'page' ? .18 : placement === 'dock' ? .20 : .18;
  return <View onLayout={placement === 'dock' ? event => { const h = Math.round(event.nativeEvent.layout.height); if (h > 0) setDockHeight(previous => previous === h ? previous : h); } : undefined} pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, overflow: 'hidden' }}>
    <View style={{ position: 'absolute', ...position, opacity }}><ThemeMotif id={id} onHero={onHero} size={size} artwork={artwork ?? (placement === 'dock' ? 'widget' : 'home')}/></View>
  </View>;
}
