import React from 'react';
import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { LeanLogWidget } from '../widgets/LeanLogWidget';
import { getWidgetData } from '../widgets/widget-data';
import { AccountSnapshotWidget, AutomationWidget, CashRealityWidget, QuickLogWidget } from '../widgets/RedCoinsWidgets';
import { getAccountWidgetData, getAutomationWidgetData, getCashWidgetData, widgetUpdatedTime } from '../widgets/redcoins-widget-data';
import { getWidgetTheme } from '../widgets/widget-theme';

export async function refreshLeanLogWidget() {
  if (Platform.OS !== 'android') return;
  await requestWidgetUpdate({
    widgetName: 'LeanLogDaily',
    renderWidget: async (widgetInfo) => <LeanLogWidget {...await getWidgetData(widgetInfo.widgetId)} />,
  }).catch(() => {});
  await requestWidgetUpdate({ widgetName: 'LeanLogAccount', renderWidget: async (widgetInfo) => <AccountSnapshotWidget account={await getAccountWidgetData(widgetInfo.widgetId)} updated={widgetUpdatedTime()} themeId={await getWidgetTheme()} /> }).catch(() => {});
  await requestWidgetUpdate({ widgetName: 'LeanLogCashReality', renderWidget: async () => <CashRealityWidget cash={await getCashWidgetData()} updated={widgetUpdatedTime()} themeId={await getWidgetTheme()} /> }).catch(() => {});
  await requestWidgetUpdate({ widgetName: 'LeanLogQuickLog', renderWidget: async () => <QuickLogWidget themeId={await getWidgetTheme()} /> }).catch(() => {});
  await requestWidgetUpdate({ widgetName: 'LeanLogAutomation', renderWidget: async () => <AutomationWidget rows={await getAutomationWidgetData()} updated={widgetUpdatedTime()} themeId={await getWidgetTheme()} /> }).catch(() => {});
}
