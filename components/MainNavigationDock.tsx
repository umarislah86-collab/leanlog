import { ThemeAnimatedView } from './ThemeSurfaces';
import { ThemeTouchableOpacity as TouchableOpacity, ThemeView as View } from './ThemeSurfaces';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeText as Text } from './ThemePrimitives';
import { useTheme, useThemeStyles } from '../context/ThemeContext';
import { useMoneyNavigation } from '../context/NavigationDockContext';
import { redcoinsSections } from '../services/redcoinsSwipe';
import { colors } from '../theme';
import { RedCoinsMark } from './RedCoinsMark';

const TAB_ICONS: Record<string, string> = {
  Home: 'home',
  Log: 'restaurant',
  Progress: 'bar-chart',
  Coach: 'leaf',
  RedCoins: 'wallet',
  Settings: 'settings',
};

export function MainNavigationDock({ state, descriptors, navigation }: any) {
  const quickDock = useThemeStyles(baseQuickDock);
  const { themed, palette } = useTheme();
  const insets = useSafeAreaInsets();
  const [quickDockOpen, setQuickDockOpen] = useState(false);
  const money = useMoneyNavigation();
  const isMoney = state.routes[state.index]?.name === 'RedCoins';
  const motion = useRef(new Animated.Value(isMoney ? 1 : 0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (live) setReduceMotion(value); }).catch(() => {});
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { live = false; listener.remove(); };
  }, []);
  useEffect(() => {
    const animation = Animated.timing(motion, { toValue: isMoney ? 1 : 0, duration: reduceMotion ? 0 : 460,
      easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [isMoney, motion, reduceMotion]);
  const leanlogMotion = {
    opacity: motion.interpolate({ inputRange: [0, 0.42, 1], outputRange: [1, 0, 0], extrapolate: 'clamp' }),
    transform: [{ translateY: motion.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0, 88, 88], extrapolate: 'clamp' }) }],
  };
  const moneyMotion = {
    opacity: motion.interpolate({ inputRange: [0, 0.32, 1], outputRange: [0, 0, 1], extrapolate: 'clamp' }),
    transform: [{ translateY: motion.interpolate({ inputRange: [0, 0.32, 1], outputRange: [88, 88, 0], extrapolate: 'clamp' }) }],
  };
  const launch = (route: 'Log' | 'RedCoins', params: Record<string, unknown>) => {
    setQuickDockOpen(false);
    setTimeout(() => navigation.navigate(route, params), 120);
  };
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: themed(colors.oat, 'backgroundColor'),
        borderTopColor: themed('rgba(16, 26, 43, 0.10)', 'borderColor'),
        borderTopWidth: 1,
        paddingBottom: insets.bottom || 6,
        paddingTop: 6,
      }}
    >
      <View style={{ flex: 1, height: 64, overflow: 'hidden' }}>
      <ThemeAnimatedView pointerEvents={isMoney ? 'none' : 'auto'} accessibilityElementsHidden={isMoney} importantForAccessibility={isMoney ? 'no-hide-descendants' : 'auto'}
        style={[StyleSheet.absoluteFill, { flexDirection: 'row', alignItems: 'center' }, leanlogMotion]}>
      {state.routes
        .map((route: any, index: number) => ({ route, index }))
        .map(({ route, index }: any) => {
          const focused = state.index === index;
          const branded = route.name === 'RedCoins';
          const color = branded ? (palette.dark ? '#F2C879' : '#A62B32') : themed(focused ? colors.coral : '#5F6670');
          const iconBase = TAB_ICONS[route.name] ?? 'ellipse';
          const iconName = focused ? iconBase : `${iconBase}-outline`;
          const label = descriptors[route.key].options.title ?? route.name;
          return (
            <TouchableOpacity key={route.key} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={label} style={{ flex: 1, alignItems: 'center', paddingVertical: 5 }} onPress={() => navigation.navigate(route.name)}>
              <View style={{ height: 24, justifyContent: 'center', alignItems: 'center' }}>
                {branded ? <RedCoinsMark size={24} /> : <Ionicons name={iconName as any} size={24} color={color} />}
              </View>
              <Text
                style={{
                  color,
                  fontSize: 10,
                  marginTop: 2,
                  fontWeight: branded || focused ? '800' : '500',
                }}
              >
                {label}
              </Text>
              <View
                style={{
                  width: focused ? 28 : 0,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: themed(colors.coral, 'backgroundColor'),
                  marginTop: 5,
                }}
              />
            </TouchableOpacity>
          );
        })}
      </ThemeAnimatedView>
      <ThemeAnimatedView pointerEvents={isMoney ? 'auto' : 'none'} accessibilityElementsHidden={!isMoney} importantForAccessibility={isMoney ? 'auto' : 'no-hide-descendants'}
        style={[StyleSheet.absoluteFill, { flexDirection: 'row', alignItems: 'center', backgroundColor: themed(colors.ink, 'backgroundColor'), borderRadius: 20, padding: 4, marginLeft: 8, marginVertical: 2 }, moneyMotion]}>
        {redcoinsSections.map(section => {
          const active = section === (money?.section || 'home');
          const ink = themed(active ? '#FFFDF7' : '#AEB8CD', 'color');
          return <TouchableOpacity key={section} accessibilityRole="tab" accessibilityState={{ selected: active }}
            accessibilityLabel={'RedCoins ' + section} disabled={!money} onPress={() => money?.select(section)}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: 15, backgroundColor: active ? themed('#303650', 'backgroundColor') : 'transparent' }}>
            <Ionicons name={({ home: 'grid', activity: 'list', accounts: 'wallet', plan: 'shield-checkmark', reports: 'bar-chart' } as const)[section]} size={19} color={ink} />
            <Text numberOfLines={1} style={{ fontSize: 9, fontWeight: active ? '800' : '500', color: ink, marginTop: 4 }}>{section[0].toUpperCase() + section.slice(1)}</Text>
          </TouchableOpacity>;
        })}
      </ThemeAnimatedView>
      </View>
      <View
        style={{
          width: 70,
          alignItems: 'center',
          marginTop: -35,
          marginRight: 7,
        }}
      >
        <TouchableOpacity
          onPress={() => setQuickDockOpen(true)}
          onLongPress={() => launch('RedCoins', { mode: 'expense', fabTrigger: Date.now() })}
          delayLongPress={350}
          activeOpacity={0.86}
          accessibilityLabel="Open quick logger"
        >
          <View
            style={{
              width: 62,
              height: 62,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: themed(colors.mint, 'backgroundColor'),
              borderWidth: 5,
              borderColor: themed(colors.oat, 'borderColor'),
              shadowColor: themed(colors.ink, 'shadowColor'),
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.24,
              shadowRadius: 9,
              elevation: 8,
            }}
          >
            <Ionicons name="add" size={34} color={themed(colors.ink, 'onAccent')} />
          </View>
        </TouchableOpacity>
      </View>
      <Modal visible={quickDockOpen} transparent animationType="fade" onRequestClose={() => setQuickDockOpen(false)}>
        <TouchableOpacity style={quickDock.overlay} activeOpacity={1} onPress={() => setQuickDockOpen(false)}>
          <View style={[quickDock.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 16 }]} onStartShouldSetResponder={() => true}>
            <View style={quickDock.handle} />
            <View style={quickDock.header}>
              <View><Text style={quickDock.eyebrow}>LEANLOG / QUICK ENTRY</Text><Text style={quickDock.title}>What moved?</Text></View>
              <TouchableOpacity style={quickDock.close} onPress={() => setQuickDockOpen(false)}><Ionicons name="close" size={20} color={themed(colors.oat, 'color')} /></TouchableOpacity>
            </View>
            <Text style={quickDock.sectionLabel}>MONEY</Text>
            <View style={quickDock.moneyRow}>
              <TouchableOpacity style={[quickDock.moneyAction, quickDock.expense]} onPress={() => launch('RedCoins', { mode: 'expense', fabTrigger: Date.now() })}><Ionicons name="arrow-up" size={20} color={themed("#FFFDF7", 'color')} /><Text style={quickDock.moneyText}>EXPENSE</Text></TouchableOpacity>
              <TouchableOpacity style={[quickDock.moneyAction, quickDock.income]} onPress={() => launch('RedCoins', { mode: 'income', fabTrigger: Date.now() })}><Ionicons name="arrow-down" size={20} color={themed("#101A2B", 'onAccent')} /><Text style={[quickDock.moneyText, quickDock.moneyTextDark]}>INCOME</Text></TouchableOpacity>
              <TouchableOpacity style={[quickDock.moneyAction, quickDock.transfer]} onPress={() => launch('RedCoins', { mode: 'transfer', fabTrigger: Date.now() })}><Ionicons name="swap-horizontal" size={20} color={themed("#FFFDF7", 'color')} /><Text style={quickDock.moneyText}>TRANSFER</Text></TouchableOpacity>
            </View>
            <Text style={quickDock.sectionLabel}>BODY</Text>
            <View style={quickDock.bodyCard}>
              <TouchableOpacity style={quickDock.bodyAction} onPress={() => launch('Log', { quickAction: 'food', fabTrigger: Date.now() })}><View style={quickDock.bodyIcon}><Ionicons name="restaurant-outline" size={20} color={themed("#101A2B", 'onAccent')} /></View><View style={{ flex: 1 }}><Text style={quickDock.bodyTitle}>Food</Text><Text style={quickDock.bodySub}>Meal, snack or drink</Text></View><Ionicons name="chevron-forward" size={17} color={themed("#7F8BA0", 'color')} /></TouchableOpacity>
              <View style={quickDock.rule} />
              <TouchableOpacity style={quickDock.bodyAction} onPress={() => launch('Log', { quickAction: 'activity', fabTrigger: Date.now() })}><View style={quickDock.bodyIcon}><Ionicons name="walk-outline" size={20} color={themed("#101A2B", 'onAccent')} /></View><View style={{ flex: 1 }}><Text style={quickDock.bodyTitle}>Activity</Text><Text style={quickDock.bodySub}>Exercise or movement</Text></View><Ionicons name="chevron-forward" size={17} color={themed("#7F8BA0", 'color')} /></TouchableOpacity>
              <View style={quickDock.rule} />
              <TouchableOpacity style={quickDock.bodyAction} onPress={() => launch('Log', { quickAction: 'weight', fabTrigger: Date.now() })}><View style={quickDock.bodyIcon}><Ionicons name="scale-outline" size={20} color={themed("#101A2B", 'onAccent')} /></View><View style={{ flex: 1 }}><Text style={quickDock.bodyTitle}>Weight</Text><Text style={quickDock.bodySub}>Record a check-in</Text></View><Ionicons name="chevron-forward" size={17} color={themed("#7F8BA0", 'color')} /></TouchableOpacity>
            </View>
            <Text style={quickDock.hint}>Long-press the + button anytime for a new expense.</Text>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const baseQuickDock = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(8,14,24,0.70)' },
  sheet: { backgroundColor: colors.oat, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 18, paddingTop: 10 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#CFC4B3', alignSelf: 'center', marginBottom: 15 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  eyebrow: { color: colors.coral, fontSize: 9, fontWeight: '900', letterSpacing: 1.7 },
  title: { color: colors.ink, fontFamily: 'serif', fontSize: 28, fontWeight: '800', marginTop: 3 },
  close: { width: 38, height: 38, borderRadius: 14, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { color: '#59616D', fontSize: 8, fontWeight: '900', letterSpacing: 1.6, marginBottom: 8 },
  moneyRow: { flexDirection: 'row', gap: 8, marginBottom: 17 },
  moneyAction: { flex: 1, minHeight: 71, borderRadius: 17, alignItems: 'center', justifyContent: 'center', gap: 7 },
  expense: { backgroundColor: colors.coral },
  income: { backgroundColor: colors.mint },
  transfer: { backgroundColor: '#528FF2' },
  moneyText: { color: '#FFFDF7', fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  moneyTextDark: { color: colors.ink },
  bodyCard: { backgroundColor: colors.ink, borderRadius: 22, paddingHorizontal: 12, overflow: 'hidden' },
  bodyAction: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11 },
  bodyIcon: { width: 36, height: 36, borderRadius: 13, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  bodyTitle: { color: '#FFF4DB', fontSize: 12, fontWeight: '900' },
  bodySub: { color: '#7F8BA0', fontSize: 9, marginTop: 3 },
  rule: { height: 1, backgroundColor: '#33415C', marginLeft: 47 },
  hint: { color: '#737A84', fontSize: 9, textAlign: 'center', marginTop: 12 },
});
