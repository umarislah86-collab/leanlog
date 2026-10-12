'use no memo';
import React from 'react';
import { FlexWidget, OverlapWidget, SvgWidget } from 'react-native-android-widget';
import type { AppThemeId } from '../services/appTheme';
import { contrastText } from '../services/textContrast';
import { themeArtwork, type ArtworkPlace } from '../services/themeArtwork';

/** FrameLayout draws the motif behind content without consuming a row or intercepting actions. */
export function widgetWatermark(content: React.JSX.Element, id: AppThemeId, onHero = false, compact = false, artwork: ArtworkPlace = 'widget') {
  const motif = themeArtwork(id, artwork, onHero);
  const height = compact ? 42 : 76;
  // SVG alpha works in headless Android rendering; native widget styles have no opacity prop.
  const svg = motif.svg.replace(/(<svg\b[^>]*>)/, '$1<g opacity="0.075">').replace('</svg>', '</g></svg>');
  const style = content.props.style;
  const ink = motif.svg.match(/#[0-9a-fA-F]{6}/)![0];
  const rgb = (hex: string) => hex.slice(1).match(/../g)!.map(x => parseInt(x, 16));
  const base = rgb(style.backgroundColor), top = rgb(ink);
  const painted = '#' + base.map((x, i) => Math.round(x * .925 + top[i] * .075).toString(16).padStart(2, '0')).join('');
  function readable(node: React.ReactNode, background: string): React.ReactNode {
    if (Array.isArray(node)) return node.map(child => readable(child, background));
    if (!React.isValidElement<{ style?: Record<string, any>; text?: string; children?: React.ReactNode }>(node)) return node;
    const nodeStyle = node.props.style ?? {};
    const bg = nodeStyle.backgroundColor ?? background;
    return React.cloneElement(node, { style: node.props.text && nodeStyle.color ? { ...nodeStyle, color: contrastText(nodeStyle.color, bg) } : nodeStyle, children: readable(node.props.children, bg) });
  }
  const { backgroundColor, ...foreground } = style;
  return <OverlapWidget style={{ width: 'match_parent', height: 'match_parent', backgroundColor, borderRadius: style.borderRadius, overflow: 'hidden' }}>
    <FlexWidget style={{ width: 'match_parent', height: 'match_parent', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', paddingRight: 10 }}>
      <SvgWidget svg={svg} style={{ width: Math.round(height * motif.ratio), height }}/>
    </FlexWidget>
    {readable(React.cloneElement(content, { style: foreground }), painted)}
  </OverlapWidget>;
}
