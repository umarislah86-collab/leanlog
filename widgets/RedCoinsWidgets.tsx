'use no memo';
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

const money = (value = 0) => `${value < 0 ? '−' : ''}RM ${Math.abs(value).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const shell = { height: 'match_parent', width: 'match_parent', flexDirection: 'column', backgroundColor: '#F7EEDC', borderRadius: 22, padding: 12 } as const;

export type WidgetAccount = { name: string; type: string; balance: number };
export function AccountSnapshotWidget({ account, updated }: { account: WidgetAccount | null; updated: string }) {
  return <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'leanlog://redcoins?section=accounts' }} style={shell}>
    <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between' }}>
      <TextWidget text="REDCOINS / ACCOUNT" style={{ color: '#EF3F43', fontSize: 9, fontWeight: '700' }} />
      <TextWidget text={updated} style={{ color: '#7C756B', fontSize: 7, fontWeight: '700' }} />
    </FlexWidget>
    {account ? <>
      <TextWidget text={account.name} maxLines={1} style={{ color: '#172033', fontSize: 15, fontWeight: '700', marginTop: 10 }} />
      <TextWidget text={money(account.balance)} maxLines={1} style={{ color: account.balance < 0 ? '#D4422B' : '#315F50', fontSize: 25, fontWeight: '700', marginTop: 3 }} />
      <TextWidget text={`${account.type.toUpperCase()} · TAP TO VIEW ACCOUNTS`} maxLines={1} style={{ color: '#7C756B', fontSize: 7, fontWeight: '700', marginTop: 7 }} />
    </> : <TextWidget text="Choose an account while adding this widget." style={{ color: '#172033', fontSize: 11, fontWeight: '700', marginTop: 14 }} />}
  </FlexWidget>;
}

export type CashWidgetData = { trueSpendable: number; liquidBalance: number; cardOutstanding: number; safetyBuffer?: number } | null;
export function CashRealityWidget({ cash, updated }: { cash: CashWidgetData; updated: string }) {
  return <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'leanlog://redcoins?section=plan' }} style={{ ...shell, backgroundColor: '#172033' }}>
    <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between' }}><TextWidget text="REDCOINS / CASH REALITY" style={{ color: '#91DCBB', fontSize: 9, fontWeight: '700' }} /><TextWidget text={updated} style={{ color: '#98A0AD', fontSize: 7 }} /></FlexWidget>
    <TextWidget text={cash ? money(cash.trueSpendable) : 'NO CASH DATA'} maxLines={1} style={{ color: cash && cash.trueSpendable < 0 ? '#FF8069' : '#FFF4DB', fontSize: 25, fontWeight: '700', marginTop: 7 }} />
    <TextWidget text="TRUE SPENDABLE NOW" style={{ color: '#91DCBB', fontSize: 8, fontWeight: '700', marginTop: 2 }} />
    {cash && <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', marginTop: 8 }}>
      <FlexWidget style={{ flex: 1, backgroundColor: '#26334A', borderRadius: 9, padding: 6, marginRight: 4 }}><TextWidget text={money(cash.liquidBalance)} maxLines={1} style={{ color: '#FFF4DB', fontSize: 8, fontWeight: '700' }} /><TextWidget text="SELECTED CASH" style={{ color: '#98A0AD', fontSize: 6 }} /></FlexWidget>
      <FlexWidget style={{ flex: 1, backgroundColor: '#26334A', borderRadius: 9, padding: 6 }}><TextWidget text={money(-Math.abs(cash.cardOutstanding))} maxLines={1} style={{ color: '#FF8069', fontSize: 8, fontWeight: '700' }} /><TextWidget text="CARD OWED" style={{ color: '#98A0AD', fontSize: 6 }} /></FlexWidget>
    </FlexWidget>}
  </FlexWidget>;
}

export function QuickLogWidget() {
  const button = { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' as const };
  return <FlexWidget style={shell}>
    <TextWidget text="LEANLOG / QUICK LOG" style={{ color: '#172033', fontSize: 10, fontWeight: '700' }} />
    <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', marginTop: 10 }}>
      <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'leanlog://quick/food' }} style={{ ...button, backgroundColor: '#172033', marginRight: 5 }}><TextWidget text="FOOD" style={{ color: '#FFF4DB', fontSize: 9, fontWeight: '700' }} /></FlexWidget>
      <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'leanlog://redcoins/expense' }} style={{ ...button, backgroundColor: '#EF3F43', marginRight: 5 }}><TextWidget text="EXPENSE" style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '700' }} /></FlexWidget>
      <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'leanlog://redcoins/income' }} style={{ ...button, backgroundColor: '#83D8B4', marginRight: 5 }}><TextWidget text="INCOME" style={{ color: '#172033', fontSize: 9, fontWeight: '700' }} /></FlexWidget>
      <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'leanlog://redcoins/transfer' }} style={{ ...button, backgroundColor: '#528FF2' }}><TextWidget text="TRANSFER" style={{ color: '#FFFFFF', fontSize: 8, fontWeight: '700' }} /></FlexWidget>
    </FlexWidget>
  </FlexWidget>;
}

export type AutomationWidgetRow = { id: string; item: string; amount: number; due: string; automatic: boolean };
export function AutomationWidget({ rows, updated }: { rows: AutomationWidgetRow[]; updated: string }) {
  return <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'leanlog://redcoins?section=plan' }} style={shell}>
    <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between' }}><TextWidget text="REDCOINS / UPCOMING" style={{ color: '#EF3F43', fontSize: 9, fontWeight: '700' }} /><TextWidget text={updated} style={{ color: '#7C756B', fontSize: 7 }} /></FlexWidget>
    {rows.length ? rows.slice(0, 2).map((row) => <FlexWidget key={row.id} style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEE3CF', borderRadius: 11, padding: 8, marginTop: 7 }}>
      <FlexWidget style={{ flex: 1 }}><TextWidget text={row.item} maxLines={1} style={{ color: '#172033', fontSize: 10, fontWeight: '700' }} /><TextWidget text={`${row.automatic ? 'AUTO-LOG' : 'REMINDER'} · ${row.due}`} maxLines={1} style={{ color: '#7C756B', fontSize: 6, marginTop: 2 }} /></FlexWidget>
      <TextWidget text={money(row.amount)} style={{ color: '#D4422B', fontSize: 9, fontWeight: '700' }} />
    </FlexWidget>) : <TextWidget text="Nothing scheduled yet." style={{ color: '#172033', fontSize: 11, fontWeight: '700', marginTop: 15 }} />}
  </FlexWidget>;
}
