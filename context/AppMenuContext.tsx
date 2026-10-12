import { ThemeTouchableOpacity as TouchableOpacity, ThemeView as View, ThemeSafeAreaView as SafeAreaView } from '../components/ThemeSurfaces';
import React, { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, BackHandler, Keyboard, StyleSheet, useWindowDimensions } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { ThemeText as Text } from '../components/ThemePrimitives';
import { useTheme } from './ThemeContext';
import SettingsScreen from '../screens/SettingsScreen';

type SettingsParams = { redcoinsImport?: boolean };
type MenuApi = { settingsRevision: number; openMenu: () => void; openSettings: (params?: SettingsParams) => void };
const EMPTY_PARAMS: SettingsParams = {};
const AppMenu = createContext<MenuApi>({ settingsRevision: 0, openMenu: () => {}, openSettings: () => {} });
const DrawerSettings = memo(SettingsScreen);
export const useAppMenu = () => useContext(AppMenu);
export function AppMenuButton() {
  const { palette: p } = useTheme(), menu = useAppMenu();
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open Settings" onPress={menu.openMenu} style={{ height: 40, width: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: p.surfaceAlt }}><Ionicons name="menu" size={25} color={p.text} /></TouchableOpacity>;
}
export function AppMenuProvider({ children }: { children: React.ReactNode }) {
  const { palette: p } = useTheme();
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(width * .92, 480);
  const [visible, setVisible] = useState(false), [ready, setReady] = useState(false);
  const [params, setParams] = useState<SettingsParams>(EMPTY_PARAMS), [settingsRevision, setSettingsRevision] = useState(0);
  const nextParams = useRef<SettingsParams>(EMPTY_PARAMS);
  const opened = useRef(false), motion = useRef(new Animated.Value(0)).current, reduceMotion = useRef(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(v => { reduceMotion.current = v; }).catch(() => {});
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', v => { reduceMotion.current = v; });
    return () => { listener.remove(); motion.stopAnimation(); };
  }, [motion]);
  const close = useCallback(() => {
    if (!opened.current) return;
    opened.current = false;
    motion.stopAnimation();
    setVisible(false);
    motion.setValue(0);
    Keyboard.dismiss();
    setSettingsRevision(v => v + 1);
  }, [motion]);
  const openSettings = useCallback((next: SettingsParams = EMPTY_PARAMS) => {
    if (opened.current) return;
    opened.current = true;
    motion.stopAnimation();
    motion.setValue(0);
    nextParams.current = next;
    setVisible(true);
    // Panel already exists: submit native animation directly from the press handler.
    Animated.timing(motion, { toValue: 1, duration: reduceMotion.current ? 0 : 160, useNativeDriver: true }).start(({ finished }) => {
      if (finished && opened.current) { setParams(nextParams.current); setReady(true); }
    });
  }, [motion]);
  const openMenu = useCallback(() => openSettings(), [openSettings]);
  // Opening the drawer must not invalidate every screen's menu subscription.
  const api = useMemo(() => ({ settingsRevision, openMenu, openSettings }), [settingsRevision, openMenu, openSettings]);
  // Prepare Settings offscreen once; repeated openings reuse the mounted tree.
  useEffect(() => {
    const warmup = setTimeout(() => setReady(true), 600);
    return () => clearTimeout(warmup);
  }, []);
  useEffect(() => {
    if (!visible) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { close(); return true; });
    return () => listener.remove();
  }, [visible, close]);
  return <AppMenu.Provider value={api}><View style={{ flex: 1 }}>
    <View style={{ flex: 1 }} accessibilityElementsHidden={visible} importantForAccessibility={visible ? 'no-hide-descendants' : 'auto'}>{children}</View>
    <Animated.View testID="settings-drawer" pointerEvents={visible ? 'auto' : 'none'} accessibilityElementsHidden={!visible} importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'} accessibilityViewIsModal={visible} style={[StyleSheet.absoluteFill, { zIndex: 1000, elevation: 1000, flexDirection: 'row', opacity: motion }]}>
      <TouchableOpacity accessibilityLabel="Dismiss Settings" onPress={close} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,.45)' }]} />
      <Animated.View style={{ width: panelWidth, backgroundColor: p.canvas, transform: [{ translateX: motion.interpolate({ inputRange: [0, 1], outputRange: [-panelWidth, 0] }) }] }}>
        {ready ? <DrawerSettings drawer menuParams={params} onClose={close} /> : <SafeAreaView style={{ flex: 1, padding: 18 }}><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={{ color: p.text, fontSize: 28, fontWeight: '800' }}>Settings</Text><TouchableOpacity accessibilityLabel="Close Settings" onPress={close} style={{ padding: 12 }}><Ionicons name="close" size={24} color={p.text} /></TouchableOpacity></View></SafeAreaView>}
      </Animated.View>
    </Animated.View>
  </View></AppMenu.Provider>;
}
