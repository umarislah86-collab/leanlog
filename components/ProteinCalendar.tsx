import React, { useEffect, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { ThemeText as Text } from './ThemePrimitives';
import { useTheme } from '../context/ThemeContext';
import type { FoodEntry, UserProfile } from '../types';
import { loadProteinHistory, proteinDayKey, proteinForDay, proteinLevel, proteinTarget, snapshotProteinTarget, type ProteinHistory } from '../services/proteinTargets';

export function ProteinCalendar({ food, profile, openSettings }: { food: FoodEntry[]; profile: UserProfile | null; openSettings: () => void }) {
  const { palette: p } = useTheme();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [history, setHistory] = useState<ProteinHistory>({});
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const today = proteinDayKey();
  useEffect(() => {
    let active = true;
    void (profile ? snapshotProteinTarget(profile) : loadProteinHistory()).then(rows => { if (active) { setHistory(rows); setError(''); } }).catch(() => { if (active) setError('Target history belum dapat dibaca.'); });
    return () => { active = false; };
  }, [profile, today, attempt]);
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: month.getDay() + count }, (_, index) => index - month.getDay() + 1);
  while (cells.length % 7) cells.push(0);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const days = Array.from({ length: count }, (_, index) => {
    const date = new Date(month.getFullYear(), month.getMonth(), index + 1), key = proteinDayKey(date);
    const result = proteinForDay(food, key), target = history[key]?.target;
    return { date, key, ...result, target, level: proteinLevel(result.rows.length > 0, result.protein, target) };
  });
  const logged = days.filter(day => day.date <= now && day.rows.length);
  const measured = logged.filter(day => day.target);
  const met = measured.filter(day => day.level === 'met').length;
  const average = logged.length ? Math.round(logged.reduce((sum, day) => sum + day.protein, 0) / logged.length) : 0;
  const colours: Record<string, string> = { low: '#2B455F', medium: '#36618B', close: '#387BB9', met: '#22674F', unlogged: p.surfaceAlt, unknown: p.surfaceAlt };
  const details = selected ? proteinForDay(food, selected) : null;
  const detailTarget = selected ? history[selected]?.target : undefined;
  return <View style={{ padding: 16, marginBottom: 20, borderRadius: 18, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, gap: 12 }}>
    <Text style={{ color: p.text, fontSize: 19, fontWeight: '700' }}>Calendar protein</Text>
    <TouchableOpacity accessibilityRole="button" onPress={openSettings}><Text style={{ color: p.accent }}>{profile ? `Target hari ini ${proteinTarget(profile)}g · Ubah di Profile` : 'Set target di Profile'}</Text></TouchableOpacity>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <TouchableOpacity accessibilityLabel="Bulan sebelumnya" onPress={() => { setSelected(null); setMonth(date => new Date(date.getFullYear(), date.getMonth() - 1, 1)); }} style={{ padding: 10 }}><Text style={{ color: p.text }}>‹</Text></TouchableOpacity>
      <Text style={{ color: p.text, fontWeight: '700' }}>{month.toLocaleDateString('ms-MY', { month: 'long', year: 'numeric' })}</Text>
      <TouchableOpacity accessibilityLabel="Bulan seterusnya" onPress={() => { setSelected(null); setMonth(date => new Date(date.getFullYear(), date.getMonth() + 1, 1)); }} style={{ padding: 10 }}><Text style={{ color: p.text }}>›</Text></TouchableOpacity>
    </View>
    <Text style={{ color: p.muted }}>{met}/{measured.length} hari capai target · Purata {average}g pada {logged.length} hari berlog</Text>
    <View style={{ flexDirection: 'row' }}>{['A', 'I', 'S', 'R', 'K', 'J', 'S'].map((day, index) => <Text key={index} style={{ width: `${100 / 7}%`, textAlign: 'center', color: p.muted, fontSize: 11 }}>{day}</Text>)}</View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{cells.map((number, index) => {
      const day = number > 0 && number <= count ? days[number - 1] : null;
      const future = !!day && day.date > now;
      const shaded = day && day.level !== 'unlogged' && day.level !== 'unknown' && !future;
      return <View key={index} style={{ width: `${100 / 7}%`, padding: 2 }}>
        {day ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${day.key}, ${day.rows.length ? `${day.protein} gram protein` : 'belum log'}, ${day.target ? `target ${day.target} gram` : 'target sejarah tiada'}`} disabled={future} onPress={() => setSelected(day.key)} style={{ minHeight: 56, padding: 5, borderRadius: 8, backgroundColor: future ? p.surface : colours[day.level], borderWidth: 1, borderColor: day.key === today || day.key === selected ? p.accent : p.border, opacity: future ? .4 : 1 }}>
          <Text style={{ color: shaded ? '#FFFFFF' : p.text, fontSize: 12 }}>{number}</Text>
          <Text style={{ color: shaded ? '#FFFFFF' : p.muted, fontSize: 10, marginTop: 8 }}>{!future && day.rows.length ? `${day.protein}g${day.target ? '' : '?'}` : '—'}</Text>
        </TouchableOpacity> : <View style={{ minHeight: 56 }} />}
      </View>;
    })}</View>
    <Text style={{ color: p.muted, fontSize: 11, lineHeight: 18 }}>Biru pudar &lt;50% · sederhana 50–79% · terang 80–99% · hijau ≥100%. Kelabu — belum log / ? target sejarah tiada.</Text>
    <Text style={{ color: p.muted, fontSize: 11 }}>Berdasarkan makanan yang direkod. Log tak lengkap boleh membuat protein nampak rendah. Target sejarah sebelum ciri ini tidak diandaikan.</Text>
    {!!error && <TouchableOpacity onPress={() => setAttempt(value => value + 1)}><Text style={{ color: p.expense }}>{error} Tap untuk Retry.</Text></TouchableOpacity>}
    {details && selected && <View style={{ borderTopWidth: 1, borderTopColor: p.border, paddingTop: 12, gap: 7 }}>
      <Text style={{ color: p.text, fontWeight: '700' }}>{selected} · {details.protein}g{detailTarget ? ` / ${detailTarget}g` : ''}</Text>
      <Text style={{ color: p.muted }}>{!details.rows.length ? 'Belum ada log makanan.' : !detailTarget ? 'Target hari ini tidak digunakan semula untuk menilai hari lama.' : details.protein >= detailTarget ? 'Target protein cukup.' : `Lagi ${Math.round((detailTarget - details.protein) * 10) / 10}g untuk target.`}</Text>
      {details.rows.map(row => <Text key={row.id} style={{ color: p.text }}>{row.name} · {Math.round((row.items || []).reduce((sum, item) => sum + (item.protein || 0), 0) * 10) / 10}g</Text>)}
      <TouchableOpacity onPress={() => setSelected(null)}><Text style={{ color: p.accent }}>Tutup</Text></TouchableOpacity>
    </View>}
  </View>;
}
