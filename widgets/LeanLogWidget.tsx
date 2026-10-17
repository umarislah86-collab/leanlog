'use no memo';
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { WidgetGuardSnapshot } from '../services/spendingGuards';

export type LeanLogWidgetProps = {
  eaten: number;
  macros: { protein: number; carbs: number; fat: number };
  burned: number;
  meals: number;
  goal: number;
  steps: number;
  nextEvent: string;
  guards: WidgetGuardSnapshot[];
  cashReality: { trueSpendable: number; liquidBalance: number; cardOutstanding: number; sourceDate: string } | null;
  updated: string;
};

export function LeanLogWidget({ eaten, macros, burned, meals, goal, steps, nextEvent, guards, cashReality, updated }: LeanLogWidgetProps) {
  const left = Math.max(0, goal - eaten);
  const pct = Math.min(100, Math.round((eaten / Math.max(goal, 1)) * 100));
  const visibleGuards = guards.slice(0, 4);
  const guardRows = Array.from({ length: Math.ceil(visibleGuards.length / 2) }, (_, index) => visibleGuards.slice(index * 2, index * 2 + 2));
  return (
    <FlexWidget
      clickAction="OPEN_URI" clickActionData={{ uri: 'leanlog://home' }}
      style={{ height: 'match_parent', width: 'match_parent', flexDirection: 'column', backgroundColor: '#F7EEDC', borderRadius: 24, padding: 11 }}
    >
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <TextWidget text="LEANLOG  /  TODAY" style={{ color: '#172033', fontSize: 11, fontWeight: '700' }} />
        <TextWidget text={`UPDATED ${updated}`} style={{ color: '#7C756B', fontSize: 8, fontWeight: '700' }} />
      </FlexWidget>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', marginTop: 5, alignItems: 'center' }}>
        <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
          <TextWidget text={`${left.toLocaleString()}`} style={{ color: '#172033', fontSize: 27, fontWeight: '700' }} />
          <TextWidget text="KCAL LEFT" style={{ color: '#FF6542', fontSize: 9, fontWeight: '700' }} />
        </FlexWidget>
        <FlexWidget style={{ flexDirection: 'column', alignItems: 'center', paddingHorizontal: 8 }}>
          <TextWidget text={`${steps.toLocaleString()} STEPS`} style={{ color: '#172033', fontSize: 8, fontWeight: '700' }} />
          <TextWidget text={`${meals} MEALS · ${burned} BURNED`} style={{ color: '#7C756B', fontSize: 7, fontWeight: '700', marginTop: 3 }} />
        </FlexWidget>
        <FlexWidget style={{ backgroundColor: '#172033', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'column', alignItems: 'flex-end' }}>
          <TextWidget text={`${pct}%`} style={{ color: '#91DCBB', fontSize: 16, fontWeight: '700' }} />
          <TextWidget text={`${eaten.toLocaleString()} / ${goal.toLocaleString()}`} style={{ color: '#F7EEDC', fontSize: 8 }} />
        </FlexWidget>
      </FlexWidget>
      <FlexWidget style={{ width: 'match_parent', height: 5, flexDirection: 'row', backgroundColor: '#DED5C6', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
        {pct > 0 && <FlexWidget style={{ flex: pct, height: 5, backgroundColor: '#FF6542', borderRadius: 3 }} />}
        {pct < 100 && <FlexWidget style={{ flex: 100 - pct, height: 5 }} />}
      </FlexWidget>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', marginTop: 7 }}>
        {([
          { label: 'PROTEIN', value: macros.protein, background: '#D8EFE4', color: '#315F50' },
          { label: 'CARBS', value: macros.carbs, background: '#FFE0D3', color: '#A4442D' },
          { label: 'FAT', value: macros.fat, background: '#E1E6F0', color: '#455879' },
        ] as const).map((macro, index) => (
          <FlexWidget key={macro.label} style={{ flex: 1, flexDirection: 'column', alignItems: 'center', backgroundColor: macro.background, borderRadius: 10, paddingVertical: 6, marginRight: index < 2 ? 4 : 0 }}>
            <TextWidget text={`${Math.round(macro.value)}g`} maxLines={1} style={{ color: '#172033', fontSize: 14, fontWeight: '700' }} />
            <TextWidget text={macro.label} style={{ color: macro.color, fontSize: 7, fontWeight: '700', marginTop: 2 }} />
          </FlexWidget>
        ))}
      </FlexWidget>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', marginTop: 6, backgroundColor: '#EEE3CF', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5, justifyContent: 'space-between' }}>
        <TextWidget text={nextEvent || 'Your day is clear'} maxLines={1} style={{ color: '#172033', fontSize: 8, fontWeight: '700' }} />
        {cashReality && <TextWidget text={`TRUE CASH ${cashReality.trueSpendable < 0 ? '-' : ''}RM ${Math.abs(cashReality.trueSpendable).toFixed(0)}`} style={{ color: cashReality.trueSpendable < 0 ? '#D4422B' : '#477363', fontSize: 7, fontWeight: '700' }} />}
      </FlexWidget>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'column', marginTop: 5 }}>
        {guardRows.length ? guardRows.map((row, rowIndex) => <FlexWidget key={`guard-row-${rowIndex}`} style={{ width: 'match_parent', flexDirection: 'row', marginBottom: 3 }}>
          {row.map((guard, columnIndex) => <FlexWidget key={guard.id} style={{ flex: 1, flexDirection: 'column', backgroundColor: guard.percent >= 100 ? '#FFD8CF' : rowIndex === 0 && columnIndex === 0 ? '#D8EFE4' : '#E9E3D7', borderRadius: 9, paddingHorizontal: 7, paddingVertical: 4, marginRight: columnIndex === 0 && row.length > 1 ? 3 : 0 }}>
            <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <FlexWidget style={{ flex: 1 }}><TextWidget text={guard.name.toUpperCase()} maxLines={1} style={{ color: '#172033', fontSize: 7, fontWeight: '700' }} /></FlexWidget>
              <TextWidget text={`${guard.percent.toFixed(0)}%`} style={{ color: guard.percent >= 100 ? '#B33421' : '#315F50', fontSize: 8, fontWeight: '700', marginLeft: 4 }} />
            </FlexWidget>
            <TextWidget text={`RM ${guard.spent.toFixed(0)} / ${guard.limit.toFixed(0)}`} maxLines={1} style={{ color: '#6D685F', fontSize: 6, fontWeight: '700', marginTop: 2 }} />
          </FlexWidget>)}
          {row.length === 1 && <FlexWidget style={{ flex: 1, marginLeft: 3 }} />}
        </FlexWidget>) : <TextWidget text="No spending guards yet" maxLines={1} style={{ color: '#172033', fontSize: 8, fontWeight: '700' }} />}
      </FlexWidget>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', marginTop: 3 }}>
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'leanlog://log/food' }} style={{ flex: 1, backgroundColor: '#FF6542', borderRadius: 8, paddingVertical: 4, alignItems: 'center', marginRight: 3 }}><TextWidget text="+ FOOD" style={{ color: '#FFFFFF', fontSize: 7, fontWeight: '700' }} /></FlexWidget>
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'leanlog://log/activity' }} style={{ flex: 1, backgroundColor: '#379B73', borderRadius: 8, paddingVertical: 4, alignItems: 'center', marginRight: 3 }}><TextWidget text="+ ACTIVITY" style={{ color: '#FFFFFF', fontSize: 7, fontWeight: '700' }} /></FlexWidget>
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'leanlog://redcoins/new' }} style={{ flex: 1, backgroundColor: '#528FF2', borderRadius: 8, paddingVertical: 4, alignItems: 'center' }}><TextWidget text="+ MONEY" style={{ color: '#FFFFFF', fontSize: 7, fontWeight: '700' }} /></FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
