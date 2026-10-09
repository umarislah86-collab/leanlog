import { ThemeText as Text } from '../components/ThemePrimitives';
import { useTheme, useThemeStyles } from '../context/ThemeContext';
import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import { deliverExport } from '../services/exportFile';
import { AI_REDUCTION_TARGETS, buildRedCoinsAiPrompt, type AiPromptScope } from '../services/redcoinsAiPrompt';
import type { RedCoinsState } from '../services/redcoins';

export function RedCoinsAiPromptModal({ visible, state, scope, close }: { visible: boolean; state: RedCoinsState; scope: AiPromptScope; close: () => void }) {
  const s = useThemeStyles(baseS);
  const { themed } = useTheme();
  const [target, setTarget] = useState(10);
  const [lookback, setLookback] = useState<3 | 6>(3);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  // Live dependencies invalidate the payload when ledger, report or settings change.
  const result = useMemo(() => {
    if (!visible) return null;
    try { return { report: buildRedCoinsAiPrompt(state, scope, target, lookback), error: null }; }
    catch (error) { return { report: null, error: error instanceof Error ? error.message : 'Unable to generate this prompt.' }; }
  }, [visible, state, scope, target, lookback]);
  const report = result?.report;
  const run = async (action: 'copy' | 'save') => {
    if (!report || busy) return;
    setBusy(true);
    try {
      if (action === 'copy') {
        if (!await Clipboard.setStringAsync(report.prompt)) throw new Error('Clipboard was unavailable. Try Save .txt instead.');
        Alert.alert('Prompt copied', 'Paste it into your preferred AI. For a long report, attach the .txt file if the AI has a message-size limit.');
      } else {
        if (!FileSystem.cacheDirectory) throw new Error('File storage is unavailable.');
        const uri = `${FileSystem.cacheDirectory}${report.filename}`;
        await FileSystem.writeAsStringAsync(uri, report.prompt, { encoding: FileSystem.EncodingType.UTF8 });
        await deliverExport(uri, report.filename, 'text/plain');
      }
    } catch (error) { Alert.alert('Prompt export failed', error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  };
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
    <View style={s.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close AI prompt" />
      <View style={s.card}>
        <View style={s.header}><View style={{ flex: 1 }}><Text style={s.eyebrow}>REDCOINS / AI HANDOFF</Text><Text style={s.title}>Read the money story.</Text></View><TouchableOpacity onPress={close} style={s.close} accessibilityLabel="Close"><Ionicons name="close" size={21} color={themed("#111A2A", 'color')} /></TouchableOpacity></View>
        <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
          <Text style={s.scope}>{scope.label}</Text>
          <Text style={s.hint}>Generate locally, then copy or attach the file to any AI. No API key; nothing is sent automatically.</Text>
          <Text style={s.label}>EXPENSE REDUCTION SCENARIO</Text>
          <View style={s.picker}><Picker style={{ color: themed('#111A2A', 'color') }} dropdownIconColor="#111A2A" selectedValue={target} onValueChange={value => setTarget(Number(value))} enabled={!busy}>{AI_REDUCTION_TARGETS.map(value => <Picker.Item color={themed("#111A2A", 'color')} key={value} label={`${value}%${value === 10 ? ' · default' : ''}`} value={value} />)}</Picker></View>
          <Text style={s.label}>BASELINE</Text>
          <View style={s.picker}><Picker style={{ color: themed('#111A2A', 'color') }} dropdownIconColor="#111A2A" selectedValue={lookback} onValueChange={value => setLookback(Number(value) as 3 | 6)} enabled={!busy}><Picker.Item color={themed("#111A2A", 'color')} label="Previous 3 completed periods" value={3} /><Picker.Item color={themed("#111A2A", 'color')} label="Previous 6 completed periods" value={6} /></Picker></View>
          {report && <View style={s.summary}><Text style={s.summaryTitle}>{report.data.selected.transactionIds.length} actual entries · {report.data.baseline.availablePeriods}/{lookback} baseline periods</Text><Text style={s.hint}>Selected recorded expense RM {report.data.selected.metrics.expense.toFixed(2)} · {target}% scenario RM {report.data.goal.selectedRecordedExpenseReduction.toFixed(2)}. A scenario is not guaranteed savings.</Text><Text style={s.hint}>Includes full referenced transactions and current account snapshots. Future entries stay separate; loan repayments and card settlements are distinguished.</Text></View>}
          {report?.data.warnings.map(warning => <Text key={warning} style={s.warning}>{warning}</Text>)}
          {result?.error && <Text style={s.warning}>{result.error}</Text>}
          <TouchableOpacity onPress={() => setPreview(value => !value)} style={s.previewButton}><Text style={s.previewLabel}>{preview ? 'HIDE PROMPT PREVIEW' : 'PREVIEW GENERATED PROMPT'}</Text><Ionicons name={preview ? 'chevron-up' : 'chevron-down'} size={16} color={themed("#7C8290", 'color')} /></TouchableOpacity>
          {preview && report && <Text selectable style={s.preview}>{report.prompt}</Text>}
        </ScrollView>
        <View style={s.actions}><TouchableOpacity disabled={!report || busy} style={[s.save, (!report || busy) && s.disabled]} onPress={() => { void run('save'); }}><Text style={s.saveText}>SAVE .TXT</Text></TouchableOpacity><TouchableOpacity disabled={!report || busy} style={[s.copy, (!report || busy) && s.disabled]} onPress={() => { void run('copy'); }}><Text style={s.copyText}>{busy ? 'WORKING…' : 'COPY PROMPT'}</Text></TouchableOpacity></View>
      </View>
    </View>
  </Modal>;
}

const baseS = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#111A2A88', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#FFF9EA', borderRadius: 25, maxHeight: '90%', padding: 20 },
  header: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 12 },
  eyebrow: { color: '#F04444', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#111A2A', fontFamily: 'serif', fontSize: 25, fontWeight: '800', marginTop: 6 },
  close: { padding: 10, backgroundColor: '#F0E6D4', borderRadius: 14 },
  content: { paddingBottom: 8 },
  scope: { color: '#111A2A', fontSize: 13, fontWeight: '800' },
  hint: { color: '#7C8290', fontSize: 11, lineHeight: 17, marginTop: 7 },
  label: { color: '#7C8290', fontSize: 9, fontWeight: '900', letterSpacing: 1, marginTop: 18, marginBottom: 6 },
  picker: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0D9CD', borderRadius: 14, overflow: 'hidden' },
  summary: { backgroundColor: '#FFFFFF', borderRadius: 17, padding: 13, marginTop: 14 },
  summaryTitle: { color: '#111A2A', fontSize: 12, fontWeight: '800' },
  warning: { color: '#846139', fontSize: 10, lineHeight: 16, marginTop: 9 },
  previewButton: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 17 },
  previewLabel: { color: '#111A2A', fontSize: 10, fontWeight: '900' },
  preview: { color: '#111A2A', fontFamily: 'monospace', fontSize: 10, lineHeight: 16, backgroundColor: '#FFFFFF', padding: 12, borderRadius: 12 },
  actions: { flexDirection: 'row', gap: 9, paddingTop: 12 },
  save: { flex: 1, paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: '#CEC7B9', borderRadius: 15 },
  copy: { flex: 1.4, paddingVertical: 15, alignItems: 'center', backgroundColor: '#111A2A', borderRadius: 15 },
  saveText: { color: '#111A2A', fontSize: 11, fontWeight: '900' },
  copyText: { color: '#83D8B4', fontSize: 11, fontWeight: '900' },
  disabled: { opacity: 0.4 },
});
