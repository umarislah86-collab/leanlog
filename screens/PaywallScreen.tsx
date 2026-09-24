import React, { useState } from 'react';
import { ActivityIndicator, Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Props {
  onRecheck: () => Promise<void>;
}

type Plan = 'monthly' | 'yearly';

const WA_BASE = 'https://wa.me/601127125374?text=';
const WA_MSG: Record<Plan, string> = {
  monthly: encodeURIComponent('Hi, saya nak subscribe LeanLog plan BULANAN (RM7/bulan). Ini bukti bayaran saya:'),
  yearly:  encodeURIComponent('Hi, saya nak subscribe LeanLog plan TAHUNAN (RM49/tahun). Ini bukti bayaran saya:'),
};

export default function PaywallScreen({ onRecheck }: Props) {
  const [checking, setChecking] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan>('yearly');

  const handleRecheck = async () => {
    setChecking(true);
    await onRecheck();
    setChecking(false);
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.inner}>
        <Text style={styles.lock}>🔒</Text>
        <Text style={styles.title}>Trial 3 Hari Tamat</Text>
        <Text style={styles.sub}>Pilih plan untuk teruskan menggunakan LeanLog</Text>

        <View style={styles.plansRow}>
          {/* Monthly */}
          <TouchableOpacity
            style={[styles.planCard, selectedPlan === 'monthly' && styles.planCardActive]}
            onPress={() => setSelectedPlan('monthly')}
            activeOpacity={0.85}
          >
            <Text style={styles.planName}>Bulanan</Text>
            <Text style={[styles.planPrice, selectedPlan === 'monthly' && styles.planPriceActive]}>RM7</Text>
            <Text style={styles.planPer}>/bulan</Text>
          </TouchableOpacity>

          {/* Yearly */}
          <TouchableOpacity
            style={[styles.planCard, styles.planCardYearly, selectedPlan === 'yearly' && styles.planCardActive]}
            onPress={() => setSelectedPlan('yearly')}
            activeOpacity={0.85}
          >
            <View style={styles.bestBadge}><Text style={styles.bestBadgeTxt}>Jimat 42%</Text></View>
            <Text style={styles.planName}>Tahunan</Text>
            <Text style={[styles.planPrice, selectedPlan === 'yearly' && styles.planPriceActive]}>RM49</Text>
            <Text style={styles.planPer}>/tahun</Text>
            <Text style={styles.planSaving}>vs RM84/tahun</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.qrBox}>
          <View style={styles.qrCrop}>
            <Image
              source={require('../assets/qr_maybank.jpeg')}
              style={styles.qrImage}
            />
          </View>
          <Text style={styles.qrHint}>
            {selectedPlan === 'monthly' ? 'Bayar RM7' : 'Bayar RM49'}
          </Text>
        </View>

        <View style={styles.steps}>
          <Text style={styles.step}>1.  Scan QR atau transfer ke nombor di atas</Text>
          <Text style={styles.step}>2.  Hantar bukti bayaran ke WhatsApp di bawah</Text>
          <Text style={styles.step}>3.  Akaun diaktifkan dalam masa 24 jam</Text>
        </View>

        <TouchableOpacity
          style={styles.waBtn}
          onPress={() => Linking.openURL(WA_BASE + WA_MSG[selectedPlan])}
          activeOpacity={0.85}
        >
          <Text style={styles.waBtnTxt}>
            💬  Hantar Bukti ({selectedPlan === 'monthly' ? 'RM7 Bulanan' : 'RM49 Tahunan'})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.recheckBtn} onPress={handleRecheck} disabled={checking} activeOpacity={0.7}>
          {checking
            ? <ActivityIndicator color="#7D8799" size="small" />
            : <Text style={styles.recheckTxt}>Sudah bayar? Semak sekarang</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => Linking.openURL('mailto:umarislah86@gmail.com?subject=LeanLog%20Maklum%20Balas&body=Versi%3A%201.3.3%0A%0AMaklum%20balas%20saya%3A%0A')}
          activeOpacity={0.7}
        >
          <Text style={styles.feedbackTxt}>💬 Hantar maklum balas</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F0E1' },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  lock: { fontSize: 48, marginBottom: 14 },
  title: { color: '#101A2B', fontSize: 32, fontWeight: '800', fontFamily: 'serif', textAlign: 'center', marginBottom: 8, letterSpacing: -0.7 },
  sub: { color: '#737A84', fontSize: 13, textAlign: 'center', marginBottom: 20 },

  plansRow: { flexDirection: 'row', gap: 12, marginBottom: 20, width: '100%' },
  planCard: {
    flex: 1, backgroundColor: '#FFFDF7', borderRadius: 22,
    borderWidth: 1, borderColor: '#E2D9C9',
    alignItems: 'center', paddingVertical: 18, paddingHorizontal: 8,
  },
  planCardYearly: { position: 'relative', paddingTop: 28 },
  planCardActive: { borderColor: '#FF6542', backgroundColor: '#29364D' },
  planName: { color: '#AAB3C2', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  planPrice: { color: '#101A2B', fontSize: 28, fontWeight: '900' },
  planPriceActive: { color: '#FF6542' },
  planPer: { color: '#7D8799', fontSize: 12, marginTop: 2 },
  planSaving: { color: '#7D8799', fontSize: 11, marginTop: 4, textDecorationLine: 'line-through' },
  bestBadge: {
    position: 'absolute', top: -12, left: '50%', transform: [{ translateX: -32 }],
    backgroundColor: '#FF6542', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3,
  },
  bestBadgeTxt: { color: '#FFFDF7', fontSize: 10, fontWeight: '800' },

  qrBox: { alignItems: 'center', marginBottom: 16 },
  qrCrop: { width: 180, height: 180, overflow: 'hidden', borderRadius: 24, backgroundColor: '#FFFDF7', borderWidth: 6, borderColor: '#FFF4DB' },
  qrImage: { width: 180, height: 180 },
  qrHint: { color: '#FF6542', fontSize: 13, fontWeight: '700', marginTop: 8 },

  steps: { marginBottom: 20, alignSelf: 'stretch' },
  step: { color: '#8D97A8', fontSize: 12, lineHeight: 22 },

  waBtn: {
    backgroundColor: '#25D366', borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 20,
    width: '100%', alignItems: 'center', marginBottom: 12,
  },
  waBtnTxt: { color: '#FFFDF7', fontSize: 14, fontWeight: '700' },
  recheckBtn: { paddingVertical: 12, width: '100%', alignItems: 'center' },
  recheckTxt: { color: '#7D8799', fontSize: 13 },
  feedbackTxt: { color: '#33415C', fontSize: 12, marginTop: 8, textDecorationLine: 'underline' },
});
