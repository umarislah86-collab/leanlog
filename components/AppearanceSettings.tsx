import { ThemeMotif, ThemeWatermark } from './ThemeMotif';
import { ThemePressable as Pressable, ThemeScrollView as ScrollView, ThemeView as View, ThemeSafeAreaView as SafeAreaView } from './ThemeSurfaces';
import React, { useState } from 'react';
import { Modal, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemeText as Text, ThemeTypographyPreview } from './ThemePrimitives';
import { useTheme } from '../context/ThemeContext';
import { appThemes, themeIds, type AppThemeId, type AppPalette } from '../services/appTheme';
import { themeFontLicenses } from '../services/themeFontLicenses';

function ThemePreview({ palette: p, compact }: { palette: AppPalette; compact: boolean }) {
  return <ThemeTypographyPreview id={p.id}><View testID="appearance-preview" style={{ backgroundColor: p.canvas, borderRadius: 18, padding: compact ? 10 : 14, borderWidth: 1, borderColor: p.border }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <Text style={{ color: p.text, fontFamily: 'serif', fontSize: compact ? 18 : 22 }}>Your day, in balance.</Text>
    </View>
    <View style={{ backgroundColor: p.hero, borderRadius: 14, padding: compact ? 10 : 14, overflow: 'hidden' }}>
      <ThemeWatermark id={p.id} onHero/>
      <Text style={{ color: p.onHero, fontSize: 9, fontWeight: '800', letterSpacing: 1 }}>TRUE SPENDABLE CASH</Text>
      <Text typographyRole="number" style={{ color: p.onHero, fontSize: compact ? 23 : 28, marginTop: 4 }}>RM 1,240.00</Text>
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
      <View style={{ flex: 1, backgroundColor: p.surface, borderRadius: 10, padding: 8 }}><Text style={{ color: p.text, fontSize: 11 }}>Lunch <Text style={{ color: p.expense }}>− RM 18</Text></Text></View>
      <View style={{ backgroundColor: p.mint, borderRadius: 10, padding: 8 }}><Text style={{ color: '#101A2B', fontWeight: '800', fontSize: 11 }}>+ LOG</Text></View>
    </View>
  </View></ThemeTypographyPreview>;
}
export function AppearanceSettings() {
  const { palette, setTheme, saving, fontsLoaded } = useTheme();
  const { height, fontScale } = useWindowDimensions();
  const compact = height < 720 || fontScale > 1.2;
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<AppThemeId>(palette.id);
  const [error, setError] = useState('');
  const [showCredits, setShowCredits] = useState(false);
  const show = () => { setPreview(palette.id); setError(''); setShowCredits(false); setOpen(true); };
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
    <Modal visible={open} transparent animationType="fade" onRequestClose={showCredits ? () => setShowCredits(false) : close}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.65)' }}>
        <Pressable onPress={close} accessibilityLabel="Close appearance preview" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
        <SafeAreaView pointerEvents="box-none" edges={['top', 'bottom']} style={{ flex: 1, marginHorizontal: 16, marginVertical: 12, justifyContent: 'center' }}>
          <View style={{ flex: 1, backgroundColor: palette.canvas, borderRadius: 26, overflow: 'hidden' }}>
            <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <View style={{ flex: 1 }}><Text style={{ color: palette.text, fontFamily: 'serif', fontSize: 24 }}>{showCredits ? 'Font credits' : 'Make it yours.'}</Text></View>
                <Pressable disabled={saving} onPress={showCredits ? () => setShowCredits(false) : close} accessibilityRole="button" accessibilityLabel={showCredits ? 'Back to theme preview' : 'Close appearance preview'} hitSlop={12}><Ionicons name={showCredits ? 'arrow-back' : 'close'} size={25} color={palette.text} /></Pressable>
              </View>
              {!showCredits && <><ThemePreview palette={p} compact={compact} /><Text style={{ color: palette.muted, fontSize: 10, marginTop: 7 }}>Preview · {p.name} · Sample data</Text></>}
            </View>
            {showCredits ? <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}><Text selectable style={{ color: palette.text, fontSize: 12, lineHeight: 19 }}>{themeFontLicenses}</Text></ScrollView> : <ScrollView testID="appearance-theme-list" style={{ flex: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}>
              <View style={{ gap: 8 }}>
                {themeIds.map(id => {
                  const candidate = appThemes[id]; const selected = preview === id;
                  return <Pressable key={id} disabled={saving} onPress={() => setPreview(id)} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled: saving }} style={{ padding: 13, borderRadius: 15, borderWidth: selected ? 2 : 1, borderColor: selected ? palette.accent : palette.border, backgroundColor: palette.surface, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 38, height: 38, backgroundColor: candidate.canvas, borderRadius: 12, borderWidth: 1, borderColor: candidate.border, alignItems: 'center', justifyContent: 'center' }}><ThemeMotif id={id} size={24}/></View>
                    <View style={{ flex: 1 }}><Text style={{ color: palette.text, fontSize: 13, fontWeight: '700' }}>{candidate.name}{palette.id === id ? ' · Current' : ''}</Text><Text style={{ color: palette.muted, fontSize: 10, lineHeight: 15, marginTop: 3 }}>{candidate.description}</Text></View>
                    <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={21} color={selected ? palette.accent : palette.muted} />
                  </Pressable>;
                })}
              </View>
            </ScrollView>}
            {!showCredits && <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
              {!fontsLoaded && <Text style={{ color: palette.muted, fontSize: 11 }}>System fonts are being used; reopen to retry custom fonts.</Text>}
              {!!error && <Text accessibilityRole="alert" style={{ color: palette.dark ? '#FF9B88' : '#B33C2B', fontSize: 12 }}>{error}</Text>}
              <Pressable onPress={() => setShowCredits(true)} accessibilityRole="button" style={{ paddingVertical: 9 }}><Text style={{ color: palette.muted, fontSize: 11 }}>Font credits & licences</Text></Pressable>
            </View>}
            {!showCredits && <Pressable onPress={() => { void apply(); }} disabled={saving || preview === palette.id} accessibilityRole="button" accessibilityState={{ disabled: saving || preview === palette.id }} style={{ marginHorizontal: 16, marginBottom: 14, backgroundColor: palette.hero, padding: 16, borderRadius: 16, alignItems: 'center', opacity: saving || preview === palette.id ? .5 : 1 }}>
              {saving ? <ActivityIndicator color={palette.onHero} /> : <Text style={{ color: palette.onHero, fontWeight: '800', fontSize: 13 }}>{preview === palette.id ? 'Already active' : `Apply ${p.name}`}</Text>}
            </Pressable>}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  </>;
}
