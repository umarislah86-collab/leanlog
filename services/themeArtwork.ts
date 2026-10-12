import { appThemes, type AppThemeId } from './appTheme';
import { themeMotif } from './themeMotifs';

export type ArtworkPlace = 'home' | 'log' | 'progress' | 'coach' | 'drawer' | 'widget' | 'account' | 'cash' | 'quick' | 'upcoming';
import { cutieImages } from './cutieImageData';
import { characterImages } from './characterImageData';
const ornaments: Record<ArtworkPlace, string> = {
  account: '<path d="M6 14h52v39H6ZM6 22h52M45 36h13v9H45Z"/>',
  cash: '<path d="M6 12h52v40H6ZM11 17h5m32 0h5M11 47h5m32 0h5"/>',
  quick: '<path d="M7 6h14L13 20h9L7 37l4-15H3ZM47 50h13m-6-6v12"/>',
  upcoming: '<path d="M7 16h50v40H7ZM7 23h50M17 9v12M47 9v12M47 43v7h6"/>',
  home: '<path d="M6 54q7-5 13 0t13 0 13 0 13 0M6 59q7-5 13 0t13 0 13 0 13 0"/>',
  log: '<path d="M6 9v16m-3-16v8q3 6 6 0V9M6 25v22M58 9v38m0-38q-10 11 0 17"/>',
  progress: '<path d="M7 54V42m10 12V36m10 18V30M6 26l10-7 10 1 12-12m-8 0h8v8"/>',
  coach: '<path d="M17 57Q0 43 9 23M12 48l-7-2m5-8-7-5m10-4-5-6M47 57q17-14 8-34m-3 25 7-2m-5-8 7-5m-10-4 5-6"/>',
  drawer: '<path d="M6 58V23Q6 5 24 5h16q18 0 18 18v35M11 58h42M27 58v-5h10v5"/>',
  widget: '<path d="m7 7 8 0M7 7v8m50-8h-8m8 0v8M7 57h8m-8 0v-8m50 8h-8m8 0v-8"/>',
};

export function themeArtwork(id: AppThemeId, place: ArtworkPlace, onHero = false) {
  const motif = themeMotif(id, onHero);
  const colour = onHero ? appThemes[id].mint : appThemes[id].accent;
  if (id === 'cutie') {
    const places = {home:'pinkSky',log:'yummy',progress:'cheer',coach:'cool',drawer:'thumbsUp',widget:'wow',account:'sunshine',cash:'thumbsUp',quick:'yummy',upcoming:'cool'} as const;
    const name=places[place], image=cutieImages[name];
    const portrait=name==='sunshine'||name==='pinkSky';
    // Preserve sticker faces and their original outline; no redraw or stretching.
    const width=portrait?320:300, height=width*image.height/image.width;
    const y=portrait?0:(320-height)/2;
    return {name:`Cutie / ${name}`,ratio:1,raster:true,
      svg:`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="320" height="320" viewBox="0 0 320 320" color="${colour}" data-place="${place}"><defs><radialGradient id="cutieFade"><stop offset="0.76" stop-color="white"/><stop offset="1" stop-color="black"/></radialGradient><mask id="cutiePortrait"><rect width="320" height="320" fill="url(#cutieFade)"/></mask></defs><g${portrait?' mask="url(#cutiePortrait)"':''}><svg x="${(320-width)/2}" y="${y}" width="${width}" height="${height}" viewBox="0 0 ${image.width} ${image.height}"><defs><clipPath id="cutieOutline"><path d="${image.clip}"/></clipPath></defs><image width="${image.width}" height="${image.height}" xlink:href="${image.uri}"${portrait?'':' clip-path="url(#cutieOutline)"'}/></svg></g></svg>`};
  }
  const crew = id === 'grandline'
    ? {home:'luffy',log:'luffy',progress:'zoro',coach:'sanji',drawer:'chopper',widget:'zoro',account:'sanji',cash:'chopper',quick:'luffy',upcoming:'zoro'} as const
    : id === 'saiyan' ? {home:'goku',log:'goku',progress:'vegeta',coach:'piccolo',drawer:'gohan',widget:'vegeta',account:'piccolo',cash:'gohan',quick:'goku',upcoming:'vegeta'} as const : null;
  const character = crew?.[place];
  if (character) {
    const image=characterImages[character];
    // Frame the original upper body in SVG. Feather the portrait edge into the
    // page instead of putting a hard rectangular photograph behind the text.
    const crops:Record<keyof typeof characterImages,[number,number,number]>={
      luffy:[185,0,230],zoro:[190,0,250],sanji:[230,0,200],chopper:[130,0,390],
      goku:[140,0,340],vegeta:[85,0,330],piccolo:[100,0,390],gohan:[100,0,380],
    };
    const [x,y,w]=crops[character];
    const shift=place==='widget'||place==='quick'?14:place==='drawer'?6:0;
    return {name:character,ratio:1,raster:true,
      svg:`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="320" height="320" viewBox="0 0 320 320" color="${colour}" data-place="${place}"><defs><radialGradient id="fade"><stop offset="0.68" stop-color="white"/><stop offset="1" stop-color="black"/></radialGradient><mask id="portrait"><rect width="320" height="320" fill="url(#fade)"/></mask></defs><g mask="url(#portrait)"><svg x="0" y="0" width="320" height="320" viewBox="${x+shift} ${y} ${w} ${w}"><image width="${image.width}" height="${image.height}" xlink:href="${image.uri}"/></svg></g></svg>`};
  }
  // Each surface gets a different composition while retaining the theme's central identity.
  const inner = motif.svg.replace(/^[\s\S]*?<svg\b[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '');
  const width = id === 'arsenal' ? 315 : id === 'liverpool' ? 34 : 64;
  const height = id === 'arsenal' ? 120 : id === 'liverpool' ? 61 : 64;
  const scale = Math.min(56 / width, 56 / height);
  const x = (64 - width * scale) / 2, y = (64 - height * scale) / 2;
  return { name: `${motif.name} / ${place}`, ratio: 1,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><g transform="translate(${x} ${y}) scale(${scale})">${inner}</g><g fill="none" stroke="${colour}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ornaments[place]}</g></svg>`,
  };
}
