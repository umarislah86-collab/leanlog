'use no memo';
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

export type LeanLogWidgetProps = {
  eaten: number;
  goal: number;
  steps: number;
  nextEvent: string;
  updated: string;
};

export function LeanLogWidget({ eaten, goal, steps, nextEvent, updated }: LeanLogWidgetProps) {
  const left = Math.max(0, goal - eaten);
  const pct = Math.min(100, Math.round((eaten / Math.max(goal, 1)) * 100));
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{ height: 'match_parent', width: 'match_parent', flexDirection: 'column', backgroundColor: '#101A2B', borderRadius: 24, padding: 16 }}
    >
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <TextWidget text="LEANLOG · TODAY" style={{ color: '#8FD6B4', fontSize: 12, fontWeight: '700' }} />
        <TextWidget text={`${pct}%`} style={{ color: '#FF6542', fontSize: 13, fontWeight: '700' }} />
      </FlexWidget>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', marginTop: 12 }}>
        <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
          <TextWidget text={`${left.toLocaleString()}`} style={{ color: '#FFF4DB', fontSize: 30, fontWeight: '700' }} />
          <TextWidget text="kcal left" style={{ color: '#AAB5C7', fontSize: 11 }} />
        </FlexWidget>
        <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
          <TextWidget text={`${steps.toLocaleString()}`} style={{ color: '#FFF4DB', fontSize: 23, fontWeight: '700' }} />
          <TextWidget text="steps" style={{ color: '#AAB5C7', fontSize: 11 }} />
        </FlexWidget>
      </FlexWidget>
      <TextWidget text={nextEvent || 'No events left today'} maxLines={1} style={{ color: '#8D9BFF', fontSize: 12, marginTop: 13 }} />
      <TextWidget text={`Updated ${updated}`} style={{ color: '#697180', fontSize: 9, marginTop: 5 }} />
    </FlexWidget>
  );
}
