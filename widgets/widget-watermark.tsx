import { nativeArtwork } from '../services/nativeArtwork';
'use no memo';
import React from 'react';
import { FlexWidget, OverlapWidget, SvgWidget, ImageWidget } from 'react-native-android-widget';
import type { AppThemeId } from '../services/appTheme';
import { contrastText, textContrast } from '../services/textContrast';
import { themeArtwork, type ArtworkPlace } from '../services/themeArtwork';

/** FrameLayout draws the motif behind content without consuming a row or intercepting actions. */
export function widgetWatermark(content: React.JSX.Element, id: AppThemeId, onHero = false, compact = false, artwork: ArtworkPlace = 'widget') {
  const bitmap = nativeArtwork(id, artwork);
  const motif = themeArtwork(id, artwork, onHero);
  const height = compact ? 90 : 150;
  // SVG alpha works in headless Android rendering; native widget styles have no opacity prop.
  const svg = motif.svg.replace(/(<svg\b[^>]*>)/, '$1<g opacity="0.24">').replace('</svg>', '</g></svg>');
  const style = content.props.style;
  const ink = motif.svg.match(/#[0-9a-fA-F]{6}/)![0];
  const rgb = (hex: string) => hex.slice(1).match(/../g)!.map(x => parseInt(x, 16));
  const base = rgb(style.backgroundColor), top = rgb(ink);
  const raster = 'raster' in motif;
  const composite = (top:number) => '#' + base.map(x=>Math.round(x*.76+top*.24).toString(16).padStart(2,'0')).join('');
  const rasterBackgrounds = [style.backgroundColor,composite(0),composite(255)];
  const painted = '#' + base.map((x, i) => Math.round(x * .76 + top[i] * .24).toString(16).padStart(2, '0')).join('');
  function readable(node: React.ReactNode, background: string, plain: string): React.ReactNode {
    if (Array.isArray(node)) return node.map(child => readable(child, background, plain));
    if (!React.isValidElement<{ style?: Record<string, any>; text?: string; children?: React.ReactNode }>(node)) return node;
    const nodeStyle = node.props.style ?? {};
    const bg = nodeStyle.backgroundColor ?? background;
    const baseBg = nodeStyle.backgroundColor ?? plain;
    const colour = nodeStyle.color;
    const rasterInk = raster && colour && !nodeStyle.backgroundColor && baseBg===style.backgroundColor ? [colour,'#FFFFFF','#000000'].sort((a,b)=>Math.min(...rasterBackgrounds.map(bg=>textContrast(b,bg)))-Math.min(...rasterBackgrounds.map(bg=>textContrast(a,bg))))[0] : null;
    const worst = colour && textContrast(colour, baseBg) < textContrast(colour, bg) ? baseBg : bg;
    return React.cloneElement(node, { style: node.props.text && nodeStyle.color ? { ...nodeStyle, color: rasterInk || contrastText(nodeStyle.color, worst) } : nodeStyle, children: readable(node.props.children, bg, baseBg) });
  }
  const { backgroundColor, ...foreground } = style;
  return <OverlapWidget style={{ width: 'match_parent', height: 'match_parent', backgroundColor, borderRadius: style.borderRadius, overflow: 'hidden' }}>
    <FlexWidget style={{ width: 'match_parent', height: 'match_parent', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'flex-start', paddingRight: 8 }}>
      {bitmap ? <ImageWidget image={bitmap.widget} imageWidth={320} imageHeight={320} resizeMode="contain" style={{width:height,height,marginTop:compact?-16:-20}}/> : <SvgWidget svg={svg} style={{ width: Math.round(height * motif.ratio), height, marginTop: compact ? -16 : id === 'arsenal' ? -44 : -20 }}/>}
    </FlexWidget>
    {readable(React.cloneElement(content, { style: foreground }), painted, backgroundColor)}
  </OverlapWidget>;
}
