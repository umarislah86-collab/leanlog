import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeText as Text, ThemeTypographyPreview } from './ThemePrimitives';
import { useTheme } from '../context/ThemeContext';
import { appThemes, themeIds, type AppThemeId, type AppPalette } from '../services/appTheme';
import { themeFontLicenses } from '../services/themeFontLicenses';

function ThemePreview({ palette: p }: { palette: AppPalette }) {
  return <ThemeTypographyPreview id={p.id}><View style={{ backgroundColor: p.canvas, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: p.border }}>
    <Text style={{ color: p.accent, fontSize: 9, letterSpacing: 2, fontWeight: '800' }}>LEANLOG / REDCOINS</Text>
    <Text style={{ color: p.text, fontFamily: 'serif', fontSize: 28, marginVertical: 10 }}>Your day, in balance.</Text>
    <View style={{ backgroundColor: p.hero, borderRadius: 18, padding: 18 }}>
      <Text style={{ color: p.mint, fontSize: 9, fontWeight: '800', letterSpacing: 1 }}>TRUE SPENDABLE CASH</Text>
      <Text typographyRole="number" style={{ color: p.onHero, fontFamily: 'serif', fontSize: 31, marginTop: 10 }}>RM 1,240.00</Text>
      <Text style={{ color: p.heroMuted, fontSize: 11, marginTop: 5 }}>A little room for what matters.</Text>
    </View>
    <View style={{ backgroundColor: p.surface, borderRadius: 16, padding: 15, marginTop: 12 }}>
      <Text style={{ color: p.text, fontWeight: '700', fontSize: 13 }}>Lunch <Text style={{ color: p.expense }}> − RM 18.00</Text></Text>
      <Text style={{ color: p.muted, fontSize: 11, marginTop: 5 }}>Dining Out · Today</Text>
      <View style={{ height: 1, backgroundColor: p.border, marginVertical: 12 }} />
      <Text style={{ color: p.text, fontWeight: '700', fontSize: 13 }}>Salary <Text style={{ color: p.income }}> + RM 3,000.00</Text></Text>
      <Text style={{ color: p.transfer, fontSize: 11, marginTop: 10 }}>⇄ Transfer · RM 200.00</Text>
    </View>
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
      <View style={{ backgroundColor: p.mint, borderRadius: 13, padding: 12 }}><Text style={{ color: '#101A2B', fontWeight: '800', fontSize: 11 }}>+ LOG</Text></View>
      <View style={{ flex: 1, backgroundColor: p.surfaceAlt, borderRadius: 13, padding: 12 }}><Text style={{ color: p.text, fontSize: 11 }}>7,973 steps</Text></View>
    </View>
  </View></ThemeTypographyPreview>;
}
export function AppearanceSettings() {
  const { palette, setTheme, saving, fontsLoaded } = useTheme();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<AppThemeId>(palette.id);
  const [error, setError] = useState('');
  const [showCredits, setShowCredits] = useState(false);
  const show = () => { setPreview(palette.id); setError(''); setOpen(true); };
  const close = () => { if (!saving) setOpen(false); };
  const apply = async () => {
    setError('');
    try { await setTheme(preview); setOpen(false); }
    catch { setError('Appearance could not be saved. Your previous theme is still active. Please try again.'); }
  };
  const p = appThemes[preview];
  return <>
    <Pressable onPress={show} accessibilityRole="button" accessibilityLabel={`Appearance. ${palette.name}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 20, padding: 18, marginBottom: 14 }}>
      <Ionicons name="color-palette-outline" size={23} color={palette.accent} />
      <View style={{ flex: 1 }}><Text style={{ color: palette.text, fontSize: 15, fontWeight: '700' }}>Appearance</Text><Text style={{ color: palette.muted, fontSize: 12, marginTop: 4 }}>{palette.name}</Text></View>
      <Ionicons name="chevron-forward" size={18} color={palette.muted} />
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <Pressable onPress={close} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.65)', justifyContent: 'center' }}>
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, marginHorizontal: 16, marginVertical: 12, justifyContent: 'center' }}>
          <Pressable onPress={() => {}} style={{ maxHeight: '100%', backgroundColor: palette.canvas, borderRadius: 26, overflow: 'hidden' }}>
            <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flex: 1 }}><Text style={{ color: palette.text, fontFamily: 'serif', fontSize: 27 }}>Make it yours.</Text><Text style={{ color: palette.muted, fontSize: 12, marginTop: 6 }}>Preview first. Apply when it feels right.</Text></View>
                <Pressable disabled={saving} onPress={close} accessibilityRole="button" accessibilityLabel="Close appearance preview" hitSlop={12}><Ionicons name="close" size={25} color={palette.text} /></Pressable>
              </View>
              <View style={{ marginVertical: 18, gap: 8 }}>
                {themeIds.map(id => {
                  const candidate = appThemes[id]; const selected = preview === id;
                  return <Pressable key={id} disabled={saving} onPress={() => setPreview(id)} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled: saving }} style={{ padding: 13, borderRadius: 15, borderWidth: selected ? 2 : 1, borderColor: selected ? palette.accent : palette.border, backgroundColor: palette.surface, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 38, height: 38, backgroundColor: candidate.canvas, borderRadius: 12, borderWidth: 1, borderColor: candidate.border, alignItems: 'center', justifyContent: 'center' }}><View style={{ backgroundColor: candidate.hero, width: 20, height: 15, borderRadius: 5 }} /></View>
                    <View style={{ flex: 1 }}><Text style={{ color: palette.text, fontSize: 13, fontWeight: '700' }}>{candidate.name}{palette.id === id ? ' · Current' : ''}</Text><Text style={{ color: palette.muted, fontSize: 10, lineHeight: 15, marginTop: 3 }}>{candidate.description}</Text></View>
                    <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={21} color={selected ? palette.accent : palette.muted} />
                  </Pressable>;
                })}
              </View>
              <ThemePreview palette={p} />
              {!fontsLoaded && <Text style={{ color: palette.muted, fontSize: 11, marginTop: 12 }}>Custom fonts could not load. System fonts are being used; reopen the app to retry.</Text>}
              <Text style={{ color: palette.muted, fontSize: 11, lineHeight: 17, marginTop: 12 }}>Sample data only. Expense, income and transfer colours keep their meaning. PDFs and launcher widgets keep their original design.</Text>
              <Pressable onPress={() => setShowCredits(value => !value)} accessibilityRole="button" accessibilityState={{ expanded: showCredits }} style={{ paddingVertical: 12 }}><Text style={{ color: palette.muted, fontSize: 11 }}>Font credits & licences {showCredits ? '−' : '+'}</Text></Pressable>
              {showCredits && <Text selectable style={{ color: palette.muted, fontSize: 10, lineHeight: 16 }}>{themeFontLicenses}</Text>}
              {!!error && <Text accessibilityRole="alert" style={{ color: palette.dark ? '#FF9B88' : '#B33C2B', fontSize: 12, marginTop: 12 }}>{error}</Text>}
            </ScrollView>
            <Pressable onPress={() => { void apply(); }} disabled={saving || preview === palette.id} accessibilityRole="button" accessibilityState={{ disabled: saving || preview === palette.id }} style={{ marginHorizontal: 20, marginBottom: 20, backgroundColor: palette.hero, padding: 16, borderRadius: 16, alignItems: 'center', opacity: saving || preview === palette.id ? .5 : 1 }}>
              {saving ? <ActivityIndicator color={palette.onHero} /> : <Text style={{ color: palette.onHero, fontWeight: '800', fontSize: 13 }}>{preview === palette.id ? 'Already active' : `Apply ${p.name}`}</Text>}
            </Pressable>
          </Pressable>
        </SafeAreaView>
      </Pressable>
    </Modal>
  </>;
}
