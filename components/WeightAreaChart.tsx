import React, { useState } from 'react';
import { View } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import type { WeightEntry } from '../types';

interface Props {
  entries: WeightEntry[];
}

const CHART_H = 130;
const PAD_TOP = 10;
const PAD_BOTTOM = 16;
const PAD_H = 12;

const parseDateKey = (key: string): number => {
  const p = key.split('/');
  if (p.length !== 3) return 0;
  return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0])).getTime();
};

export default function WeightAreaChart({ entries }: Props) {
  const [canvasW, setCanvasW] = useState(0);

  const sorted = [...entries].sort((a, b) => parseDateKey(a.date) - parseDateKey(b.date));

  if (sorted.length < 2) return null;

  const drawW = canvasW - PAD_H * 2;
  const drawH = CHART_H - PAD_TOP - PAD_BOTTOM;

  const vals = sorted.map(w => w.weight);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const padV = Math.max((maxV - minV) * 0.25, 0.3);
  const lo = minV - padV;
  const hi = maxV + padV;
  const range = hi - lo;

  const times = sorted.map(w => parseDateKey(w.date));
  const minT = times[0];
  const maxT = times[times.length - 1];
  const timeRange = maxT - minT || 1;

  const toX = (t: number) => PAD_H + ((t - minT) / timeRange) * drawW;
  const toY = (v: number) => PAD_TOP + (1 - (v - lo) / range) * drawH;

  const pts = sorted.map((w, i) => ({ x: toX(times[i]), y: toY(w.weight) }));

  let linePath = `M ${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const curr = pts[i];
    const next = pts[i + 1];
    const dx = (next.x - curr.x) * 0.4;
    const cp1x = curr.x + dx;
    const cp2x = next.x - dx;
    linePath += ` C ${cp1x.toFixed(2)},${curr.y.toFixed(2)} ${cp2x.toFixed(2)},${next.y.toFixed(2)} ${next.x.toFixed(2)},${next.y.toFixed(2)}`;
  }

  const bottomY = PAD_TOP + drawH;
  const areaPath =
    linePath +
    ` L ${pts[pts.length - 1].x.toFixed(2)},${bottomY}` +
    ` L ${pts[0].x.toFixed(2)},${bottomY} Z`;

  return (
    <View
      style={{ height: CHART_H, marginTop: 10 }}
      onLayout={e => setCanvasW(e.nativeEvent.layout.width)}
    >
      {canvasW > 0 && (
        <Svg width={canvasW} height={CHART_H}>
          <Defs>
            <LinearGradient
              id="wGrad"
              x1="0" y1={String(PAD_TOP)}
              x2="0" y2={String(bottomY)}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor="#FF6542" stopOpacity="0.4" />
              <Stop offset="1" stopColor="#FF6542" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Path d={areaPath} fill="url(#wGrad)" />
          <Path d={linePath} fill="none" stroke="#FF6542" strokeWidth={2} />
          {[pts[0], pts[pts.length - 1]].map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill="#FF6542" />
          ))}
        </Svg>
      )}
    </View>
  );
}
