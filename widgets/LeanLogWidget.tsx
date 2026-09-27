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
  const guardRows = Array.from({ length: Math.ceil(guards.length / 2) }, (_, index) => guards.slice(index * 2, index * 2 + 2));
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
        <FlexWidget style={{ flex: Math.max(4, pct), height: 5, backgroundColor: '#FF6542', borderRadius: 3 }} />
        <FlexWidget style={{ flex: Math.max(0, 100 - Math.max(4, pct)), height: 5 }} />
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
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'leanlog://redcoins/expense' }} style={{ flex: 1, backgroundColor: '#EF3F43', borderRadius: 8, paddingVertical: 4, alignItems: 'center', marginRight: 3 }}><TextWidget text="− EXPENSE" style={{ color: '#FFFFFF', fontSize: 7, fontWeight: '700' }} /></FlexWidget>
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'leanlog://redcoins/income' }} style={{ flex: 1, backgroundColor: '#379B73', borderRadius: 8, paddingVertical: 4, alignItems: 'center', marginRight: 3 }}><TextWidget text="+ INCOME" style={{ color: '#FFFFFF', fontSize: 7, fontWeight: '700' }} /></FlexWidget>
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'leanlog://redcoins/transfer' }} style={{ flex: 1, backgroundColor: '#528FF2', borderRadius: 8, paddingVertical: 4, alignItems: 'center' }}><TextWidget text="⇄ TRANSFER" style={{ color: '#FFFFFF', fontSize: 7, fontWeight: '700' }} /></FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
