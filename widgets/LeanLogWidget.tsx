'use no memo';
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { WidgetGuardSnapshot } from '../services/spendingGuards';

export type LeanLogWidgetProps = {
  eaten: number;
  burned: number;
  meals: number;
  goal: number;
  steps: number;
  nextEvent: string;
  guards: WidgetGuardSnapshot[];
  cashReality: { trueSpendable: number; liquidBalance: number; cardOutstanding: number; sourceDate: string } | null;
  updated: string;
};

export function LeanLogWidget({ eaten, burned, meals, goal, steps, nextEvent, guards, cashReality, updated }: LeanLogWidgetProps) {
  const left = Math.max(0, goal - eaten);
  const pct = Math.min(100, Math.round((eaten / Math.max(goal, 1)) * 100));
  return (
    <FlexWidget
      clickAction="OPEN_APP"
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
        <FlexWidget style={{ backgroundColor: '#172033', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'column', alignItems: 'flex-end' }}>
          <TextWidget text={`${pct}%`} style={{ color: '#91DCBB', fontSize: 16, fontWeight: '700' }} />
          <TextWidget text={`${eaten.toLocaleString()} / ${goal.toLocaleString()}`} style={{ color: '#F7EEDC', fontSize: 8 }} />
        </FlexWidget>
      </FlexWidget>
      <FlexWidget style={{ width: 'match_parent', height: 5, flexDirection: 'row', backgroundColor: '#DED5C6', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
        <FlexWidget style={{ flex: Math.max(4, pct), height: 5, backgroundColor: '#FF6542', borderRadius: 3 }} />
        <FlexWidget style={{ flex: Math.max(0, 100 - Math.max(4, pct)), height: 5 }} />
      </FlexWidget>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', marginTop: 6, backgroundColor: '#EEE3CF', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5, justifyContent: 'space-between' }}>
        <TextWidget text={`${steps.toLocaleString()} steps  ·  ${meals} meals  ·  ${burned} burned`} style={{ color: '#172033', fontSize: 8, fontWeight: '700' }} />
        {cashReality && <TextWidget text={`TRUE CASH ${cashReality.trueSpendable < 0 ? '-' : ''}RM ${Math.abs(cashReality.trueSpendable).toFixed(0)}`} style={{ color: cashReality.trueSpendable < 0 ? '#D4422B' : '#477363', fontSize: 7, fontWeight: '700' }} />}
      </FlexWidget>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'column', marginTop: 5 }}>
        {guards.length ? guards.map((guard, index) => (
          <FlexWidget key={guard.id} style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', backgroundColor: guard.percent >= 100 ? '#FFD8CF' : index === 0 ? '#D8EFE4' : '#E9E3D7', borderRadius: 9, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 3 }}>
            <TextWidget text={index === 0 ? '📌' : '●'} style={{ color: guard.percent >= 100 ? '#D4422B' : '#477363', fontSize: 7, marginRight: 5 }} />
            <FlexWidget style={{ flex: 1 }}><TextWidget text={guard.name.toUpperCase()} maxLines={1} style={{ color: '#172033', fontSize: 7, fontWeight: '700' }} /></FlexWidget>
            <TextWidget text={`RM ${guard.spent.toFixed(0)}/${guard.limit.toFixed(0)}`} style={{ color: '#172033', fontSize: 7, fontWeight: '700', marginRight: 6 }} />
            <TextWidget text={`${guard.percent.toFixed(0)}%`} style={{ color: guard.percent >= 100 ? '#B33421' : '#315F50', fontSize: 8, fontWeight: '700' }} />
          </FlexWidget>
        )) : <TextWidget text={nextEvent || 'Your day is clear'} maxLines={1} style={{ color: '#172033', fontSize: 9, fontWeight: '700' }} />}
      </FlexWidget>
    </FlexWidget>
  );
}
