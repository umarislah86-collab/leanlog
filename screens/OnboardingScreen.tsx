import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState } from 'react';
import { Picker } from '@react-native-picker/picker';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fsSetSettings } from '../firebase';
import { useLanguage } from '../context/LanguageContext';
import type { UserProfile, ActivityLevel } from '../types';
import type { TranslationKey } from '../translations';

const ACTIVITY_MULTS: Record<ActivityLevel, number> = {
  sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725,
};

const calculateTDEE = (p: UserProfile): number => {
  const bmr = p.gender === 'lelaki'
    ? 10 * p.weight + 6.25 * p.height - 5 * p.age + 5
    : 10 * p.weight + 6.25 * p.height - 5 * p.age - 161;
  return Math.round(bmr * (ACTIVITY_MULTS[p.activityLevel] ?? 1.55));
};

interface GoalOption {
  key: string;
  offset: number;
  labelKey: TranslationKey;
  subKey: TranslationKey;
}

const GOAL_OPTIONS: GoalOption[] = [
  { key: 'loseAggressive', offset: -750, labelKey: 'goalLoseAggressive', subKey: 'goalLoseAggressiveSub' },
  { key: 'loseSteady',     offset: -500, labelKey: 'goalLoseSteady',      subKey: 'goalLoseSteadySub' },
  { key: 'maintain',       offset: 0,    labelKey: 'goalMaintain',         subKey: 'goalMaintainSub' },
  { key: 'gain',           offset: 400,  labelKey: 'goalGain',             subKey: 'goalGainSub' },
];

interface Props {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: Props) {
  const { t, lang, setLang } = useLanguage();

  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);

  // Profile fields
  const [profileWeight, setProfileWeight] = useState('70.0');
  const [profileHeight, setProfileHeight] = useState('170');
  const [profileAge, setProfileAge] = useState('25');
  const [profileGender, setProfileGender] = useState<'lelaki' | 'perempuan'>('lelaki');
  const [profileActivityLevel, setProfileActivityLevel] = useState<ActivityLevel>('moderate');

  // Goal
  const [selectedGoalKey, setSelectedGoalKey] = useState('maintain');
  const [saving, setSaving] = useState(false);

  // Nutrition mode
  const [nutritionMode, setNutritionMode] = useState<'sss' | 'standard'>('sss');

  const ACTIVITY_LEVELS: { key: ActivityLevel; label: string; sub: string }[] = [
    { key: 'sedentary', label: t('sedentary'), sub: t('sedentarySub') },
    { key: 'light',     label: t('light'),     sub: t('lightSub') },
    { key: 'moderate',  label: t('moderate'),  sub: t('moderateSub') },
    { key: 'active',    label: t('active'),    sub: t('activeSub') },
  ];

  const parsedWeight = parseFloat(profileWeight) || 0;
  const parsedHeight = parseInt(profileHeight) || 0;
  const parsedAge = parseInt(profileAge) || 0;
  const profileReady = parsedWeight > 0 && parsedHeight > 0 && parsedAge > 0;

  const tdee = profileReady
    ? calculateTDEE({
        weight: parsedWeight, height: parsedHeight, age: parsedAge,
        gender: profileGender, activityLevel: profileActivityLevel,
      })
    : 0;

  const selectedGoal = GOAL_OPTIONS.find(g => g.key === selectedGoalKey) ?? GOAL_OPTIONS[2];
  const calorieTarget = Math.max(tdee + selectedGoal.offset, 1200);

  const handleNext = () => {
    if (!profileReady) { Alert.alert(t('error'), t('invalidProfile')); return; }
    setStep(2);
  };

  const handleGetStarted = async () => {
    if (!profileReady) { Alert.alert(t('error'), t('invalidProfile')); return; }
    setSaving(true);
    try {
      const profile: UserProfile = {
        weight: parsedWeight, height: parsedHeight, age: parsedAge,
        gender: profileGender, activityLevel: profileActivityLevel,
      };
      await Promise.all([
        AsyncStorage.setItem('user_profile', JSON.stringify(profile)),
        AsyncStorage.setItem('calorie_goal', String(calorieTarget)),
        fsSetSettings({ profile, goal: calorieTarget }),
      ]);
      setStep(3);
    } catch (e) {
      Alert.alert(t('error'), e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = async () => {
    await AsyncStorage.setItem('nutrition_mode', nutritionMode);
    onComplete();
  };

  // ── Step 0: Language ──────────────────────────────────────────────
  if (step === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.langScreen}>
          <Text style={styles.langTitle}>{t('chooseLang')}</Text>
          <TouchableOpacity
            style={[styles.langCard, lang === 'bm' && styles.langCardActive]}
            onPress={() => { setLang('bm'); setStep(1); }}
          >
            <Text style={styles.langFlag}>🇲🇾</Text>
            <Text style={styles.langLabel}>Bahasa Malaysia</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.langCard, lang === 'en' && styles.langCardActive]}
            onPress={() => { setLang('en'); setStep(1); }}
          >
            <Text style={styles.langFlag}>🇬🇧</Text>
            <Text style={styles.langLabel}>English</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Step 1: Profile ───────────────────────────────────────────────
  if (step === 1) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.stepHeader}>
            <Text style={styles.stepIndicator}>1 / 3  ·  {t('onboardingStep1')}</Text>
            <Text style={styles.welcome}>{t('onboardingWelcome')}</Text>
            <Text style={styles.subtitle}>{t('onboardingSubtitle')}</Text>
          </View>

          <Text style={styles.fieldLabel}>{t('weight')} (kg)</Text>
          <TextInput
            style={styles.input}
            value={profileWeight}
            onChangeText={setProfileWeight}
            keyboardType="numeric"
            placeholder="cth: 75.0"
            placeholderTextColor="#7D8799"
          />

          <Text style={styles.fieldLabel}>{t('height')} (cm)</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={profileHeight}
              onValueChange={v => setProfileHeight(String(v))}
              style={{ color: '#FFFDF7' }}
              dropdownIconColor="#FF6542"
            >
              {Array.from({ length: 151 }, (_, i) => {
                const h = String(100 + i);
                return <Picker.Item key={h} label={`${h} cm`} value={h} />;
              })}
            </Picker>
          </View>

          <Text style={styles.fieldLabel}>{t('age')}</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={profileAge}
              onValueChange={v => setProfileAge(String(v))}
              style={{ color: '#FFFDF7' }}
              dropdownIconColor="#FF6542"
            >
              {Array.from({ length: 100 }, (_, i) => {
                const a = String(1 + i);
                return <Picker.Item key={a} label={`${a} ${t('yearUnit')}`} value={a} />;
              })}
            </Picker>
          </View>

          <Text style={styles.fieldLabel}>{t('gender')}</Text>
          <View style={styles.genderRow}>
            {(['lelaki', 'perempuan'] as const).map(g => (
              <TouchableOpacity
                key={g}
                style={[styles.genderBtn, profileGender === g && styles.genderBtnActive]}
                onPress={() => setProfileGender(g)}
              >
                <Text style={[styles.genderText, profileGender === g && styles.genderTextActive]}>
                  {g === 'lelaki' ? t('male') : t('female')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>{t('activityLevel')}</Text>
          {ACTIVITY_LEVELS.map(lv => (
            <TouchableOpacity
              key={lv.key}
              style={[styles.actBtn, profileActivityLevel === lv.key && styles.actBtnActive]}
              onPress={() => setProfileActivityLevel(lv.key)}
            >
              <Text style={[styles.actBtnLabel, profileActivityLevel === lv.key && styles.actBtnLabelActive]}>
                {lv.label}
              </Text>
              <Text style={styles.actBtnSub}>{lv.sub}</Text>
            </TouchableOpacity>
          ))}

          {profileReady && (
            <View style={styles.tdeePreview}>
              <Text style={styles.tdeeText}>
                TDEE: <Text style={{ color: '#FF6542', fontWeight: 'bold' }}>{tdee} kcal/hari</Text>
              </Text>
            </View>
          )}

          <TouchableOpacity style={styles.primaryBtn} onPress={handleNext}>
            <Text style={styles.primaryBtnText}>{t('onboardingNext')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Step 3: Nutrition Mode ────────────────────────────────────────
  if (step === 3) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.stepHeader}>
            <Text style={styles.stepIndicator}>3 / 3  ·  {lang === 'en' ? 'Nutrition Framework' : 'Panduan Pemakanan'}</Text>
            <Text style={styles.welcome}>{lang === 'en' ? 'How do you want to track nutrition?' : 'Macam mana kau nak jejak pemakanan?'}</Text>
          </View>

          <TouchableOpacity
            style={[styles.goalCard, nutritionMode === 'sss' && styles.goalCardActive]}
            onPress={() => setNutritionMode('sss')}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.goalCardLabel, nutritionMode === 'sss' && styles.goalCardLabelActive]}>
                🥗 Suku Suku Separuh (KKM)
              </Text>
              <Text style={styles.goalCardSub}>
                {lang === 'en'
                  ? '½ veg & fruits · ¼ carbs · ¼ protein — Malaysian Health Ministry guide'
                  : '½ sayur & buah · ¼ karbohidrat · ¼ protein — panduan KKM Malaysia'}
              </Text>
            </View>
            {nutritionMode === 'sss' && <Text style={{ color: '#FF6542', fontSize: 18 }}>✓</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.goalCard, nutritionMode === 'standard' && styles.goalCardActive]}
            onPress={() => setNutritionMode('standard')}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.goalCardLabel, nutritionMode === 'standard' && styles.goalCardLabelActive]}>
                📊 {lang === 'en' ? 'Standard Macro Split' : 'Makro Standard'}
              </Text>
              <Text style={styles.goalCardSub}>
                {lang === 'en'
                  ? 'Carbs 50% · Protein 25% · Fat 25% — classic calorie-based tracking'
                  : 'Karbohidrat 50% · Protein 25% · Lemak 25% — kiraan kalori klasik'}
              </Text>
            </View>
            {nutritionMode === 'standard' && <Text style={{ color: '#FF6542', fontSize: 18 }}>✓</Text>}
          </TouchableOpacity>

          <View style={styles.stepBtns}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep(2)}>
              <Text style={styles.backBtnText}>← {t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.primaryBtn, { flex: 1, marginLeft: 10 }]} onPress={handleFinish}>
              <Text style={styles.primaryBtnText}>{lang === 'en' ? '🚀 Get Started!' : '🚀 Mula!'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Step 2: Goal ──────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.stepHeader}>
          <Text style={styles.stepIndicator}>2 / 3  ·  {t('onboardingStep2')}</Text>
          <Text style={styles.welcome}>{t('onboardingGoalTitle')}</Text>
        </View>

        {GOAL_OPTIONS.map(opt => {
          const target = Math.max(tdee + opt.offset, 1200);
          const isSelected = selectedGoalKey === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.goalCard, isSelected && styles.goalCardActive]}
              onPress={() => setSelectedGoalKey(opt.key)}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.goalCardLabel, isSelected && styles.goalCardLabelActive]}>
                  {t(opt.labelKey)}
                </Text>
                <Text style={styles.goalCardSub}>{t(opt.subKey)}</Text>
              </View>
              <Text style={[styles.goalCardKcal, isSelected && { color: '#FF6542' }]}>
                {target} kcal
              </Text>
            </TouchableOpacity>
          );
        })}

        <View style={styles.targetSummary}>
          <Text style={styles.targetLabel}>{t('onboardingCalTarget')}</Text>
          <Text style={styles.targetKcal}>{calorieTarget} kcal</Text>
        </View>

        <View style={styles.stepBtns}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
            <Text style={styles.backBtnText}>← {t('cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryBtn, { flex: 1, marginLeft: 10 }]}
            onPress={handleGetStarted}
            disabled={saving}
          >
            <Text style={styles.primaryBtnText}>
              {saving ? '...' : t('getStarted')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F0E1' },
  scrollContent: { padding: 20, paddingBottom: 40 },

  // Language step
  langScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  langTitle: { color: '#101A2B', fontSize: 32, fontWeight: '800', fontFamily: 'serif', marginBottom: 32, letterSpacing: -0.7 },
  langCard: {
    width: '100%', padding: 22, borderRadius: 22, borderWidth: 1,
    borderColor: '#E2D9C9', backgroundColor: '#FFFDF7',
    alignItems: 'center', marginBottom: 16,
  },
  langCardActive: { borderColor: '#FF6542', backgroundColor: '#29364D' },
  langFlag: { fontSize: 48, marginBottom: 8 },
  langLabel: { color: '#101A2B', fontSize: 18, fontWeight: '800' },

  // Step header
  stepHeader: { marginBottom: 24 },
  stepIndicator: { color: '#7D8799', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  welcome: { color: '#101A2B', fontSize: 32, fontWeight: '800', fontFamily: 'serif', marginBottom: 6, letterSpacing: -0.7 },
  subtitle: { color: '#737A84', fontSize: 14 },

  // Fields
  fieldLabel: { color: '#AAB3C2', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', marginTop: 16, marginBottom: 6 },
  input: {
    backgroundColor: '#FFFDF7', borderRadius: 15, borderWidth: 1, borderColor: '#DED5C5',
    color: '#101A2B', padding: 15, fontSize: 15,
  },
  pickerWrap: { backgroundColor: '#1C2940', borderRadius: 8, borderWidth: 1, borderColor: '#33415C', marginBottom: 4 },

  // Gender
  genderRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  genderBtn: {
    flex: 1, padding: 14, borderRadius: 15, borderWidth: 1,
    borderColor: '#33415C', alignItems: 'center',
  },
  genderBtnActive: { borderColor: '#FF6542', backgroundColor: '#29364D' },
  genderText: { color: '#9CA5B4', fontWeight: '600' },
  genderTextActive: { color: '#FF6542' },

  // Activity level
  actBtn: {
    padding: 14, borderRadius: 15, borderWidth: 1,
    borderColor: '#33415C', marginBottom: 8,
  },
  actBtnActive: { borderColor: '#FF6542', backgroundColor: '#29364D' },
  actBtnLabel: { color: '#9CA5B4', fontWeight: '600', fontSize: 14 },
  actBtnLabelActive: { color: '#FF6542' },
  actBtnSub: { color: '#7D8799', fontSize: 12, marginTop: 2 },

  // TDEE preview
  tdeePreview: {
    backgroundColor: '#1C2940', borderRadius: 8, padding: 12,
    marginTop: 16, alignItems: 'center',
  },
  tdeeText: { color: '#CBD2DD', fontSize: 14 },

  // Goal cards
  goalCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFDF7', borderRadius: 18, borderWidth: 1,
    borderColor: '#E2D9C9', padding: 16, marginBottom: 10,
  },
  goalCardActive: { borderColor: '#FF6542', backgroundColor: '#29364D' },
  goalCardLabel: { color: '#263247', fontSize: 15, fontWeight: '800', marginBottom: 2 },
  goalCardLabelActive: { color: '#FF6542' },
  goalCardSub: { color: '#7D8799', fontSize: 12 },
  goalCardKcal: { color: '#7D8799', fontSize: 14, fontWeight: 'bold', marginLeft: 8 },

  // Target summary
  targetSummary: {
    backgroundColor: '#1C2940', borderRadius: 18, padding: 18,
    alignItems: 'center', marginTop: 8, marginBottom: 24,
  },
  targetLabel: { color: '#AAB3C2', fontSize: 13, marginBottom: 4 },
  targetKcal: { color: '#FF6542', fontSize: 32, fontWeight: 'bold' },

  // Buttons
  primaryBtn: {
    backgroundColor: '#FF6542', borderRadius: 18,
    padding: 16, alignItems: 'center', marginTop: 24,
  },
  primaryBtnText: { color: '#FFFDF7', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },
  stepBtns: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  backBtn: { paddingVertical: 16, paddingHorizontal: 8 },
  backBtnText: { color: '#7D8799', fontSize: 14 },
});
