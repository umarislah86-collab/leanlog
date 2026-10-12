import { appThemes, type AppThemeId } from './appTheme';
import { themeMotif } from './themeMotifs';

export type ArtworkPlace = 'home' | 'log' | 'progress' | 'coach' | 'drawer' | 'widget' | 'account' | 'cash' | 'quick' | 'upcoming';
// Original line-art interpretations, bundled offline. No raster downloads or SVG fonts.
const portraits = {
  luffy: '<path d="M9 26Q32 18 55 26L57 30Q32 38 7 30ZM17 24Q17 5 32 7Q47 5 47 24M18 19Q32 15 46 19M16 33l2 12 8 9h12l8-9 2-12M17 33l5 8-1-10 7 8 4-8 8 8 3-9 5 5M22 42h5m10 0h5M25 47q7 8 14 0ZM38 44l5 2m-2-4v6M11 61l10-9 11 8 11-8 10 9"/>',
  zoro: '<path d="M16 27 13 19l8 1-1-9 9 5 4-10 5 11 9-5-1 10 7 1-7 9M17 27q15-8 30 0l-2 18-9 10h-9L18 45ZM20 35l8-2m8 0 7 2M39 29l-2 14M24 45h17M42 43l13-4m-11 7 12-3M18 38l-4 2m1 0v5m-2-4v5m4-5v5M7 61l17-10 8 9 9-9 16 10M6 5l9 12m-8-2 8-6M3 12l10 10"/>',
  sanji: '<path d="M17 39Q7 11 29 9Q52 3 49 29L32 40l1-17q-5 13-17 16ZM17 38l3 10 12 8 12-9 2-15M21 36q7-6 8 0q-4 4-5 0M22 41h6m8 6 7-2 10 2m-2-3 6 2M30 50l3 2M8 62l14-11 10 9 10-10 14 12M25 55l-3 7m17-7 3 7M31 59v4M54 41q-4-4 0-8"/>',
  goku: '<path d="m15 31-9-7 11-2-7-10 15 4 1-13 9 12L45 4l-2 14 14-4-8 12 9 3-10 8M17 28l7 8 7-12 8 11 8-8M17 35l3 12 12 9 12-9 3-12M22 39l7 1m7 0 6-1M29 48l6 1M8 63l14-11 10 9 10-9 14 11M18 56l5 7m18-7-5 7"/>',
  vegeta: '<path d="M16 33 10 8l11 9L27 2l6 18 8-16 1 17 12-10-7 25M17 29l8-8 7 14 8-14 8 8-3 18-13 9-12-9ZM21 39l7 3m8 0 7-3M28 48h9M7 63l15-10 10 7 10-7 15 10M19 55v8m26-8v8M24 59h16"/>',
  piccolo: '<path d="M17 25Q18 10 32 10Q46 10 47 25L44 47 32 56 20 47ZM26 16l-3-9-5-4m20 13 3-9 5-4M17 29 5 21l11 21m31-13 12-8-11 21M21 32l8 5m6 0 8-5M22 39h6m9 0h6M27 48h11M7 63l8-15 17 12 17-12 8 15M18 52l-1 11m30-11 1 11"/>',
  chopper: '<path d="M16 27V17Q32 7 48 17v10M10 27h44v8H10ZM27 17l10 7m0-7-10 7M15 18 7 14 5 6m2 8 5-5m37 9 8-4 2-8m-2 8-5-5M17 35l2 14 13 8 13-8 2-14M22 42h4m12 0h4M29 47h6l-3 3ZM24 53l-3 9m19-9 3 9"/>',
  shenron: '<path d="M14 53q-12-16 5-22t27-8q11-15-4-15Q26 6 32 17q4 5 9 0M14 53q12 10 28 0t-5-14q-17 2-16 11M32 17l-9 2 3 8 13 2 9-9-7-3M24 19l-9-8m10 11-12 1m29-10 7-9m-4 13 13-4M28 19l4 2m7 0 4-2M19 32l-5-7m28 11 9 5M31 44l-6-8M23 52l-8 7m28-8 8 6"/>',
};
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
  const crew: Partial<Record<ArtworkPlace, keyof typeof portraits>> = id === 'grandline'
    ? { log: 'luffy', progress: 'zoro', coach: 'sanji', drawer: 'chopper' }
    : id === 'saiyan' ? { log: 'goku', progress: 'vegeta', coach: 'piccolo', drawer: 'shenron' } : {};
  const character = crew[place];
  if (character) return {
    name: character, ratio: 1,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><g fill="none" stroke="${colour}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${portraits[character]}</g></svg>`,
  };
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
