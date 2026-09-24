import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { LeanLogWidget } from './LeanLogWidget';
import { getWidgetData } from './widget-data';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  if (props.widgetInfo.widgetName !== 'LeanLogDaily') return;
  if (['WIDGET_ADDED', 'WIDGET_UPDATE', 'WIDGET_RESIZED'].includes(props.widgetAction)) {
    const data = await getWidgetData();
    props.renderWidget(<LeanLogWidget {...data} />);
  }
}
