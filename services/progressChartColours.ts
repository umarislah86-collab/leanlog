import type { AppPalette } from './appTheme';
import { textContrast } from './textContrast';
/** Graphical marks need 3:1 against the actual chart card, not the page canvas. */
export function progressChartInk(p:AppPalette, background:string) {
  return [p.accent,p.mint,p.onHero,p.text,'#FFFFFF','#000000'].find(c=>textContrast(c,background)>=3)!;
}
