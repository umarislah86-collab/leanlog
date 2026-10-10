import { ThemeText as Text } from './components/ThemePrimitives';
import { ThemeProvider, useTheme, useThemeStyles } from './context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, TouchableOpacity, View, StyleSheet, Modal } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { onAuthChange, fsFetchAll, fsFetchSettings, fsFetchAppState, type User } from './firebase';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { useTrial } from './hooks/useTrial';
import HomeScreen from './screens/HomeScreen';
import TodayScreen from './screens/TodayScreen';
import ProgressScreen from './screens/ProgressScreen';
import SettingsScreen from './screens/SettingsScreen';
import CoachScreen from './screens/CoachScreen';
import RedCoinsScreen from './screens/RedCoinsScreen';
import AuthScreen from './screens/AuthScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import PaywallScreen from './screens/PaywallScreen';
import { colors } from './theme';
import { themeFont } from './services/appTheme';
import { ensureNagSchedule, markFastingDay, markLazyDay, snoozeNagging } from './services/nagging';
import { startRedCoinsAutoBackup } from './services/redcoinsBackupFiles';

let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
} catch {}

const Tab = createMaterialTopTabNavigator();

const TAB_ICONS: Record<string, string> = {
  Home: 'home',
  Log: 'restaurant',
  Progress: 'bar-chart',
  Coach: 'leaf',
  RedCoins: 'wallet',
  Settings: 'settings',
};

function CustomTabBar({ state, descriptors, navigation }: any) {
  const quickDock = useThemeStyles(baseQuickDock);
  const { themed } = useTheme();
  const insets = useSafeAreaInsets();
  const [quickDockOpen, setQuickDockOpen] = useState(false);
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
      {state.routes
        .map((route: any, index: number) => ({ route, index }))
        .map(({ route, index }: any) => {
          const focused = state.index === index;
          const color = themed(focused ? colors.coral : '#5F6670');
          const iconBase = TAB_ICONS[route.name] ?? 'ellipse';
          const iconName = focused ? iconBase : `${iconBase}-outline`;
          const label = descriptors[route.key].options.title ?? route.name;
          return (
            <TouchableOpacity key={route.key} style={{ flex: 1, alignItems: 'center', paddingVertical: 5 }} onPress={() => navigation.navigate(route.name)}>
              <Ionicons name={iconName as any} size={24} color={color} />
              <Text
                style={{
                  color,
                  fontSize: 10,
                  marginTop: 2,
                  fontWeight: focused ? '800' : '500',
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

function MainTabs() {
  const { t } = useLanguage();
  return (
    <Tab.Navigator tabBarPosition="bottom" tabBar={(props) => <CustomTabBar {...props} />} screenOptions={{ swipeEnabled: true }}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="Log" component={TodayScreen} options={{ title: 'Log' }} />
      <Tab.Screen name="Progress" component={ProgressScreen} options={{ title: t('tabProgress') }} />
      <Tab.Screen name="Coach" component={CoachScreen} options={{ title: t('tabCoach') }} />
      <Tab.Screen name="RedCoins" component={RedCoinsScreen} options={{ title: 'RedCoins', swipeEnabled: false }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Tab.Navigator>
  );
}

export default function App() {
  return <ThemeProvider><AppStatusBar /><AppContent /></ThemeProvider>;
}

function AppStatusBar() {
  const { palette } = useTheme();
  return <StatusBar style={palette.dark ? 'light' : 'dark'} />;
}

function AppContent() {
  const { palette, fontsLoaded } = useTheme();
  const navigationBase = palette.dark ? DarkTheme : DefaultTheme;
  const navigationFont = (role: keyof typeof navigationBase.fonts, weight: number) => ({ ...navigationBase.fonts[role], ...(fontsLoaded ? themeFont(palette.id, { fontWeight: weight }, 'body') : {}) });
  const snooze = useThemeStyles(baseSnooze);
  useEffect(() => startRedCoinsAutoBackup(), []);
  const navigationRef = useNavigationContainerRef<any>();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [authReady, setAuthReady] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [showSnoozePicker, setShowSnoozePicker] = useState(false);
  const { status: trialStatus, recheck: recheckTrial } = useTrial(!!user && hasProfile && authReady);

  useEffect(() => {
    ensureNagSchedule().catch(() => {});
    if (!Notifications?.addNotificationResponseReceivedListener) return;
    const subscription = Notifications.addNotificationResponseReceivedListener(async (response: any) => {
      const action = response.actionIdentifier;
      const data = response.notification?.request?.content?.data;
      if (action === 'NAG_SNOOZE') setShowSnoozePicker(true);
      if (action === 'NAG_LAZY') await markLazyDay();
      if (action === 'NAG_LOG' || (action === Notifications.DEFAULT_ACTION_IDENTIFIER && data?.kind?.startsWith('nag'))) {
        setTimeout(() => navigationRef.navigate('Log', { fabTrigger: Date.now() }), 350);
      }
    });
    return () => subscription.remove();
  }, [navigationRef]);

  const chooseSnooze = async (minutes: number) => {
    setShowSnoozePicker(false);
    await snoozeNagging(minutes / 60);
  };

  const chooseFastingDay = async () => {
    setShowSnoozePicker(false);
    await markFastingDay();
  };

  const trialReady = !user || !hasProfile || trialStatus !== 'loading';

  useEffect(() => {
    const DATA_KEYS = ['calorie_entries', 'activity_entries', 'weight_entries', 'calorie_goal', 'user_profile'];

    const clearLocalData = () => Promise.all(DATA_KEYS.map((k) => AsyncStorage.removeItem(k)));

    const autoRestoreFromCloud = async () => {
      const [fsFood, fsActs, fsWeights, fsSettings, fullState] = await Promise.all([fsFetchAll<any>('foodEntries'), fsFetchAll<any>('activityEntries'), fsFetchAll<any>('weightEntries'), fsFetchSettings(), fsFetchAppState()]);
      if (fullState) {
        await AsyncStorage.multiSet(Object.entries(fullState));
      } else {
        if (fsFood.length) await AsyncStorage.setItem('calorie_entries', JSON.stringify(fsFood));
        if (fsActs.length) await AsyncStorage.setItem('activity_entries', JSON.stringify(fsActs));
        if (fsWeights.length) await AsyncStorage.setItem('weight_entries', JSON.stringify(fsWeights));
        if (fsSettings?.goal) await AsyncStorage.setItem('calorie_goal', String(fsSettings.goal));
        if (fsSettings?.profile) await AsyncStorage.setItem('user_profile', JSON.stringify(fsSettings.profile));
      }
    };

    const unsub = onAuthChange(async (u) => {
      if (!u) {
        // Logged out — just update React state; login handler owns data clearing
        setHasProfile(false);
        setUser(null);
        setAuthReady(true);
        return;
      }

      const lastUID = await AsyncStorage.getItem('last_uid');

      if (lastUID !== u.uid) {
        // First login ever, or different user — clear any stale data then restore
        await clearLocalData();
        await AsyncStorage.setItem('last_uid', u.uid);
        await autoRestoreFromCloud();
      } else {
        // Same user returning — only restore if local is missing
        const [localFood, localActivities] = await Promise.all([AsyncStorage.getItem('calorie_entries'), AsyncStorage.getItem('activity_entries')]);
        const foodMissing = !localFood || localFood === '[]';
        const activitiesMissing = !localActivities || localActivities === '[]';
        if (foodMissing || activitiesMissing) {
          await autoRestoreFromCloud();
        }
      }

      const localProfile = await AsyncStorage.getItem('user_profile');
      setHasProfile(!!localProfile);
      setUser(u);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  if (!authReady || !trialReady) {
    return <View style={{ flex: 1, backgroundColor: palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator accessibilityLabel="Loading LeanLog" color={palette.accent} />
    </View>;
  }

  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <NavigationContainer
          ref={navigationRef}
          theme={{ ...navigationBase, fonts: { regular: navigationFont('regular', 400), medium: navigationFont('medium', 500), bold: navigationFont('bold', 700), heavy: navigationFont('heavy', 800) }, colors: { ...navigationBase.colors, primary: palette.accent, background: palette.canvas, card: palette.surface, text: palette.text, border: palette.border } }}
          linking={{
            prefixes: ['leanlog://'],
            config: {
              screens: {
                Home: 'home',
                Log: { path: 'quick/:quickAction' },
                RedCoins: { path: 'redcoins/:mode?' },
              },
            },
          }}
        >
          {user ? hasProfile ? trialStatus === 'expired' ? <PaywallScreen onRecheck={recheckTrial} /> : <MainTabs /> : <OnboardingScreen onComplete={() => setHasProfile(true)} /> : <AuthScreen />}
        </NavigationContainer>
        <Modal visible={showSnoozePicker} transparent animationType="fade" onRequestClose={() => setShowSnoozePicker(false)}>
          <View style={snooze.overlay}>
            <View style={snooze.sheet}>
              <Text style={snooze.eyebrow}>SUPER-KAREN · TEMPORARY CEASEFIRE</Text>
              <Text style={snooze.title}>How long do you need?</Text>
              <Text style={snooze.body}>Choose wisely. I will return with documentation demands.</Text>
              <View style={snooze.options}>
                <TouchableOpacity style={snooze.option} onPress={() => chooseSnooze(20)}>
                  <Text style={snooze.optionValue}>20</Text>
                  <Text style={snooze.optionLabel}>MIN</Text>
                </TouchableOpacity>
                <TouchableOpacity style={snooze.option} onPress={() => chooseSnooze(45)}>
                  <Text style={snooze.optionValue}>45</Text>
                  <Text style={snooze.optionLabel}>MIN</Text>
                </TouchableOpacity>
                <TouchableOpacity style={snooze.option} onPress={() => chooseSnooze(60)}>
                  <Text style={snooze.optionValue}>1</Text>
                  <Text style={snooze.optionLabel}>HOUR</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={snooze.fasting} onPress={chooseFastingDay}>
                <Text style={snooze.fastingText}>🌙 Puasa sunat hari ini</Text>
                <Text style={snooze.fastingHint}>Stop all remaining nags until tomorrow</Text>
              </TouchableOpacity>
              <TouchableOpacity style={snooze.cancel} onPress={() => setShowSnoozePicker(false)}>
                <Text style={snooze.cancelText}>Never mind</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

const baseSnooze = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(8,14,24,0.72)',
  },
  sheet: {
    backgroundColor: '#FFFDF7',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 30,
  },
  eyebrow: {
    color: '#FF6542',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  title: {
    color: '#101A2B',
    fontFamily: 'serif',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 6,
  },
  body: { color: '#68758A', fontSize: 12, lineHeight: 18, marginTop: 5 },
  options: { flexDirection: 'row', gap: 9, marginTop: 18 },
  option: {
    flex: 1,
    backgroundColor: '#17243A',
    borderRadius: 17,
    paddingVertical: 15,
    alignItems: 'center',
  },
  optionValue: { color: '#FFF4DB', fontSize: 23, fontWeight: '900' },
  optionLabel: {
    color: '#91DCBB',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 2,
  },
  fasting: {
    backgroundColor: '#E8E8FF',
    borderRadius: 17,
    padding: 14,
    marginTop: 10,
  },
  fastingText: { color: '#33326D', fontSize: 13, fontWeight: '900' },
  fastingHint: { color: '#66659A', fontSize: 9, marginTop: 3 },
  cancel: { alignItems: 'center', padding: 13, marginTop: 3 },
  cancelText: { color: '#68758A', fontSize: 11, fontWeight: '800' },
});

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
