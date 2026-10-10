import React, { useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Modal, Platform, ScrollView, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeText as Text, ThemeTextInput as TextInput } from './ThemePrimitives';
import { useTheme } from '../context/ThemeContext';
import { sumReviewedMeal, type MealImageReview, type MealPhoto } from '../services/foodImageAnalysis';

export function FoodImageReview({ review, photos, onChange, onSave, onCancel }: {
  review: MealImageReview; photos: MealPhoto[]; onChange: (review: MealImageReview) => void;
  onSave: (meal: ReturnType<typeof sumReviewedMeal>) => void; onCancel: () => void;
}) {
  const { palette: p } = useTheme();
  const [error, setError] = useState('');
  const saveLock = useRef(false);
  let total = 'Semak pilihan & portion';
  try { total = `${sumReviewedMeal(review).calories} kcal`; } catch {}
  const change = (next: MealImageReview) => { onChange(next); setError(''); };
  const button = (label: string, press: () => void, selected = false) => <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected }}
    onPress={press} style={{ padding: 12, borderWidth: 1, borderColor: selected ? p.accent : p.border, backgroundColor: selected ? p.coralTint : p.surfaceAlt, borderRadius: 10 }}>
    <Text style={{ color: p.text, fontWeight: '700' }}>{label}</Text>
  </TouchableOpacity>;
  const field = { color: p.text, borderWidth: 1, borderColor: p.border, borderRadius: 10, padding: 12, backgroundColor: p.surface };
  return <Modal visible animationType="slide" onRequestClose={onCancel}>
    <SafeAreaView style={{ flex: 1, backgroundColor: p.canvas }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 16 }}>
          <Text style={{ color: p.text, fontSize: 25, fontWeight: '700' }}>Semak satu meal</Text>
          <Text style={{ color: p.muted }}>AI menganggarkan portion dalam gambar. Betulkan sebelum Save. Semakan ini tidak menggunakan AI lagi.</Text>
          <TextInput accessibilityLabel="Nama meal" value={review.name} onChangeText={name => change({ ...review, name })} style={field} />
          {review.plates.map((plate, pi) => {
            const updatePlate = (patch: Partial<typeof plate>) => change({ ...review, plates: review.plates.map((row, index) => index === pi ? { ...row, ...patch } : row) });
            return <View key={plate.imageIndex} style={{ padding: 14, gap: 12, borderWidth: 1, borderColor: p.border, borderRadius: 14, backgroundColor: p.surface }}>
              <Text style={{ color: p.text, fontWeight: '700' }}>Gambar {plate.imageIndex}</Text>
              <Image source={{ uri: photos[plate.imageIndex - 1].uri }} style={{ height: 150, borderRadius: 10 }} resizeMode="contain" />
              {plate.duplicateOf && <Text style={{ color: p.expense }}>Mungkin plate sama dengan gambar {plate.duplicateOf}. {plate.duplicateReason} Sahkan pilihan di bawah.</Text>}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {button('Kira plate ini', () => updatePlate({ decision: 'include' }), plate.decision === 'include')}
                {button('Plate sama / abaikan', () => updatePlate({ decision: 'exclude' }), plate.decision === 'exclude')}
              </View>
              {!plate.items.length && <Text style={{ color: p.muted }}>Tiada makanan dikenal pasti dalam gambar ini.</Text>}
              {plate.decision !== 'exclude' && plate.items.map((item, ii) => {
                const updateItem = (patch: Partial<typeof item>) => updatePlate({ items: plate.items.map((row, index) => index === ii ? { ...row, ...patch } : row) });
                return <View key={ii} style={{ gap: 7, borderTopWidth: 1, borderTopColor: p.border, paddingTop: 12 }}>
                  <TextInput accessibilityLabel={`Nama makanan gambar ${plate.imageIndex}, item ${ii + 1}`} value={item.nama} onChangeText={nama => updateItem({ nama })} style={field} />
                  <Text style={{ color: p.muted }}>Kalori untuk portion dalam gambar</Text>
                  <TextInput accessibilityLabel={`Kalori ${item.nama}`} value={Number.isNaN(item.kalori) ? '' : String(item.kalori)} keyboardType="decimal-pad" onChangeText={value => updateItem({ kalori: value.trim() ? Number(value) : NaN })} style={field} />
                  <Text style={{ color: p.muted }}>Portion dimakan: 1 = semua, 0.5 = separuh, 0 = tak makan</Text>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>{['0', '0.25', '0.5', '1'].map(value => <React.Fragment key={value}>{button(value, () => updateItem({ portion: value }), item.portion === value)}</React.Fragment>)}</View>
                  <TextInput accessibilityLabel={`Portion ${item.nama}`} value={item.portion} onChangeText={portion => updateItem({ portion })} keyboardType="decimal-pad" style={field} />
                </View>;
              })}
            </View>;
          })}
          <Text style={{ color: p.text, fontSize: 20, fontWeight: '700' }}>Jumlah: {total}</Text>
          {!!error && <Text accessibilityRole="alert" style={{ color: p.expense }}>{error}</Text>}
          {button('Save satu meal', () => {
            if (saveLock.current) return;
            try { const meal = sumReviewedMeal(review); saveLock.current = true; onSave(meal); }
            catch (e) { saveLock.current = false; setError((e as Error).message); }
          })}
          {button('Batal', onCancel)}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}
