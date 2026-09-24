import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useLanguage } from '../context/LanguageContext';

interface Props {
  protein: number;
  carbs: number;
  fat: number;
  calorieGoal: number;
  eatenCalories: number;
  compact?: boolean;
}

const STROKE_W = 9;
const STROKE_W_C = 8;

const RING_DEFS = [
  { key: 'carbs',   radius: 72, color: '#FF6542' },
  { key: 'protein', radius: 56, color: '#8D9BFF' },
  { key: 'fat',     radius: 40, color: '#E8B84A' },
] as const;

const RING_DEFS_COMPACT = [
  { key: 'carbs',   radius: 60, color: '#FF6542' },
  { key: 'protein', radius: 46, color: '#8D9BFF' },
  { key: 'fat',     radius: 33, color: '#E8B84A' },
] as const;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function MacroRings({ protein, carbs, fat, calorieGoal, eatenCalories, compact }: Props) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<'carbs' | 'protein' | 'fat' | null>(null);
  const ringProgress = useRef({
    carbs: new Animated.Value(0),
    protein: new Animated.Value(0),
    fat: new Animated.Value(0),
  }).current;

  const proteinGoal = Math.round(calorieGoal * 0.25 / 4);
  const carbsGoal   = Math.round(calorieGoal * 0.45 / 4);
  const fatGoal     = Math.round(calorieGoal * 0.30 / 9);

  const values: Record<string, number> = { carbs, protein, fat };
  const goals:  Record<string, number> = { carbs: carbsGoal, protein: proteinGoal, fat: fatGoal };

  const legendItems = [
    { key: 'carbs',   label: t('carbs'),   color: '#FF6542', val: carbs,   goal: carbsGoal },
    { key: 'protein', label: t('protein'), color: '#8D9BFF', val: protein, goal: proteinGoal },
    { key: 'fat',     label: t('fat'),     color: '#E8B84A', val: fat,     goal: fatGoal },
  ];

  const size = compact ? 148 : 176;
  const cx = size / 2;
  const cy = size / 2;
  const sw = compact ? STROKE_W_C : STROKE_W;
  const ringDefs = compact ? RING_DEFS_COMPACT : RING_DEFS;
  useEffect(() => {
    Animated.parallel((['carbs', 'protein', 'fat'] as const).map((key) => Animated.spring(ringProgress[key], {
      toValue: goals[key] > 0 ? Math.min(values[key] / goals[key], 1) : 0,
      damping: 18,
      stiffness: 85,
      mass: 0.7,
      useNativeDriver: false,
    }))).start();
  }, [carbs, protein, fat, calorieGoal]);

  const selectedValue = selected ? values[selected] : eatenCalories;
  const selectedGoal = selected ? goals[selected] : calorieGoal;

  return (
    <View style={compact ? styles.wrapperCompact : styles.wrapper}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          {ringDefs.map(({ key, radius, color }) => {
            const circ = 2 * Math.PI * radius;
            return (
              <G key={key} rotation={-90} origin={`${cx}, ${cy}`}>
                <Circle
                  cx={cx} cy={cy} r={radius}
                  stroke="#252535"
                  strokeWidth={sw}
                  fill="none"
                />
                <AnimatedCircle
                  cx={cx} cy={cy} r={radius}
                  stroke={color}
                  strokeWidth={sw}
                  strokeDasharray={`${circ} ${circ}`}
                  strokeDashoffset={ringProgress[key].interpolate({ inputRange: [0, 1], outputRange: [circ, 0] })}
                  strokeLinecap="round"
                  fill="none"
                  onPress={() => setSelected((current) => current === key ? null : key)}
                />
              </G>
            );
          })}
        </Svg>

        <View style={styles.centerOverlay} pointerEvents="none">
          <Text style={compact ? styles.centerCalNumCompact : styles.centerCalNum}>{Math.round(selectedValue)}</Text>
          <Text style={styles.centerGoalLine}>/ {Math.round(selectedGoal)}</Text>
          <Text style={styles.centerUnit}>{selected ? `${t(selected)} · g` : 'kcal'}</Text>
        </View>
      </View>

      {!compact && (
        <View style={styles.legend}>
          {legendItems.map(({ key, label, color, val, goal }) => {
            const left = Math.max(goal - val, 0);
            return (
              <View key={key} style={styles.legendRow}>
                <View style={[styles.dot, { backgroundColor: color }]} />
                <Text style={styles.legendLabel}>{label}</Text>
                <Text style={styles.legendVals}>{val}g / {goal}g</Text>
                <Text style={[styles.legendLeft, { color }]}>{left}g left</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: '#26334A',
  },
  wrapperCompact: {
    alignItems: 'center',
  },
  centerOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerCalNum: {
    color: '#FFFDF7',
    fontSize: 26,
    fontWeight: 'bold',
    lineHeight: 30,
  },
  centerCalNumCompact: {
    color: '#FFFDF7',
    fontSize: 22,
    fontWeight: 'bold',
    lineHeight: 26,
  },
  centerGoalLine: {
    color: '#7D8799',
    fontSize: 13,
    lineHeight: 18,
  },
  centerUnit: {
    color: '#657086',
    fontSize: 10,
    marginTop: 2,
  },
  legend: {
    width: '100%',
    paddingHorizontal: 8,
    marginTop: 12,
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    color: '#AAB3C2',
    fontSize: 12,
    flex: 1,
  },
  legendVals: {
    color: '#CBD2DD',
    fontSize: 12,
    fontWeight: '500',
    marginRight: 6,
  },
  legendLeft: {
    fontSize: 11,
    fontWeight: '600',
    minWidth: 52,
    textAlign: 'right',
  },
});
