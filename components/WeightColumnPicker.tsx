import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';

interface Props {
  value: string; // e.g. "85.5"
  onChange: (value: string) => void;
}

const HUNDREDS = [0, 1, 2];
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export default function WeightColumnPicker({ value, onChange }: Props) {
  const num = parseFloat(value) || 0;
  const intPart = Math.floor(num);
  const h = Math.floor(intPart / 100);
  const t = Math.floor((intPart % 100) / 10);
  const u = intPart % 10;
  const d = Math.round((num - intPart) * 10);

  const emit = (nh: number, nt: number, nu: number, nd: number) =>
    onChange((nh * 100 + nt * 10 + nu + nd * 0.1).toFixed(1));

  return (
    <View style={s.wrap}>
      <View style={s.col}>
        <Picker
          selectedValue={h}
          onValueChange={v => emit(Number(v), t, u, d)}
          style={s.picker}
          dropdownIconColor="#FF6542"
        >
          {HUNDREDS.map(n => <Picker.Item key={n} label={String(n)} value={n} color="#FFFDF7" />)}
        </Picker>
        <Text style={s.colLabel}>100</Text>
      </View>
      <View style={s.col}>
        <Picker
          selectedValue={t}
          onValueChange={v => emit(h, Number(v), u, d)}
          style={s.picker}
          dropdownIconColor="#FF6542"
        >
          {DIGITS.map(n => <Picker.Item key={n} label={String(n)} value={n} color="#FFFDF7" />)}
        </Picker>
        <Text style={s.colLabel}>10</Text>
      </View>
      <View style={s.col}>
        <Picker
          selectedValue={u}
          onValueChange={v => emit(h, t, Number(v), d)}
          style={s.picker}
          dropdownIconColor="#FF6542"
        >
          {DIGITS.map(n => <Picker.Item key={n} label={String(n)} value={n} color="#FFFDF7" />)}
        </Picker>
        <Text style={s.colLabel}>1</Text>
      </View>
      <Text style={s.dot}>.</Text>
      <View style={s.col}>
        <Picker
          selectedValue={d}
          onValueChange={v => emit(h, t, u, Number(v))}
          style={s.picker}
          dropdownIconColor="#FF6542"
        >
          {DIGITS.map(n => <Picker.Item key={n} label={String(n)} value={n} color="#FFFDF7" />)}
        </Picker>
        <Text style={s.colLabel}>0.1</Text>
      </View>
      <Text style={s.unit}>kg</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#26334A',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 4,
  },
  col: { flex: 1, alignItems: 'center' },
  picker: { color: '#FFFDF7', backgroundColor: '#26334A', width: '100%' },
  colLabel: { color: '#657086', fontSize: 9, textAlign: 'center', paddingBottom: 4 },
  dot: { color: '#FFFDF7', fontSize: 24, fontWeight: 'bold', marginBottom: 14 },
  unit: { color: '#FF6542', fontSize: 14, fontWeight: '600', paddingHorizontal: 8, marginBottom: 14 },
});
