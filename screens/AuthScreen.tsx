import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signIn, signUp } from '../firebase';
import { useLanguage } from '../context/LanguageContext';

type Tab = 'login' | 'register';

export default function AuthScreen() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      Alert.alert(t('inputError'), 'Masukkan emel dan kata laluan.');
      return;
    }
    setLoading(true);
    try {
      if (tab === 'login') {
        await signIn(email.trim(), password);
      } else {
        if (password.length < 6) {
          Alert.alert(t('inputError'), 'Kata laluan mestilah sekurang-kurangnya 6 aksara.');
          setLoading(false);
          return;
        }
        await signUp(email.trim(), password);
      }
    } catch (e: any) {
      const msg = e?.code === 'auth/user-not-found' || e?.code === 'auth/wrong-password' || e?.code === 'auth/invalid-credential'
        ? 'Emel atau kata laluan tidak betul.'
        : e?.code === 'auth/email-already-in-use'
        ? 'Emel ini sudah didaftarkan.'
        : e?.code === 'auth/invalid-email'
        ? 'Format emel tidak sah.'
        : e?.message ?? 'Ralat tidak diketahui.';
      Alert.alert(t('error'), msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Logo */}
        <View style={styles.logoArea}>
          <Image source={require('../assets/icon.png')} style={styles.logoImage} />
          <Text style={styles.logoTitle}>LEANLOG</Text>
          <Text style={styles.logoTagline}>{t('appTagline')}</Text>
        </View>

        {/* Tab switch */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'login' && styles.tabBtnActive]}
            onPress={() => setTab('login')}
          >
            <Text style={[styles.tabBtnText, tab === 'login' && styles.tabBtnTextActive]}>
              {t('loginTitle')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'register' && styles.tabBtnActive]}
            onPress={() => setTab('register')}
          >
            <Text style={[styles.tabBtnText, tab === 'register' && styles.tabBtnTextActive]}>
              {t('registerTitle')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.label}>{t('emailField')}</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="nama@emel.com"
            placeholderTextColor="#7D8799"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.label}>{t('passwordField')}</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor="#7D8799"
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFDF7" />
            ) : (
              <Text style={styles.submitBtnText}>
                {tab === 'login' ? t('login') : t('register')}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchLink}
            onPress={() => setTab(tab === 'login' ? 'register' : 'login')}
          >
            <Text style={styles.switchLinkText}>
              {tab === 'login' ? t('noAccount') : t('hasAccount')}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F0E1' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },

  logoArea: { alignItems: 'center', marginBottom: 36 },
  logoImage: { width: 88, height: 88, borderRadius: 28, marginBottom: 18, borderWidth: 1, borderColor: '#495777' },
  logoTitle: { color: '#101A2B', fontSize: 32, letterSpacing: -1, fontWeight: '800', fontFamily: 'serif' },
  logoTagline: { color: '#737A84', fontSize: 13, marginTop: 7, letterSpacing: 0.3 },

  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFDF7',
    borderRadius: 18,
    padding: 4,
    marginBottom: 28,
  },
  tabBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center' },
  tabBtnActive: { backgroundColor: '#FF6542' },
  tabBtnText: { color: '#737A84', fontSize: 14, fontWeight: '700' },
  tabBtnTextActive: { color: '#FFFDF7' },

  form: {},
  label: {
    color: '#59616D',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: '#FFFDF7',
    color: '#101A2B',
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#DED5C5',
  },

  submitBtn: {
    backgroundColor: '#FF6542',
    padding: 16,
    borderRadius: 18,
    alignItems: 'center',
    marginTop: 24,
  },
  submitBtnDisabled: { backgroundColor: '#2a5c2a' },
  submitBtnText: { color: '#FFFDF7', fontWeight: 'bold', fontSize: 16 },

  switchLink: { alignItems: 'center', paddingVertical: 16 },
  switchLinkText: { color: '#FF6542', fontSize: 14 },
});
