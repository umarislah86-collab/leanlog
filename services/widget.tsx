import React from 'react';
import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { LeanLogWidget } from '../widgets/LeanLogWidget';
import { getWidgetData } from '../widgets/widget-data';
import { AccountSnapshotWidget, AutomationWidget, CashRealityWidget, QuickLogWidget } from '../widgets/RedCoinsWidgets';
import { getAccountWidgetData, getAutomationWidgetData, getCashWidgetData, widgetUpdatedTime } from '../widgets/redcoins-widget-data';

export async function refreshLeanLogWidget() {
  if (Platform.OS !== 'android') return;
  const data = await getWidgetData();
  await requestWidgetUpdate({
    widgetName: 'LeanLogDaily',
    renderWidget: () => <LeanLogWidget {...data} />,
  }).catch(() => {});
  await requestWidgetUpdate({ widgetName: 'LeanLogAccount', renderWidget: async (widgetInfo) => <AccountSnapshotWidget account={await getAccountWidgetData(widgetInfo.widgetId)} updated={widgetUpdatedTime()} /> }).catch(() => {});
  await requestWidgetUpdate({ widgetName: 'LeanLogCashReality', renderWidget: async () => <CashRealityWidget cash={await getCashWidgetData()} updated={widgetUpdatedTime()} /> }).catch(() => {});
  await requestWidgetUpdate({ widgetName: 'LeanLogQuickLog', renderWidget: () => <QuickLogWidget /> }).catch(() => {});
  await requestWidgetUpdate({ widgetName: 'LeanLogAutomation', renderWidget: async () => <AutomationWidget rows={await getAutomationWidgetData()} updated={widgetUpdatedTime()} /> }).catch(() => {});
}
