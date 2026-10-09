import React, { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ThemeText as Text } from './ThemePrimitives';
import { useTheme } from '../context/ThemeContext';
import { homeCardIds, homeCardLabels, moveHomeCard, type HomeCardId } from '../services/redcoinsHomeLayout';

export function RedCoinsHomeLayoutModal({ visible, order, close, save }: { visible: boolean; order: HomeCardId[]; close: () => void; save: (order: HomeCardId[]) => Promise<void> }) {
  const { palette: p } = useTheme();
  const [draft, setDraft] = useState(order); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const lock = useRef(false);
  useEffect(() => { if (visible) { setDraft(order); setError(''); } }, [visible, order]);
  const dismiss = () => { if (!lock.current) close(); };
  const apply = async () => { if (lock.current) return; lock.current = true; setBusy(true); setError(''); try { await save(draft); close(); } catch { setError('Could not save. Your previous order is unchanged. Try again.'); } finally { lock.current = false; setBusy(false); } };
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
    <Pressable onPress={dismiss} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.65)', justifyContent: 'center' }}>
      <SafeAreaView style={{ flex: 1, margin: 18, justifyContent: 'center' }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: p.canvas, borderRadius: 24, padding: 20, maxHeight: '100%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Text style={{ flex: 1, fontFamily: 'serif', fontSize: 25, color: p.text }}>Arrange Home</Text><Pressable onPress={dismiss} disabled={busy} accessibilityLabel="Close arrange home" hitSlop={12}><Ionicons name="close" color={p.text} size={24} /></Pressable></View>
          <Text style={{ color: p.muted, fontSize: 12, marginVertical: 12 }}>Move cards up or down. This order is saved on this device.</Text>
          <ScrollView style={{ flexShrink: 1 }}>
            {draft.map((id, index) => <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, borderBottomWidth: 1, borderColor: p.border }}>
              <Text style={{ color: p.muted, fontSize: 12 }}>{String(index + 1).padStart(2, '0')}</Text><Text style={{ color: p.text, fontSize: 14, flex: 1 }}>{homeCardLabels[id]}</Text>
              {([-1, 1] as const).map(direction => { const disabled = busy || (direction === -1 ? index === 0 : index === draft.length - 1); return <Pressable key={direction} disabled={disabled} accessibilityRole="button" accessibilityLabel={`Move ${homeCardLabels[id]} ${direction === -1 ? 'up' : 'down'}`} onPress={() => setDraft(value => moveHomeCard(value, id, direction))} style={{ padding: 10, borderRadius: 10, backgroundColor: p.surfaceAlt, opacity: disabled ? .35 : 1 }}><Ionicons name={direction === -1 ? 'arrow-up' : 'arrow-down'} size={18} color={p.text} /></Pressable>; })}
            </View>)}
          </ScrollView>
          {!!error && <Text accessibilityRole="alert" style={{ color: p.dark ? '#FF8383' : '#B52D36', fontSize: 12, marginTop: 10 }}>{error}</Text>}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
            <Pressable disabled={busy} onPress={() => setDraft([...homeCardIds])} style={{ padding: 14, backgroundColor: p.surfaceAlt, borderRadius: 12 }}><Text style={{ color: p.text }}>Reset order</Text></Pressable>
            <Pressable disabled={busy} onPress={() => { void apply(); }} style={{ flex: 1, alignItems: 'center', padding: 14, backgroundColor: p.hero, borderRadius: 12 }}>{busy ? <ActivityIndicator color={p.onHero} /> : <Text style={{ color: p.onHero, fontWeight: '700' }}>Save order</Text>}</Pressable>
          </View>
        </Pressable>
      </SafeAreaView>
    </Pressable>
  </Modal>;
}
