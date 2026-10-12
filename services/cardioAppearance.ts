import type { AppPalette } from './appTheme';
export function colourContrast(a:string,b:string) {
  const luminance=(hex:string)=>{const rgb=hex.replace('#','').match(/../g)!.map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
  const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
/** Resolve text for a specific filled surface, without changing its identity colour. */
export function readableTextOn(background:string,preferred='#101A2B') {
  if(colourContrast(background,preferred)>=4.5)return preferred;
  return colourContrast(background,'#FFFFFF')>=colourContrast(background,'#000000')?'#FFFFFF':'#000000';
}
export function cardioAppearance(p:AppPalette) {
  const accentInk=readableTextOn(p.mint);
  const eyebrow=colourContrast(p.accent,p.surface)>=4.5?p.accent:p.text;
  return {
    safe:{backgroundColor:p.canvas},launcher:{backgroundColor:p.surface,borderColor:p.border},launchIcon:{backgroundColor:p.mint},launchTitle:{color:p.text},
    title:{color:p.text},eyebrow:{color:eyebrow},close:{borderColor:p.border},card:{backgroundColor:p.surface,borderColor:p.border},
    mode:{backgroundColor:p.surface,borderColor:p.border},modeOn:{backgroundColor:p.mint,borderColor:p.mint},modeText:{color:p.text},
    segment:{backgroundColor:p.surfaceAlt},segmentOn:{backgroundColor:p.surface},toggleTitle:{color:p.text},hint:{color:p.muted},fieldLabel:{color:p.muted},input:{backgroundColor:p.surfaceAlt,color:p.text},
    hero:{backgroundColor:p.hero},heroLabel:{color:p.mint},heroBadge:{color:p.onHero},timer:{color:p.onHero},heroHint:{color:p.heroMuted},heroNumber:{color:p.onHero},
    progressTrack:{backgroundColor:p.heroRaised},progressFill:{backgroundColor:p.mint},goalText:{color:p.mint},phaseCard:{backgroundColor:p.mint},phaseName:{color:accentInk},phaseTime:{color:accentInk},
    stat:{color:p.text},primary:{backgroundColor:p.mint},primaryText:{color:accentInk},secondary:{borderColor:p.border},secondaryText:{color:p.text},notice:{color:p.text},saved:{color:p.text},preset:{borderBottomColor:p.border},
  };
}
