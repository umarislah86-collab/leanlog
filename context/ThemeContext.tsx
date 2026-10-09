import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StyleSheet } from 'react-native';
import { APP_THEME_KEY, appThemes, themeColour, themeStyleSheet, validThemeId, type AppThemeId, type ColourRole } from '../services/appTheme';
import { loadThemeFonts } from '../services/themeFonts';

const defaultTheme = { palette: appThemes.cream as typeof appThemes[AppThemeId], ready: true, fontsLoaded: false, saving: false, setTheme: async (_id: AppThemeId) => {}, themed: (value: string, role?: ColourRole) => themeColour(value, appThemes.cream, role) };
const ThemeContext = createContext(defaultTheme);
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [id, setId] = useState<AppThemeId>('cream');
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    const preference = AsyncStorage.getItem(APP_THEME_KEY).then(value => { if (active) setId(validThemeId(value)); }).catch(console.warn);
    const fonts = loadThemeFonts().then(() => { if (active) setFontsLoaded(true); }).catch(console.warn);
    Promise.all([preference, fonts]).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  const setTheme = useCallback(async (next: AppThemeId) => {
    if (lock.current) throw new Error('Another appearance change is being saved.');
    lock.current = true; setSaving(true);
    try { await AsyncStorage.setItem(APP_THEME_KEY, validThemeId(next)); setId(validThemeId(next)); }
    finally { lock.current = false; setSaving(false); }
  }, []);
  const palette = appThemes[id];
  const themed = useCallback((value: string, role?: ColourRole) => themeColour(value, palette, role), [palette]);
  const value = useMemo(() => ({ palette, ready, fontsLoaded, saving, setTheme, themed }), [palette, ready, fontsLoaded, saving, setTheme, themed]);
  return <ThemeContext.Provider value={value}>{ready ? children : null}</ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);
const cache = new WeakMap<object, Map<AppThemeId, object>>();
/** Cached per palette; context updates memoized children too, without remounting. */
export function useThemeStyles<T extends StyleSheet.NamedStyles<T>>(base: T): T {
  const { palette } = useTheme();
  if (palette.id === 'cream') return base;
  let variants = cache.get(base);
  if (!variants) { variants = new Map(); cache.set(base, variants); }
  let styles = variants.get(palette.id);
  if (!styles) { styles = StyleSheet.create(themeStyleSheet(base, palette)); variants.set(palette.id, styles); }
  return styles as T;
}
