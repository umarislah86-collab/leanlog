'use no memo';
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_THEME_KEY, appThemes, validThemeId, themeFont, type AppThemeId } from '../services/appTheme';

export async function getWidgetTheme(): Promise<AppThemeId> {
  try { return validThemeId(await AsyncStorage.getItem(APP_THEME_KEY)); } catch { return 'cream'; }
}
/** Widget rendering is headless: no React context/hooks or runtime Expo font loading. */
export function widgetThemeStyle(style: Record<string, any>, id: AppThemeId, text?: string) {
  if (id === 'cream') return style;
  const p = appThemes[id];
  const expense = p.dark ? p.expense : '#B52D36'; const income = p.dark ? p.income : '#146B50';
  const bg: Record<string, string> = {
    '#F7EEDC': p.canvas, '#EEE3CF': p.surfaceAlt, '#E9E3D7': p.surfaceAlt,
    '#DED5C6': p.border, '#172033': p.hero, '#26334A': p.heroRaised,
    '#D8EFE4': p.mintTint, '#FFD8CF': p.coralTint, '#83D8B4': p.mint,
    '#EF3F43': '#B52D36', '#379B73': '#146B50', '#528FF2': '#245FBD', '#FF6542': p.accent,
  };
  const fg: Record<string, string> = {
    '#172033': p.text, '#7C756B': p.muted, '#6D685F': p.text,
    '#98A0AD': p.heroMuted, '#F7EEDC': p.onHero, '#FFF4DB': p.onHero, '#FFFFFF': p.onHero,
    '#91DCBB': p.mint, '#EF3F43': expense, '#D4422B': expense, '#B33421': expense,
    '#315F50': income, '#477363': income, '#FF8069': p.dark ? p.expense : '#FFAAA0',
    '#FF6542': p.accent,
  };
  // Income quick-action label sits on mint, not a normal themed surface.
  const color = text === 'INCOME' && style.color === '#172033' ? '#172033' : fg[style.color] ?? style.color;
  const role = (style.fontSize ?? 0) >= 16 ? 'number' : (style.fontSize ?? 0) >= 14 ? 'heading' : 'body';
  const font = text !== undefined ? themeFont(id, style, role) : {};
  return { ...style, ...(style.backgroundColor ? { backgroundColor: bg[style.backgroundColor] ?? style.backgroundColor } : {}), ...(style.color ? { color } : {}), ...font, ...(text !== undefined && font.fontFamily ? { fontWeight: style.fontWeight ?? 'normal' } : {}) };
}
export function themedWidgetTree(node: React.ReactNode, id: AppThemeId): React.ReactNode {
  if (id === 'cream') return node;
  if (Array.isArray(node)) return node.map(child => themedWidgetTree(child, id));
  if (!React.isValidElement<{ style?: Record<string, any>; text?: string; children?: React.ReactNode }>(node)) return node;
  return React.cloneElement(node, { style: widgetThemeStyle(node.props.style ?? {}, id, node.props.text), children: themedWidgetTree(node.props.children, id) });
}
