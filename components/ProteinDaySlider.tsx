import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeText as Text } from './ThemePrimitives';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import type { FoodEntry, MealCategory } from '../types';
import { buildProteinTimeline, type ProteinTimelineDay } from '../services/proteinTimeline';

const CHART_HEIGHT = 58;
const CHART_TOP = 12;
const formatGrams = (value: number) => Number(value.toFixed(1)).toString();

export function ProteinDaySlider({ food, target, openSettings, openDay }: {
  food: FoodEntry[]; target: number; openSettings: () => void; openDay: (key: string) => void;
}) {
  const { palette: p } = useTheme();
  const { lang } = useLanguage();
  const en = lang === 'en';
  const today = new Date().toLocaleDateString('ms-MY');
  const days = useMemo(() => buildProteinTimeline(food), [food, today]);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const list = useRef<FlatList<ProteinTimelineDay>>(null);
  const indexRef = useRef(0), selection = useRef<string | null>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const reveal = useRef(new Animated.Value(1)).current;
  const cellWidth = width / 7;
  const validTarget = Number.isFinite(target) && target > 0 ? target : 0;
  const ceiling = useMemo(() => Math.max(50, validTarget * 1.2, days.reduce((max, day) => Math.max(max, day.protein * 1.12), 0)), [days, validTarget]);
  const day = days[Math.min(active, days.length - 1)];
  const logged = day.entries.length > 0;
  const met = validTarget > 0 && day.protein >= validTarget;
  const colour = met ? '#26735C' : '#387BB9';
  const percent = validTarget ? Math.round(day.protein / validTarget * 100) : 0;
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    const found = selection.current ? days.findIndex(row => row.key === selection.current) : 0;
    const index = Math.max(0, found);
    indexRef.current = index; setActive(index); selection.current = days[index].key;
    if (!cellWidth) return;
    const frame = requestAnimationFrame(() => list.current?.scrollToOffset({ offset: index * cellWidth, animated: false }));
    return () => cancelAnimationFrame(frame);
  }, [days, cellWidth]);
  useEffect(() => {
    reveal.stopAnimation();
    if (reducedMotion) { reveal.setValue(1); return; }
    reveal.setValue(.72);
    Animated.timing(reveal, { toValue: 1, duration: 170, useNativeDriver: true }).start();
  }, [day.key, reducedMotion]);
  const moveTo = (index: number) => list.current?.scrollToOffset({ offset: Math.max(0, Math.min(days.length - 1, index)) * cellWidth, animated: !reducedMotion });
  const onScroll = useMemo(() => Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
    useNativeDriver: true,
    listener: (event: any) => {
      if (!cellWidth) return;
      const next = Math.max(0, Math.min(days.length - 1, Math.round(event.nativeEvent.contentOffset.x / cellWidth)));
      if (next !== indexRef.current) { indexRef.current = next; selection.current = days[next].key; setActive(next); }
    },
  }), [cellWidth, days, scrollX]);
  const dateLabel = day.date.toLocaleDateString(en ? 'en-GB' : 'ms-MY', { day: 'numeric', month: 'short', year: 'numeric' });
  const name = active === 0 ? (en ? 'Today' : 'Hari ini') : active === 1 ? (en ? 'Yesterday' : 'Semalam') : day.date.toLocaleDateString(en ? 'en-GB' : 'ms-MY', { weekday: 'long' });
  const status = !logged ? (en ? 'No food logged' : 'Belum log makanan') : !validTarget ? (en ? 'Set your protein target' : 'Set target protein') : met ? (en ? 'Target reached' : 'Protein cukup') : `${formatGrams(validTarget - day.protein)}g ${en ? 'to target' : 'lagi untuk target'}`;
  const categories: Array<[MealCategory, string]> = [['sarapan', en ? 'Breakfast' : 'Sarapan'], ['tengahari', en ? 'Lunch' : 'Tengahari'], ['malam', en ? 'Dinner' : 'Malam'], ['snek', en ? 'Snacks' : 'Snek']];
  return <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }]}>
    <View style={styles.row}>
      <Text style={[styles.eyebrow, { color: p.muted }]}>PROTEIN DAILY</Text>
      <TouchableOpacity accessibilityRole="button" onPress={openSettings}><Text style={{ color: p.accent, fontSize: 11, fontWeight: '700' }}>┄ Target {validTarget ? `${validTarget}g` : '—'} ↗</Text></TouchableOpacity>
    </View>
    <View style={[styles.row, { marginTop: 6 }]}>
      <TouchableOpacity hitSlop={10} accessibilityRole="button" accessibilityLabel={en ? 'Previous day' : 'Hari sebelumnya'} disabled={active === days.length - 1} onPress={() => moveTo(active + 1)} style={[styles.arrow, { backgroundColor: p.surfaceAlt, opacity: active === days.length - 1 ? .3 : 1 }]}><Ionicons name="chevron-back" size={15} color={p.text} /></TouchableOpacity>
      <View style={{ alignItems: 'center', flex: 1 }}><Text numberOfLines={1} style={{ color: p.text, fontSize: 12, fontWeight: '700' }}>{name} · {dateLabel}</Text></View>
      <TouchableOpacity hitSlop={10} accessibilityRole="button" accessibilityLabel={en ? 'Next day' : 'Hari seterusnya'} disabled={active === 0} onPress={() => moveTo(active - 1)} style={[styles.arrow, { backgroundColor: p.surfaceAlt, opacity: active === 0 ? .3 : 1 }]}><Ionicons name="chevron-forward" size={15} color={p.text} /></TouchableOpacity>
    </View>
    <Animated.View style={[styles.row, { marginVertical: 4, opacity: reveal, transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [7, 0] }) }] }]}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}><Text style={{ color: p.text, fontSize: 30, fontWeight: '800', letterSpacing: -1 }}>{logged ? formatGrams(day.protein) : '—'}</Text><Text style={{ color: p.muted, fontSize: 14 }}>g</Text></View>
      <View style={{ alignItems: 'flex-end' }}><Text style={{ color: logged ? colour : p.muted, fontSize: 16, fontWeight: '800' }}>{logged && validTarget ? `${percent}%` : '—'}</Text><Text style={{ color: p.muted, fontSize: 9, marginTop: 1 }}>{status}</Text></View>
    </Animated.View>
    <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ height: 92, marginHorizontal: -12, overflow: 'hidden' }}>
      {!!width && <>
        <View pointerEvents="none" style={{ position: 'absolute', left: 12, right: 12, top: CHART_TOP + CHART_HEIGHT, borderTopWidth: 1, borderColor: p.border }} />
        {!!validTarget && <View pointerEvents="none" style={{ position: 'absolute', left: 12, right: 12, top: CHART_TOP + CHART_HEIGHT * (1 - validTarget / ceiling), borderTopWidth: 1, borderStyle: 'dashed', borderColor: p.muted, opacity: .5, zIndex: 2 }} />}
        <View pointerEvents="none" style={{ position: 'absolute', left: width / 2 - cellWidth / 2 + 2, width: cellWidth - 4, top: 3, bottom: 3, borderRadius: 12, backgroundColor: p.surfaceAlt }} />
        <Animated.FlatList<ProteinTimelineDay>
          ref={list} data={days} horizontal keyExtractor={row => row.key}
          showsHorizontalScrollIndicator={false} bounces={false} overScrollMode="never"
          contentContainerStyle={{ paddingHorizontal: (width - cellWidth) / 2 }}
          snapToInterval={cellWidth} decelerationRate="fast" snapToAlignment="start"
          onScroll={onScroll} scrollEventThrottle={16}
          getItemLayout={(_, index) => ({ length: cellWidth, offset: cellWidth * index, index })}
          initialNumToRender={9} maxToRenderPerBatch={9} windowSize={5}
          renderItem={({ item, index }) => {
            const height = Math.max(item.entries.length ? 3 : 0, item.protein / ceiling * CHART_HEIGHT);
            const selected = index === active;
            const barColour = validTarget && item.protein >= validTarget ? '#26735C' : '#387BB9';
            return <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`${item.key}, ${item.entries.length ? `${formatGrams(item.protein)}g protein` : (en ? 'no food log' : 'belum log makanan')}`} onPress={() => moveTo(index)} style={{ width: cellWidth, alignItems: 'center' }}>
              <Animated.View style={{ width: '100%', alignItems: 'center', opacity: reducedMotion ? (selected ? 1 : .55) : scrollX.interpolate({ inputRange: [(index - 2) * cellWidth, index * cellWidth, (index + 2) * cellWidth], outputRange: [.4, 1, .4], extrapolate: 'clamp' }), transform: reducedMotion ? [] : [{ scaleX: scrollX.interpolate({ inputRange: [(index - 1) * cellWidth, index * cellWidth, (index + 1) * cellWidth], outputRange: [.9, 1, .9], extrapolate: 'clamp' }) }] }}>
                <Text style={{ height: CHART_TOP, color: p.muted, fontSize: 8, paddingTop: 0 }}>{item.entries.length ? formatGrams(item.protein) : '—'}</Text>
                <View style={{ height: CHART_HEIGHT, justifyContent: 'flex-end', alignItems: 'center', width: '100%' }}>
                  {item.entries.length ? <View style={{ height, width: Math.max(13, cellWidth * .4), borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: barColour }} /> : <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: p.border, marginBottom: 3 }} />}
                </View>
                <Text style={{ color: selected ? p.text : p.muted, fontSize: 9, fontWeight: selected ? '800' : '500', marginTop: 5 }}>{item.date.getDate()}/{item.date.getMonth() + 1}</Text>
              </Animated.View>
            </TouchableOpacity>;
          }}
        />
      </>}
    </View>
    <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: p.border, marginTop: 6, paddingTop: 6 }}>
      {categories.map(([key, label]) => <View key={key} style={{ flex: 1 }}><Text style={{ color: p.muted, fontSize: 9 }}>{label}</Text><Text style={{ color: p.text, fontSize: 11, fontWeight: '700', marginTop: 2 }}>{logged ? `${formatGrams(day.meals[key])}g` : '—'}</Text></View>)}
    </View>
    <View style={[styles.row, { marginTop: 8 }]}>
      <Text style={{ color: p.muted, fontSize: 9 }}>← {en ? 'Older · newer' : 'Lama · baru'} →</Text>
      <View style={{ flexDirection: 'row', gap: 15 }}>
        <TouchableOpacity hitSlop={8} onPress={() => moveTo(0)} disabled={active === 0}><Text style={{ color: active ? p.accent : p.muted, fontSize: 10, fontWeight: '700' }}>{en ? 'Today' : 'Hari ini'} ↗</Text></TouchableOpacity>
        <TouchableOpacity hitSlop={8} accessibilityRole="button" onPress={() => openDay(day.date.toLocaleDateString('ms-MY'))}><Text style={{ color: p.accent, fontSize: 10, fontWeight: '700' }}>{en ? 'Food' : 'Makanan'} ↗</Text></TouchableOpacity>
      </View>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, padding: 12, marginBottom: 18, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.8 },
  arrow: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
