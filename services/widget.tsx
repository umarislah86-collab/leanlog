import React from 'react';
import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { LeanLogWidget } from '../widgets/LeanLogWidget';
import { getWidgetData } from '../widgets/widget-data';

export async function refreshLeanLogWidget() {
  if (Platform.OS !== 'android') return;
  const data = await getWidgetData();
  await requestWidgetUpdate({
    widgetName: 'LeanLogDaily',
    renderWidget: () => <LeanLogWidget {...data} />,
  }).catch(() => {});
}
