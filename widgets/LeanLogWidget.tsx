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
  pinnedGuard: WidgetGuardSnapshot | null;
  cashReality: { trueSpendable: number; liquidBalance: number; cardOutstanding: number; sourceDate: string } | null;
  updated: string;
};

export function LeanLogWidget({ eaten, burned, meals, goal, steps, nextEvent, pinnedGuard, cashReality, updated }: LeanLogWidgetProps) {
  const left = Math.max(0, goal - eaten);
  const pct = Math.min(100, Math.round((eaten / Math.max(goal, 1)) * 100));
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{ height: 'match_parent', width: 'match_parent', flexDirection: 'column', backgroundColor: '#F7EEDC', borderRadius: 26, padding: 15 }}
    >
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <TextWidget text="LEANLOG  /  TODAY" style={{ color: '#172033', fontSize: 11, fontWeight: '700' }} />
        <TextWidget text={`UPDATED ${updated}`} style={{ color: '#7C756B', fontSize: 8, fontWeight: '700' }} />
      </FlexWidget>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', marginTop: 9, alignItems: 'center' }}>
        <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
          <TextWidget text={`${left.toLocaleString()}`} style={{ color: '#172033', fontSize: 31, fontWeight: '700' }} />
          <TextWidget text="KCAL LEFT" style={{ color: '#FF6542', fontSize: 9, fontWeight: '700' }} />
        </FlexWidget>
        <FlexWidget style={{ backgroundColor: '#172033', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'column', alignItems: 'flex-end' }}>
          <TextWidget text={`${pct}%`} style={{ color: '#91DCBB', fontSize: 18, fontWeight: '700' }} />
          <TextWidget text={`${eaten.toLocaleString()} / ${goal.toLocaleString()}`} style={{ color: '#F7EEDC', fontSize: 8 }} />
        </FlexWidget>
      </FlexWidget>
      <FlexWidget style={{ width: 'match_parent', height: 7, backgroundColor: '#DED5C6', borderRadius: 4, marginTop: 9 }}>
        <FlexWidget style={{ flex: Math.max(4, pct), height: 7, backgroundColor: '#FF6542', borderRadius: 4 }} />
        <FlexWidget style={{ flex: Math.max(0, 100 - Math.max(4, pct)), height: 7 }} />
      </FlexWidget>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', marginTop: 10 }}>
        <FlexWidget style={{ flex: 1, backgroundColor: '#EEE3CF', borderRadius: 13, paddingHorizontal: 9, paddingVertical: 7, marginRight: 6, flexDirection: 'column' }}>
          <TextWidget text={`${steps.toLocaleString()} steps`} style={{ color: '#172033', fontSize: 11, fontWeight: '700' }} />
          <TextWidget text={`${meals} meals · ${burned} burned`} style={{ color: '#777166', fontSize: 8, marginTop: 2 }} />
          {cashReality && <TextWidget text={`TRUE CASH ${cashReality.trueSpendable < 0 ? '-' : ''}RM ${Math.abs(cashReality.trueSpendable).toFixed(0)}`} style={{ color: cashReality.trueSpendable < 0 ? '#D4422B' : '#477363', fontSize: 7, fontWeight: '700', marginTop: 2 }} />}
        </FlexWidget>
        <FlexWidget style={{ flex: 1, backgroundColor: pinnedGuard ? (pinnedGuard.percent >= 100 ? '#FFD8CF' : '#D8EFE4') : '#D9D8FF', borderRadius: 13, paddingHorizontal: 9, paddingVertical: 7, flexDirection: 'column' }}>
          <TextWidget text={pinnedGuard ? `📌 ${pinnedGuard.name.toUpperCase()}` : 'NEXT UP'} maxLines={1} style={{ color: pinnedGuard?.percent && pinnedGuard.percent >= 100 ? '#B33421' : '#315F50', fontSize: 7, fontWeight: '700' }} />
          <TextWidget text={pinnedGuard ? `RM ${pinnedGuard.spent.toFixed(0)} / ${pinnedGuard.limit.toFixed(0)} · ${pinnedGuard.percent.toFixed(0)}%` : (nextEvent || 'Your day is clear')} maxLines={1} style={{ color: '#172033', fontSize: 10, fontWeight: '700', marginTop: 2 }} />
          {pinnedGuard && <TextWidget text={pinnedGuard.remaining >= 0 ? `RM ${pinnedGuard.remaining.toFixed(0)} left` : `RM ${Math.abs(pinnedGuard.remaining).toFixed(0)} OVER`} style={{ color: pinnedGuard.remaining >= 0 ? '#477363' : '#D4422B', fontSize: 7, fontWeight: '700', marginTop: 1 }} />}
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
