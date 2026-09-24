'use no memo';
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

export type LeanLogWidgetProps = {
  eaten: number;
  burned: number;
  meals: number;
  goal: number;
  steps: number;
  nextEvent: string;
  updated: string;
};

export function LeanLogWidget({ eaten, burned, meals, goal, steps, nextEvent, updated }: LeanLogWidgetProps) {
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
        </FlexWidget>
        <FlexWidget style={{ flex: 1, backgroundColor: '#D9D8FF', borderRadius: 13, paddingHorizontal: 9, paddingVertical: 7, flexDirection: 'column' }}>
          <TextWidget text="NEXT UP" style={{ color: '#5C5AA3', fontSize: 7, fontWeight: '700' }} />
          <TextWidget text={nextEvent || 'Your day is clear'} maxLines={1} style={{ color: '#172033', fontSize: 10, fontWeight: '700', marginTop: 2 }} />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
