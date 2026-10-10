import React, { useEffect, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { ThemeText as Text, ThemeTextInput as TextInput } from './ThemePrimitives';
import { useTheme } from '../context/ThemeContext';
import type { UserProfile } from '../types';
import { proteinTarget } from '../services/proteinTargets';

export interface ProteinDraft { mode: 'auto' | 'strength' | 'factor' | 'fixed'; factor: string; grams: string; referenceWeight: string }
export const proteinDraft = (profile: UserProfile | null): ProteinDraft => ({ mode: profile?.protein?.mode || 'auto', factor: String(profile?.protein?.factor ?? 1.2), grams: String(profile?.protein?.grams ?? 140), referenceWeight: profile?.protein?.referenceWeight === undefined ? '' : String(profile.protein.referenceWeight) });
export function proteinSettings(draft: ProteinDraft): NonNullable<UserProfile['protein']> {
  return { mode: draft.mode, ...(draft.mode === 'factor' ? { factor: Number(draft.factor) } : {}), ...(draft.mode === 'fixed' ? { grams: Number(draft.grams) } : {}), ...(draft.referenceWeight.trim() && draft.mode !== 'fixed' ? { referenceWeight: Number(draft.referenceWeight) } : {}) };
}
export function ProteinSettings({ draft, weight, onChange, openRequested }: { draft: ProteinDraft; weight: number; openRequested?: number; onChange: (draft: ProteinDraft) => void }) {
  const { palette: p } = useTheme();
  const [open, setOpen] = useState(false);
  useEffect(() => { if (openRequested) setOpen(true); }, [openRequested]);
  const settings = proteinSettings(draft);
  const target = proteinTarget({ weight, protein: settings } as UserProfile);
  const factor = draft.mode === 'strength' ? 1.6 : draft.mode === 'factor' ? draft.factor : 1.2;
  const field = { borderWidth: 1, borderColor: p.border, borderRadius: 10, padding: 12, color: p.text, backgroundColor: p.surface };
  return <View style={{ marginVertical: 14, gap: 10 }}>
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(value => !value)} style={{ ...field, padding: 16 }}>
      <Text style={{ color: p.text, fontWeight: '700' }}>Protein Target · {Number.isFinite(target) && target > 0 ? `${target}g/hari` : 'Semak nilai'} {open ? '⌃' : '⌄'}</Text>
      <Text style={{ color: p.muted, marginTop: 5 }}>{draft.mode === 'fixed' ? 'Target gram tetap' : `${settings.referenceWeight ?? weight}kg × ${factor}g/kg · ${settings.referenceWeight ? 'berat rujukan' : 'auto ikut logger'}`}</Text>
    </TouchableOpacity>
    {open && <>
      {([['auto', 'Auto · 1.2g/kg'], ['strength', 'Latihan kekuatan · 1.6g/kg'], ['factor', 'Custom faktor'], ['fixed', 'Custom gram tetap']] as const).map(([mode, label]) => <TouchableOpacity key={mode} accessibilityRole="radio" accessibilityState={{ checked: draft.mode === mode }} onPress={() => onChange({ ...draft, mode })} style={{ ...field, borderColor: draft.mode === mode ? p.accent : p.border }}><Text style={{ color: p.text }}>{draft.mode === mode ? '● ' : '○ '}{label}</Text></TouchableOpacity>)}
      {draft.mode === 'factor' && <><Text style={{ color: p.text }}>Faktor g/kg</Text><TextInput style={field} keyboardType="decimal-pad" value={draft.factor} onChangeText={factor => onChange({ ...draft, factor })} /></>}
      {draft.mode === 'fixed' ? <><Text style={{ color: p.text }}>Protein g/hari</Text><TextInput style={field} keyboardType="decimal-pad" value={draft.grams} onChangeText={grams => onChange({ ...draft, grams })} /></> : <>
        <Text style={{ color: p.text }}>Berat rujukan (pilihan)</Text><TextInput style={field} keyboardType="decimal-pad" placeholder="Kosong = berat semasa logger" placeholderTextColor={p.muted} value={draft.referenceWeight} onChangeText={referenceWeight => onChange({ ...draft, referenceWeight })} />
      </>}
      <Text style={{ color: p.muted, lineHeight: 19 }}>Anggaran permulaan untuk dewasa sihat. Berat rujukan atau target manual boleh digunakan mengikut nasihat dietitian, terutama jika berat berlebihan atau ada penyakit buah pinggang.</Text>
    </>}
  </View>;
}
