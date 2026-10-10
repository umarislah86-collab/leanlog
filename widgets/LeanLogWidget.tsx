'use no memo';
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { WidgetGuardSnapshot } from '../services/spendingGuards';
import type { WidgetAccount } from './RedCoinsWidgets';
import { themedWidgetTree } from './widget-theme';
import type { AppThemeId } from '../services/appTheme';

export type LeanLogWidgetProps = {
  themeId?: AppThemeId;
  eaten: number;
  burned: number;
  meals: number;
  goal: number;
  steps: number;
  guards: WidgetGuardSnapshot[];
  bottomMode?: 'guards' | 'accounts';
  accounts?: WidgetAccount[];
  cashReality: { trueSpendable: number; liquidBalance: number; cardOutstanding: number; sourceDate: string } | null;
  updated: string;
};

export function LeanLogWidget({ eaten, burned, meals, goal, steps, guards, bottomMode = 'guards', accounts = [], cashReality, themeId = 'cream' }: LeanLogWidgetProps) {
  const left = Math.max(0, goal - eaten);
  const pct = Math.min(100, Math.round((eaten / Math.max(goal, 1)) * 100));
  const visibleGuards = guards.slice(0, 4);
  const guardRows = Array.from({ length: Math.ceil(visibleGuards.length / 2) }, (_, index) => visibleGuards.slice(index * 2, index * 2 + 2));
  const visibleAccounts = accounts.slice(0, 4);
  const accountRows = Array.from({ length: Math.ceil(visibleAccounts.length / 2) }, (_, index) => visibleAccounts.slice(index * 2, index * 2 + 2));
  // Android LinearLayout weights distribute leftover space after measuring
  // wrap_content. Start both columns at zero so label lengths cannot shift
  // the divider independently in each row.
  const snapshotCell = { width: 0, flex: 1, height: 27, flexDirection: 'column' as const, justifyContent: 'center' as const, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 };
  return themedWidgetTree((
    <FlexWidget
      clickAction="OPEN_URI" clickActionData={{ uri: 'leanlog://home' }}
      style={{ height: 'match_parent', width: 'match_parent', flexDirection: 'column', backgroundColor: '#F7EEDC', borderRadius: 16, padding: 6 }}
    >
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
        <FlexWidget style={{ width: 0, flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <TextWidget text={`${left.toLocaleString()}`} maxLines={1} style={{ color: '#172033', fontSize: 22, fontWeight: '700' }} />
          <TextWidget text="KCAL LEFT" style={{ color: '#FF6542', fontSize: 8, fontWeight: '700', marginLeft: 4 }} />
        </FlexWidget>
        <FlexWidget style={{ backgroundColor: '#172033', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 3 }}>
          <TextWidget text={`${eaten.toLocaleString()} / ${goal.toLocaleString()} · ${pct}%`} maxLines={1} style={{ color: '#F7EEDC', fontSize: 8, fontWeight: '700' }} />
        </FlexWidget>
      </FlexWidget>
      <TextWidget text={`${steps.toLocaleString()} STEPS · ${meals} MEALS · ${burned.toLocaleString()} BURNED`} maxLines={1} style={{ color: '#7C756B', fontSize: 8, fontWeight: '700' }} />
      <FlexWidget style={{ width: 'match_parent', height: 3, flexDirection: 'row', backgroundColor: '#DED5C6', borderRadius: 2, marginTop: 3, overflow: 'hidden' }}>
        <FlexWidget style={{ flex: Math.max(4, pct), height: 3, backgroundColor: '#FF6542', borderRadius: 2 }} />
        <FlexWidget style={{ flex: Math.max(0, 100 - Math.max(4, pct)), height: 3 }} />
      </FlexWidget>
      {cashReality && <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', marginTop: 3, backgroundColor: '#EEE3CF', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, justifyContent: 'space-between' }}>
        <TextWidget text="TRUE SPENDABLE CASH" maxLines={1} style={{ color: '#172033', fontSize: 8, fontWeight: '700' }} />
        <TextWidget text={`${cashReality.trueSpendable < 0 ? '-' : ''}RM ${Math.abs(cashReality.trueSpendable).toFixed(0)}`} style={{ color: cashReality.trueSpendable < 0 ? '#D4422B' : '#477363', fontSize: 8, fontWeight: '700' }} />
      </FlexWidget>}
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'column', marginTop: 3 }}>
        {bottomMode === 'accounts' ? (accountRows.length ? accountRows.map((row, rowIndex) => <FlexWidget key={`account-row-${rowIndex}`} style={{ width: 'match_parent', flexDirection: 'row', marginBottom: 3 }}>
          {row.map((account, columnIndex) => <FlexWidget key={account.name} clickAction="OPEN_URI" clickActionData={{ uri: 'leanlog://redcoins?section=accounts' }} style={{ ...snapshotCell, backgroundColor: account.balance < 0 ? '#FFD8CF' : rowIndex === 0 && columnIndex === 0 ? '#D8EFE4' : '#E9E3D7', marginRight: columnIndex < row.length - 1 ? 3 : 0 }}>
            <TextWidget text={account.name.toUpperCase()} maxLines={1} style={{ color: '#172033', fontSize: 7, fontWeight: '700' }} />
            <TextWidget text={`${account.balance < 0 ? '−' : ''}RM ${Math.abs(account.balance).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} maxLines={1} style={{ color: account.balance < 0 ? '#B33421' : '#315F50', fontSize: 8, fontWeight: '700' }} />
          </FlexWidget>)}

        </FlexWidget>) : <TextWidget text="Choose accounts in widget settings" maxLines={1} style={{ color: '#172033', fontSize: 8, fontWeight: '700' }} />) : guardRows.length ? guardRows.map((row, rowIndex) => <FlexWidget key={`guard-row-${rowIndex}`} style={{ width: 'match_parent', flexDirection: 'row', marginBottom: 3 }}>
          {row.map((guard, columnIndex) => <FlexWidget key={guard.id} style={{ ...snapshotCell, backgroundColor: guard.percent >= 100 ? '#FFD8CF' : rowIndex === 0 && columnIndex === 0 ? '#D8EFE4' : '#E9E3D7', marginRight: columnIndex < row.length - 1 ? 3 : 0 }}>
            <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <FlexWidget style={{ flex: 1 }}><TextWidget text={guard.name.toUpperCase()} maxLines={1} style={{ color: '#172033', fontSize: 7, fontWeight: '700' }} /></FlexWidget>
              <TextWidget text={`${guard.percent.toFixed(0)}%`} style={{ color: guard.percent >= 100 ? '#B33421' : '#315F50', fontSize: 8, fontWeight: '700', marginLeft: 4 }} />
            </FlexWidget>
            <TextWidget text={`RM ${guard.spent.toFixed(0)} / ${guard.limit.toFixed(0)}`} maxLines={1} style={{ color: '#6D685F', fontSize: 7, fontWeight: '700' }} />
          </FlexWidget>)}

        </FlexWidget>) : <TextWidget text="No spending guards yet" maxLines={1} style={{ color: '#172033', fontSize: 8, fontWeight: '700' }} />}
      </FlexWidget>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', marginTop: 3 }}>
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'leanlog://redcoins/expense' }} style={{ width: 0, flex: 1, height: 24, justifyContent: 'center', backgroundColor: '#EF3F43', borderRadius: 6, alignItems: 'center', marginRight: 3 }}><TextWidget text="− EXPENSE" style={{ color: '#FFFFFF', fontSize: 7, fontWeight: '700' }} /></FlexWidget>
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'leanlog://redcoins/income' }} style={{ width: 0, flex: 1, height: 24, justifyContent: 'center', backgroundColor: '#379B73', borderRadius: 6, alignItems: 'center', marginRight: 3 }}><TextWidget text="+ INCOME" style={{ color: '#FFFFFF', fontSize: 7, fontWeight: '700' }} /></FlexWidget>
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'leanlog://redcoins/transfer' }} style={{ width: 0, flex: 1, height: 24, justifyContent: 'center', backgroundColor: '#528FF2', borderRadius: 6, alignItems: 'center' }}><TextWidget text="⇄ TRANSFER" style={{ color: '#FFFFFF', fontSize: 7, fontWeight: '700' }} /></FlexWidget>
      </FlexWidget>
    </FlexWidget>
  ), themeId) as React.JSX.Element;
}
