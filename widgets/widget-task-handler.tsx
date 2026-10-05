import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { LeanLogWidget } from './LeanLogWidget';
import { getWidgetData } from './widget-data';
import { AccountSnapshotWidget, AutomationWidget, CashRealityWidget, QuickLogWidget } from './RedCoinsWidgets';
import { deleteWidgetAccount, getAccountWidgetData, getAutomationWidgetData, getCashWidgetData, widgetUpdatedTime } from './redcoins-widget-data';
import { deleteDailyWidgetPreferences } from './daily-widget-preferences';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const { widgetName, widgetId } = props.widgetInfo;
  if (props.widgetAction === 'WIDGET_DELETED') {
    if (widgetName === 'LeanLogAccount') await deleteWidgetAccount(widgetId);
    if (widgetName === 'LeanLogDaily') await deleteDailyWidgetPreferences(widgetId);
    return;
  }
  if (!['WIDGET_ADDED', 'WIDGET_UPDATE', 'WIDGET_RESIZED'].includes(props.widgetAction)) return;
  if (widgetName === 'LeanLogDaily') {
    const data = await getWidgetData(widgetId);
    props.renderWidget(<LeanLogWidget {...data} />);
    return;
  }
  if (widgetName === 'LeanLogAccount') return props.renderWidget(<AccountSnapshotWidget account={await getAccountWidgetData(widgetId)} updated={widgetUpdatedTime()} />);
  if (widgetName === 'LeanLogCashReality') return props.renderWidget(<CashRealityWidget cash={await getCashWidgetData()} updated={widgetUpdatedTime()} />);
  if (widgetName === 'LeanLogQuickLog') return props.renderWidget(<QuickLogWidget />);
  if (widgetName === 'LeanLogAutomation') return props.renderWidget(<AutomationWidget rows={await getAutomationWidgetData()} updated={widgetUpdatedTime()} />);
}
