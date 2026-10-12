/** Resolve solid/alpha React Native colours against their actual parent surface. */
export function solidColour(value: unknown, parent = '#FFFFFF'): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (v === 'transparent') return parent;
  if (v === 'white') return '#FFFFFF';
  if (v === 'black') return '#000000';
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  let rgb: number[], alpha = 1;
  if (hex) {
    let h = hex[1]; if (h.length <= 4) h = [...h].map(c => c + c).join('');
    rgb = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
    if (h.length === 8) alpha = parseInt(h.slice(6), 16) / 255;
  } else {
    const match = v.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
    if (!match) return null;
    rgb = match.slice(1, 4).map(Number); alpha = match[4] === undefined ? 1 : Number(match[4]);
  }
  const under = parent.slice(1).match(/../g)?.map(c => parseInt(c, 16));
  if (!under || under.length !== 3) return null;
  return '#' + rgb.map((c, i) => Math.round(c * alpha + under[i] * (1 - alpha)).toString(16).padStart(2, '0')).join('').toUpperCase();
}
export function textContrast(a: string, b: string) {
  const lum = (hex: string) => { const rgb = hex.slice(1).match(/../g)!.map(c => parseInt(c, 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4); return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722; };
  const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
export function artworkBackgrounds(background: string, alpha = .30) {
  return [background, solidColour(`rgba(0,0,0,${alpha})`,background)!, solidColour(`rgba(255,255,255,${alpha})`,background)!];
}
/** Keep the same ink readable on both bare card and all possible image pixels. */
export function contrastTextOnSurfaces(value: unknown, backgrounds: string[]): string | undefined {
  if (!backgrounds.length) return undefined;
  const colour=solidColour(value,backgrounds[0]);if(!colour)return undefined;
  const score=(ink:string)=>Math.min(...backgrounds.map(bg=>textContrast(ink,bg)));
  if(score(colour)>=4.5)return value as string;
  const rgb=colour.slice(1).match(/../g)!.map(c=>parseInt(c,16));
  const target=score('#000000')>=score('#FFFFFF')?0:255;
  for(let step=1;step<=100;step++){
    const ink='#'+rgb.map(c=>Math.round(c+(target-c)*step/100).toString(16).padStart(2,'0')).join('');
    if(score(ink)>=4.5)return ink;
  }
  return target===0?'#000000':'#FFFFFF';
}
/** Preserve readable semantic colours; adjust lightness only when contrast fails. */
export function contrastText(value: unknown, background: string): string | undefined {
  const colour = solidColour(value, background);
  if (!colour) return undefined;
  if (textContrast(colour, background) >= 4.5) return value as string;
  const target = textContrast('#000000', background) >= textContrast('#FFFFFF', background) ? 0 : 255;
  const rgb = colour.slice(1).match(/../g)!.map(c => parseInt(c, 16));
  for (let step = 1; step <= 100; step++) {
    const adjusted = '#' + rgb.map(c => Math.round(c + (target - c) * step / 100).toString(16).padStart(2, '0')).join('').toUpperCase();
    if (textContrast(adjusted, background) >= 4.5) return adjusted;
  }
  return target === 0 ? '#000000' : '#FFFFFF';
}
