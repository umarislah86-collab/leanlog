import { ThemeTouchableOpacity as TouchableOpacity, ThemeView as View, ThemeSafeAreaView as SafeAreaView } from '../components/ThemeSurfaces';
import React, { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Modal } from 'react-native';

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
  const [visible, setVisible] = useState(false), [ready, setReady] = useState(false);
  const [params, setParams] = useState<SettingsParams>(EMPTY_PARAMS), [settingsRevision, setSettingsRevision] = useState(0);
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
    setReady(false);
    setSettingsRevision(v => v + 1);
  }, [motion]);
  const openSettings = useCallback((next: SettingsParams = EMPTY_PARAMS) => {
    if (opened.current) return;
    opened.current = true;
    motion.stopAnimation();
    motion.setValue(0);
    setParams(next);
    setVisible(true);
  }, [motion]);
  const openMenu = useCallback(() => openSettings(), [openSettings]);
  // Opening the drawer must not invalidate every screen's menu subscription.
  const api = useMemo(() => ({ settingsRevision, openMenu, openSettings }), [settingsRevision, openMenu, openSettings]);
  const reveal = useCallback(() => {
    Animated.timing(motion, { toValue: 1, duration: reduceMotion.current ? 0 : 160, useNativeDriver: true }).start(({ finished }) => {
      if (finished && opened.current) setReady(true);
    });
  }, [motion]);
  return <AppMenu.Provider value={api}>{children}
    <Modal visible={visible} transparent animationType="none" onShow={reveal} onRequestClose={close}>
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,.45)' }}>
        <Animated.View style={{ width: '92%', maxWidth: 480, backgroundColor: p.canvas, transform: [{ translateX: motion.interpolate({ inputRange: [0, 1], outputRange: [-480, 0] }) }] }}>
          {ready ? <DrawerSettings drawer menuParams={params} onClose={close} /> : <SafeAreaView style={{ flex: 1, padding: 18 }}><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={{ color: p.text, fontSize: 28, fontWeight: '800' }}>Settings</Text><TouchableOpacity accessibilityLabel="Close Settings" onPress={close} style={{ padding: 12 }}><Ionicons name="close" size={24} color={p.text} /></TouchableOpacity></View></SafeAreaView>}
        </Animated.View>
        <TouchableOpacity accessibilityLabel="Dismiss Settings" style={{ flex: 1 }} onPress={close} />
      </View>
    </Modal>
  </AppMenu.Provider>;
}
