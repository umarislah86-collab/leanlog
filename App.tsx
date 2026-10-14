import { cloudDeadline } from './services/cloudDeadline';
import { ThemeText as Text } from './components/ThemePrimitives';
import { ThemeProvider, useTheme, useThemeStyles } from './context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, TouchableOpacity, View, StyleSheet, Modal } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { auth, onAuthChange, fsFetchAll, fsFetchSettings, fsFetchAppState, type User } from './firebase';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { useTrial } from './hooks/useTrial';
import HomeScreen from './screens/HomeScreen';
import TodayScreen from './screens/TodayScreen';
import ProgressScreen from './screens/ProgressScreen';
import { AppMenuProvider } from './context/AppMenuContext';
import CoachScreen from './screens/CoachScreen';
import RedCoinsScreen from './screens/RedCoinsScreen';
import { MainNavigationDock } from './components/MainNavigationDock';
import { NavigationDockProvider } from './context/NavigationDockContext';
import AuthScreen from './screens/AuthScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import PaywallScreen from './screens/PaywallScreen';
import { colors } from './theme';
import { themeFont } from './services/appTheme';
import { ensureNagSchedule, markFastingDay, markLazyDay, snoozeNagging } from './services/nagging';
import { startRedCoinsAutoBackup } from './services/redcoinsBackupFiles';
import { handleCardioNotification } from './services/cardioRuntime';

let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async (notification: any) => ({
      shouldShowAlert: notification.request?.content?.data?.kind !== 'cardio-cue',
      shouldShowBanner: notification.request?.content?.data?.kind !== 'cardio-cue',
      shouldShowList: notification.request?.content?.data?.kind !== 'cardio-cue',
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
} catch {}

const Tab = createMaterialTopTabNavigator();

function MainTabs() {
  const { t } = useLanguage();
  return (
    <AppMenuProvider><NavigationDockProvider><Tab.Navigator tabBarPosition="bottom" tabBar={(props) => <MainNavigationDock {...props} />} backBehavior="history" screenOptions={{ swipeEnabled: true, lazy: true }}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="Log" component={TodayScreen} options={{ title: 'Log' }} />
      <Tab.Screen name="Progress" component={ProgressScreen} options={{ title: t('tabProgress') }} />
      <Tab.Screen name="Coach" component={CoachScreen} options={{ title: t('tabCoach') }} />
      <Tab.Screen name="RedCoins" component={RedCoinsScreen} options={{ title: 'RedCoins', swipeEnabled: false }} />
    </Tab.Navigator></NavigationDockProvider></AppMenuProvider>
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
  const pendingCardioOpen = useRef<number | null>(null);
  const openPendingCardio = () => {
    if (pendingCardioOpen.current && navigationRef.isReady() && navigationRef.getRootState()?.routeNames?.includes('Coach')) {
      const cardioOpen = pendingCardioOpen.current;
      pendingCardioOpen.current = null;
      navigationRef.navigate('Coach', { cardioOpen });
    }
  };
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [authReady, setAuthReady] = useState(false);
  const [bootError, setBootError] = useState('');
  const [bootAttempt, setBootAttempt] = useState(0);
  const [hasProfile, setHasProfile] = useState(false);
  const [showSnoozePicker, setShowSnoozePicker] = useState(false);
  const { status: trialStatus, recheck: recheckTrial } = useTrial(!!user && hasProfile && authReady);

  useEffect(() => {
    ensureNagSchedule().catch(() => {});
    if (!Notifications?.addNotificationResponseReceivedListener) return;
    const receive = async (response: any) => {
      const action = response.actionIdentifier;
      const data = response.notification?.request?.content?.data;
      if (data?.kind === 'cardio' || data?.kind === 'cardio-cue') {
        try { await handleCardioNotification(response); } catch (error) { Alert.alert('Cardio Companion', String(error)); }
        pendingCardioOpen.current = Date.now();
        openPendingCardio();
        await Notifications.clearLastNotificationResponseAsync?.();
        return;
      }
      if (action === 'NAG_SNOOZE') setShowSnoozePicker(true);
      if (action === 'NAG_LAZY') await markLazyDay();
      if (action === 'NAG_LOG' || (action === Notifications.DEFAULT_ACTION_IDENTIFIER && data?.kind?.startsWith('nag'))) {
        setTimeout(() => navigationRef.navigate('Log', { fabTrigger: Date.now() }), 350);
      }
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(receive);
    void Notifications.getLastNotificationResponseAsync?.().then((response: any) => {
      const kind = response?.notification?.request?.content?.data?.kind;
      if (kind === 'cardio' || kind === 'cardio-cue') return receive(response);
    }).catch(console.warn);
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

    let active = true;
    const autoRestoreFromCloud = async (uid: string) => cloudDeadline(async deadlineCheck => {
      const check = () => {
        deadlineCheck();
        if (!active || auth.currentUser?.uid !== uid) throw new Error('Startup account changed.');
      };
      const [fsFood, fsActs, fsWeights, fsSettings, fullState] = await Promise.all([fsFetchAll<any>('foodEntries'), fsFetchAll<any>('activityEntries'), fsFetchAll<any>('weightEntries'), fsFetchSettings(), fsFetchAppState()]);
      check();
      if (fullState) {
        await AsyncStorage.multiSet(Object.entries(fullState));
      } else {
        if (fsFood.length) await AsyncStorage.setItem('calorie_entries', JSON.stringify(fsFood));
        if (fsActs.length) await AsyncStorage.setItem('activity_entries', JSON.stringify(fsActs));
        if (fsWeights.length) await AsyncStorage.setItem('weight_entries', JSON.stringify(fsWeights));
        if (fsSettings?.goal) await AsyncStorage.setItem('calorie_goal', String(fsSettings.goal));
        if (fsSettings?.profile) await AsyncStorage.setItem('user_profile', JSON.stringify(fsSettings.profile));
      }
    }, 12000, 'Cloud restore did not respond within 12 seconds. Retry when connected.');

    setBootError('');
    const unsub = onAuthChange(async (u) => {
      try {
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
        await autoRestoreFromCloud(u.uid);
      } else {
        // Same user returning — only restore if local is missing
        const [localFood, localActivities, localProfile] = await Promise.all([AsyncStorage.getItem('calorie_entries'), AsyncStorage.getItem('activity_entries'), AsyncStorage.getItem('user_profile')]);
        // An empty history is valid. Returning users with local data never wait for restore.
        if (localFood === null && localActivities === null && localProfile === null) {
          await autoRestoreFromCloud(u.uid);
        }
      }

      const localProfile = await AsyncStorage.getItem('user_profile');
      if (!active || auth.currentUser?.uid !== u.uid) return;
      setHasProfile(!!localProfile);
      setUser(u);
      setAuthReady(true);
      } catch (error) { if (active && auth.currentUser?.uid === u?.uid) setBootError(error instanceof Error ? error.message : String(error)); }
    });
    return () => { active = false; unsub(); };
  }, [bootAttempt]);

  if (bootError || trialStatus === 'error') {
    return <View style={{flex:1,backgroundColor:palette.canvas,justifyContent:'center',padding:24}}>
      <Text style={{color:palette.text}}>Unable to finish startup. {bootError || 'License check did not respond. Please retry.'}</Text>
      <TouchableOpacity accessibilityRole="button" onPress={() => { setBootError(''); if (trialStatus === 'error') void recheckTrial(); else setBootAttempt(v => v + 1); }} style={{padding:16}}><Text style={{color:palette.accent}}>Retry</Text></TouchableOpacity>
    </View>;
  }

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
          onReady={openPendingCardio}
          onStateChange={openPendingCardio}
          theme={{ ...navigationBase, fonts: { regular: navigationFont('regular', 400), medium: navigationFont('medium', 500), bold: navigationFont('bold', 700), heavy: navigationFont('heavy', 800) }, colors: { ...navigationBase.colors, primary: palette.accent, background: palette.canvas, card: palette.surface, text: palette.text, border: palette.border } }}
          linking={{
            prefixes: ['leanlog://'],
            config: {
              screens: {
                Home: 'home',
                Coach: 'coach',
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
