import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeText as Text } from './ThemePrimitives';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { moveProgressCard, normalizeProgressOrder, saveProgressOrder, type ProgressCardId } from '../services/progressCardOrder';

export function ProgressCardOrderModal({ visible, order, onClose, onSave }: {
  visible: boolean; order: ProgressCardId[]; onClose: () => void; onSave: (order: ProgressCardId[]) => void;
}) {
  const { palette: p } = useTheme();
  const { lang } = useLanguage();
  const en = lang === 'en';
  const [draft, setDraft] = useState(order);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (visible) setDraft([...order]); }, [visible, order]);
  const labels: Record<ProgressCardId, string> = {
    protein: 'Protein Daily', weight: en ? 'Weight & chart' : 'Berat & graf',
    timeline: 'Body Timeline', brief: 'Progress Brief', export: en ? 'Export PDF / CSV' : 'Eksport PDF / CSV',
    calendar: en ? 'Calendar' : 'Calendar',
  };
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try { onSave(await saveProgressOrder(draft)); onClose(); }
    catch { Alert.alert(en ? 'Unable to save' : 'Belum dapat simpan', en ? 'Try again. Your previous order is still active.' : 'Cuba lagi. Susunan lama masih digunakan.'); }
    finally { setSaving(false); }
  };
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!saving) onClose(); }}>
    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <View style={{ width: '100%', maxHeight: '85%', borderRadius: 24, padding: 20, backgroundColor: p.surface }}>
        <Text style={{ color: p.text, fontSize: 21, fontWeight: '800' }}>{en ? 'Arrange cards' : 'Susun kad'}</Text>
        <Text style={{ color: p.muted, fontSize: 12, marginTop: 5, marginBottom: 16 }}>{en ? 'Top to bottom. Use the arrows to move each card.' : 'Atas ke bawah. Tekan anak panah untuk pindahkan kad.'}</Text>
        <ScrollView>
          {draft.map((id, index) => <View key={id} style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: p.border, paddingVertical: 7 }}>
            <Text style={{ color: p.muted, width: 24, fontSize: 12 }}>{index + 1}</Text>
            <Text style={{ color: p.text, flex: 1, fontSize: 13, fontWeight: '700' }}>{labels[id]}</Text>
            {([-1, 1] as const).map(direction => {
              const disabled = saving || (direction === -1 ? index === 0 : index === draft.length - 1);
              return <TouchableOpacity key={direction} disabled={disabled} accessibilityRole="button" accessibilityLabel={`${direction === -1 ? (en ? 'Move up' : 'Naikkan') : (en ? 'Move down' : 'Turunkan')} ${labels[id]}`} onPress={() => setDraft(value => moveProgressCard(value, id, direction))} style={{ padding: 11, opacity: disabled ? .25 : 1 }}><Ionicons name={direction === -1 ? 'arrow-up' : 'arrow-down'} size={18} color={p.text} /></TouchableOpacity>;
            })}
          </View>)}
        </ScrollView>
        <TouchableOpacity disabled={saving} onPress={() => setDraft(normalizeProgressOrder(null))} style={{ paddingVertical: 13 }}><Text style={{ color: p.accent, fontSize: 12 }}>{en ? 'Reset default order' : 'Susunan asal'}</Text></TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity disabled={saving} onPress={onClose} style={{ flex: 1, padding: 13, borderRadius: 12, backgroundColor: p.surfaceAlt, alignItems: 'center' }}><Text style={{ color: p.text }}>{en ? 'Cancel' : 'Batal'}</Text></TouchableOpacity>
          <TouchableOpacity disabled={saving} onPress={save} style={{ flex: 1, padding: 13, borderRadius: 12, backgroundColor: p.hero, alignItems: 'center', opacity: saving ? .5 : 1 }}><Text style={{ color: p.onHero, fontWeight: '700' }}>{saving ? '…' : en ? 'Save' : 'Simpan'}</Text></TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>;
}
