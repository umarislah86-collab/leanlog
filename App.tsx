import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, TouchableOpacity, Text, View, StyleSheet, Image } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { onAuthChange, fsFetchAll, fsFetchSettings, type User } from './firebase';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { useTrial } from './hooks/useTrial';
import HomeScreen from './screens/HomeScreen';
import TodayScreen from './screens/TodayScreen';
import ProgressScreen from './screens/ProgressScreen';
import SettingsScreen from './screens/SettingsScreen';
import CoachScreen from './screens/CoachScreen';
import AuthScreen from './screens/AuthScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import PaywallScreen from './screens/PaywallScreen';
import { colors } from './theme';
import { ensureNagSchedule, markLazyDay, snoozeNagging } from './services/nagging';

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
  Me: 'person',
};

function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.oat,
      borderTopColor: 'rgba(16, 26, 43, 0.10)',
      borderTopWidth: 1,
      paddingBottom: insets.bottom || 6,
      paddingTop: 6,
    }}>
      {state.routes.map((route: any, index: number) => {
        const focused = state.index === index;
        const color = focused ? colors.coral : '#5F6670';
        const iconBase = TAB_ICONS[route.name] ?? 'ellipse';
        const iconName = focused ? iconBase : `${iconBase}-outline`;
        const label = descriptors[route.key].options.title ?? route.name;
        return (
          <TouchableOpacity
            key={route.key}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 5 }}
            onPress={() => navigation.navigate(route.name)}
          >
            <Ionicons name={iconName as any} size={24} color={color} />
            <Text style={{ color, fontSize: 10, marginTop: 2, fontWeight: focused ? '800' : '500' }}>{label}</Text>
            <View style={{ width: focused ? 28 : 0, height: 3, borderRadius: 2, backgroundColor: colors.coral, marginTop: 5 }} />
          </TouchableOpacity>
        );
      })}
      <TouchableOpacity
        style={{ width: 70, alignItems: 'center', marginTop: -25, marginRight: 7 }}
        onPress={() => navigation.navigate('Log', { fabTrigger: Date.now() })}
        activeOpacity={0.86}
        accessibilityLabel="Add new log"
      >
        <View style={{
          width: 62, height: 62, borderRadius: 22,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: colors.mint, borderWidth: 5, borderColor: colors.oat,
          shadowColor: colors.ink, shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.24, shadowRadius: 9, elevation: 8,
        }}>
          <Ionicons name="add" size={34} color={colors.ink} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

function MainTabs() {
  const { t } = useLanguage();
  return (
    <Tab.Navigator
      tabBarPosition="bottom"
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ swipeEnabled: true }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="Log" component={TodayScreen} options={{ title: 'Log' }} />
      <Tab.Screen name="Progress" component={ProgressScreen} options={{ title: t('tabProgress') }} />
      <Tab.Screen name="Coach" component={CoachScreen} options={{ title: t('tabCoach') }} />
      <Tab.Screen name="Me" component={SettingsScreen} options={{ title: 'Me' }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const navigationRef = useNavigationContainerRef<any>();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [authReady, setAuthReady] = useState(false);
  const [minTimeReady, setMinTimeReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { status: trialStatus, recheck: recheckTrial } = useTrial(!!user && hasProfile && authReady);

  useEffect(() => {
    ensureNagSchedule().catch(() => {});
    if (!Notifications?.addNotificationResponseReceivedListener) return;
    const subscription = Notifications.addNotificationResponseReceivedListener(async (response: any) => {
      const action = response.actionIdentifier;
      const data = response.notification?.request?.content?.data;
      if (action === 'NAG_SNOOZE') await snoozeNagging(2, response.notification?.request?.identifier);
      if (action === 'NAG_LAZY') await markLazyDay();
      if (action === 'NAG_LOG' || (action === Notifications.DEFAULT_ACTION_IDENTIFIER && data?.kind?.startsWith('nag'))) {
        setTimeout(() => navigationRef.navigate('Log', { fabTrigger: Date.now() }), 350);
      }
    });
    return () => subscription.remove();
  }, [navigationRef]);

  // Fade in on mount, start 3s timer
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 700,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => setMinTimeReady(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Fade out when auth, min time, and (if applicable) trial check are all ready
  const trialReady = !user || !hasProfile || trialStatus !== 'loading';
  useEffect(() => {
    if (authReady && minTimeReady && trialReady) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }).start(() => setShowSplash(false));
    }
  }, [authReady, minTimeReady, trialReady]);

  useEffect(() => {
    const DATA_KEYS = [
      'calorie_entries', 'activity_entries', 'weight_entries',
      'calorie_goal', 'user_profile',
    ];

    const clearLocalData = () => Promise.all(DATA_KEYS.map((k) => AsyncStorage.removeItem(k)));

    const autoRestoreFromCloud = async () => {
      const [fsFood, fsActs, fsWeights, fsSettings] = await Promise.all([
        fsFetchAll<any>('foodEntries'),
        fsFetchAll<any>('activityEntries'),
        fsFetchAll<any>('weightEntries'),
        fsFetchSettings(),
      ]);
      if (fsFood.length) await AsyncStorage.setItem('calorie_entries', JSON.stringify(fsFood));
      if (fsActs.length) await AsyncStorage.setItem('activity_entries', JSON.stringify(fsActs));
      if (fsWeights.length) await AsyncStorage.setItem('weight_entries', JSON.stringify(fsWeights));
      if (fsSettings?.goal) await AsyncStorage.setItem('calorie_goal', String(fsSettings.goal));
      if (fsSettings?.profile) await AsyncStorage.setItem('user_profile', JSON.stringify(fsSettings.profile));
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
        const [localFood, localActivities] = await Promise.all([
          AsyncStorage.getItem('calorie_entries'),
          AsyncStorage.getItem('activity_entries'),
        ]);
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

  if (showSplash) {
    return (
      <Animated.View style={[splash.container, { opacity: fadeAnim }]}>
        <Image source={require('./assets/brand-mark.png')} style={splash.logo} />
        <Text style={splash.appName}>LeanLog</Text>
        <Text style={splash.tagline}>by Abdullah Umar</Text>
        <View style={splash.divider} />
        <Text style={splash.dua}>
          Doakan Abdullah Umar{'\n'}sihat sejahtera,{'\n'}dimurahkan rezeki,
        </Text>
        <Text style={splash.amin}>Amiiinn 🤲</Text>
      </Animated.View>
    );
  }

  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <NavigationContainer ref={navigationRef}>
          {user
            ? hasProfile
              ? trialStatus === 'expired'
                ? <PaywallScreen onRecheck={recheckTrial} />
                : <MainTabs />
              : <OnboardingScreen onComplete={() => setHasProfile(true)} />
            : <AuthScreen />
          }
        </NavigationContainer>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

const splash = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logo: { width: 112, height: 112, borderRadius: 34, marginBottom: 18 },
  appName: {
    color: colors.oat,
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 4,
  },
  tagline: {
    color: '#758198',
    fontSize: 13,
    letterSpacing: 1,
    marginBottom: 32,
  },
  divider: {
    width: 48,
    height: 2,
    backgroundColor: colors.coral,
    borderRadius: 2,
    marginBottom: 32,
  },
  dua: {
    color: '#AEB8C9',
    fontSize: 17,
    textAlign: 'center',
    lineHeight: 28,
    fontStyle: 'italic',
  },
  amin: {
    color: colors.mint,
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 12,
  },
});
