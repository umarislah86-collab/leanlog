import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLanguage } from '../context/LanguageContext';
import { applyFoodPortion } from '../services/foodPortion';
import type { FoodEntry } from '../types';

export default function FoodReviewModal({ entry, editing, onCancel, onSave }: {
  entry: FoodEntry;
  editing: boolean;
  onCancel: () => void;
  onSave: (entry: FoodEntry) => void;
}) {
  const { lang, t } = useLanguage();
  const bm = lang === 'bm';
  const [portionText, setPortionText] = useState(String(entry.portion ?? 1));
  const [date, setDate] = useState(() => {
    const [day, month, year] = entry.date.split('/').map(Number);
    const [hour, minute] = entry.time.split(':').map(Number);
    return new Date(year, month - 1, day, hour || 0, minute || 0);
  });
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const portion = Number(portionText.replace(',', '.'));
  const valid = Number.isFinite(portion) && portion > 0;
  const preview = applyFoodPortion(entry, valid ? portion : entry.portion ?? 1);
  const macro = (key: 'protein' | 'karbohidrat' | 'lemak') => Math.round(preview.items.reduce((sum, item) => sum + item[key], 0));
  const save = () => {
    if (!valid) return;
    onSave({ ...preview, date: date.toLocaleDateString('ms-MY'), time: date.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' }) });
  };
  return <Modal visible transparent animationType="slide" onRequestClose={onCancel}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.overlay}>
      <View style={s.sheet}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
          <Text style={s.eyebrow}>{editing ? (bm ? 'EDIT MAKANAN' : 'EDIT FOOD') : (bm ? 'SEMAK MAKANAN' : 'REVIEW FOOD')}</Text>
          <Text style={s.title}>{entry.name}</Text>
          {entry.imageUri && <Image source={{ uri: entry.imageUri }} style={s.image} />}
          <View style={s.summary}>
            <Text style={s.calories}>{preview.calories} kcal</Text>
            <Text style={s.macros}>P {macro('protein')}g · C {macro('karbohidrat')}g · F {macro('lemak')}g</Text>
          </View>
          <Text style={s.label}>{bm ? 'Portion hidangan' : 'Meal portion'}</Text>
          <Text style={s.hint}>{bm ? '1× = anggaran asal. 0.5× = separuh, 2× = dua kali ganda.' : '1× = original estimate. 0.5× = half, 2× = double.'}</Text>
          <View style={s.row}>
            {[0.5, 1, 1.5, 2].map(value => <TouchableOpacity key={value} accessibilityRole="button" onPress={() => setPortionText(String(value))} style={[s.chip, portion === value && s.active]}>
              <Text style={[s.chipText, portion === value && s.activeText]}>{value}×</Text>
            </TouchableOpacity>)}
          </View>
          <TextInput accessibilityLabel={bm ? 'Portion hidangan' : 'Meal portion'} value={portionText} onChangeText={setPortionText} keyboardType="decimal-pad" style={s.input} selectTextOnFocus />
          {!valid && <Text style={s.error}>{bm ? 'Masukkan portion lebih daripada 0.' : 'Enter a portion greater than 0.'}</Text>}
          {preview.items.map((item, index) => <View key={index} style={s.item}>
            <View style={{ flex: 1 }}><Text style={s.itemName}>{item.nama}</Text><Text style={s.hint}>P {Math.round(item.protein)}g · C {Math.round(item.karbohidrat)}g · F {Math.round(item.lemak)}g</Text></View>
            <Text style={s.itemName}>{item.kalori} kcal</Text>
          </View>)}
          <Text style={s.label}>{t('dateFormat')}</Text>
          <TouchableOpacity style={s.input} onPress={() => setPicker('date')}><Text style={s.itemName}>📅 {date.toLocaleDateString('ms-MY')}</Text></TouchableOpacity>
          <Text style={s.label}>{t('timeFormat')}</Text>
          <TouchableOpacity style={s.input} onPress={() => setPicker('time')}><Text style={s.itemName}>🕐 {date.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' })}</Text></TouchableOpacity>
          {picker && <DateTimePicker value={date} mode={picker} is24Hour onChange={(event, value) => {
            if (Platform.OS !== 'ios') setPicker(null);
            if (event.type !== 'dismissed' && value) setDate(value);
          }} />}
        </ScrollView>
        <View style={s.buttons}>
          <TouchableOpacity style={s.cancel} onPress={onCancel}><Text style={s.itemName}>{t('cancel')}</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" disabled={!valid} style={[s.save, !valid && { opacity: 0.4 }]} onPress={save}><Text style={s.activeText}>{t('save')}</Text></TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(8,14,24,0.7)' },
  sheet: { maxHeight: '90%', backgroundColor: '#FFFDF7', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 24 },
  content: { padding: 22 },
  eyebrow: { color: '#FF6542', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  title: { color: '#172033', fontSize: 24, fontWeight: '800', marginVertical: 10 },
  image: { width: '100%', height: 150, borderRadius: 14, marginBottom: 12 },
  summary: { backgroundColor: '#172033', borderRadius: 16, padding: 16, marginBottom: 14 },
  calories: { color: '#F7EEDC', fontSize: 26, fontWeight: '800' },
  macros: { color: '#91DCBB', marginTop: 6, fontWeight: '700' },
  label: { color: '#172033', fontWeight: '700', marginTop: 12, marginBottom: 6 },
  hint: { color: '#68758A', fontSize: 12, lineHeight: 18 },
  row: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  chip: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#EEE3CF', borderRadius: 12 },
  active: { backgroundColor: '#FF6542' },
  chipText: { color: '#172033', fontWeight: '700' },
  activeText: { color: '#FFFFFF', fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#DED5C6', borderRadius: 12, padding: 12, color: '#172033' },
  error: { color: '#B33421', marginTop: 5 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EEE3CF' },
  itemName: { color: '#172033', fontWeight: '700' },
  buttons: { flexDirection: 'row', gap: 10, paddingHorizontal: 22, paddingTop: 12 },
  cancel: { flex: 1, alignItems: 'center', padding: 14, borderRadius: 12, backgroundColor: '#EEE3CF' },
  save: { flex: 1, alignItems: 'center', padding: 14, borderRadius: 12, backgroundColor: '#FF6542' },
});
