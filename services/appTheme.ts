/** App appearance only. Finance meaning, chart series, PDFs and widgets stay independent. */
export const APP_THEME_KEY = 'leanlog_appearance_v1';
export type AppThemeId = 'cream' | 'midnight' | 'neutral' | 'grove' | 'dusk' | 'folio' | 'onyx' | 'cyberpunk' | 'arabia' | 'arsenal' | 'liverpool' | 'grandline' | 'saiyan';
export const appThemes = {
  cream: { id: 'cream', name: 'Original / Cream', description: 'Warm paper, navy and the original LeanLog accents.', dark: false, canvas: '#FFF9ED', surface: '#FFFDF7', surfaceAlt: '#F3EAD7', hero: '#101A2B', heroRaised: '#26334A', text: '#101722', muted: '#697180', onHero: '#FFFDF7', heroMuted: '#AAB5C7', border: '#DED5C5', accent: '#FF6542', mint: '#8FD6B4', mintTint: '#DDF1E7', coralTint: '#FFE6DC', blueTint: '#E8E8FF', warningTint: '#F2E7CB', expense: '#EF3F43', income: '#168A65', transfer: '#528FF2' },
  midnight: { id: 'midnight', name: 'Midnight', description: 'Layered navy, soft mint and coral. Made for low light.', dark: true, canvas: '#0B1220', surface: '#142033', surfaceAlt: '#1C2B41', hero: '#101A2B', heroRaised: '#23334C', text: '#F3F1EB', muted: '#A9B5C7', onHero: '#FFFDF7', heroMuted: '#B3BFD0', border: '#34455E', accent: '#FF856B', mint: '#8FD6B4', mintTint: '#183A35', coralTint: '#452B2B', blueTint: '#282F52', warningTint: '#3A3223', expense: '#FF8383', income: '#6CD5AF', transfer: '#8BB6FF' },
  neutral: { id: 'neutral', name: 'Soft Neutral', description: 'Off-white, charcoal and understated everyday surfaces.', dark: false, canvas: '#F4F5F3', surface: '#FFFFFF', surfaceAlt: '#E9ECE8', hero: '#222C35', heroRaised: '#35414B', text: '#202A32', muted: '#606C75', onHero: '#F9FAF7', heroMuted: '#B9C4CA', border: '#D2D9D5', accent: '#B9442F', mint: '#8FD6B4', mintTint: '#E0EDE6', coralTint: '#F4E2DB', blueTint: '#E5E9F4', warningTint: '#F0E9D8', expense: '#EF3F43', income: '#168A65', transfer: '#528FF2' },
  grove: { id: 'grove', name: 'Grove', description: 'Quiet sage paper. Lora headlines with Manrope body.', dark: false, canvas: '#F1F4EB', surface: '#FAFCF6', surfaceAlt: '#E3E9DA', hero: '#203A32', heroRaised: '#345047', text: '#20342C', muted: '#566451', onHero: '#FAFCF6', heroMuted: '#BECCC1', border: '#CDD7C5', accent: '#38604C', mint: '#A8D8B7', mintTint: '#DEEDDF', coralTint: '#F4E1D9', blueTint: '#E2E8F2', warningTint: '#EEE5CC', expense: '#EF3F43', income: '#168A65', transfer: '#528FF2' },
  dusk: { id: 'dusk', name: 'Dusk / Studio', description: 'Plum-black, lilac light. Space Grotesk throughout.', dark: true, canvas: '#17131E', surface: '#241F2D', surfaceAlt: '#302939', hero: '#211B2B', heroRaised: '#3A3046', text: '#F5EFF8', muted: '#BDB0C7', onHero: '#FCF7FF', heroMuted: '#C6B7D2', border: '#4D415B', accent: '#CEADF2', mint: '#A8D8CC', mintTint: '#243D37', coralTint: '#462D35', blueTint: '#30304D', warningTint: '#403625', expense: '#FF8383', income: '#6CD5AF', transfer: '#8BB6FF' },
  folio: { id: 'folio', name: 'Folio', description: 'Bookish ivory and oxblood. Lora with crisp Space Grotesk.', dark: false, canvas: '#F7EFE7', surface: '#FFFAF5', surfaceAlt: '#EBDFD3', hero: '#3B2328', heroRaised: '#54353C', text: '#39292B', muted: '#6B5855', onHero: '#FFF8EE', heroMuted: '#D1BDB7', border: '#D9C9BC', accent: '#813847', mint: '#C5D9B2', mintTint: '#E8EFDF', coralTint: '#F1DCD5', blueTint: '#E9E5F0', warningTint: '#EEE2C8', expense: '#EF3F43', income: '#168A65', transfer: '#528FF2' },
  onyx: { id: 'onyx', name: 'Onyx Gold', description: 'Charcoal black, warm gold accents and ivory text. Space Grotesk with Manrope.', dark: true, canvas: '#0E0E10', surface: '#1A1A1D', surfaceAlt: '#252528', hero: '#141416', heroRaised: '#29272A', text: '#F5F0E6', muted: '#BAB5AB', onHero: '#FFF8E8', heroMuted: '#C9C0B0', border: '#46423A', accent: '#DDBB68', mint: '#DDBB68', mintTint: '#332D1E', coralTint: '#40272A', blueTint: '#262E40', warningTint: '#37301E', expense: '#FF8383', income: '#6CD5AF', transfer: '#8BB6FF' },
  cyberpunk: { id: 'cyberpunk', name: 'Cyberpunk', description: 'Midnight charcoal, neon cyan and electric magenta. Space Grotesk throughout.', dark: true, canvas: '#090C18', surface: '#131A2B', surfaceAlt: '#1C2740', hero: '#0B1022', heroRaised: '#22314A', text: '#EDF9FF', muted: '#A7BED3', onHero: '#F1FBFF', heroMuted: '#ADC6DC', border: '#354768', accent: '#FF72D0', mint: '#57F0E1', mintTint: '#103B3B', coralTint: '#3F2340', blueTint: '#222B51', warningTint: '#3E3422', expense: '#FF8FA6', income: '#60E2AE', transfer: '#83BEFF' },
  arabia: { id: 'arabia', name: 'Arabia', description: 'Sandstone, deep emerald and warm brass. Lora headlines with Manrope body.', dark: false, canvas: '#F4E9D6', surface: '#FFF9EE', surfaceAlt: '#ECDFC6', hero: '#103B32', heroRaised: '#245247', text: '#2B332D', muted: '#625440', onHero: '#FFF6DF', heroMuted: '#C8D1BC', border: '#C3AD80', accent: '#14624F', mint: '#D8C08A', mintTint: '#E8E1CC', coralTint: '#F0DCD0', blueTint: '#DEE5DF', warningTint: '#EEE0BD', expense: '#B52D36', income: '#146B50', transfer: '#245FBD' },
  arsenal: { id: 'arsenal', name: 'Arsenal', description: 'North London red, crisp white, navy and gold. The cannon, quietly in the details.', dark: false, canvas: '#F8F5F1', surface: '#FFFFFF', surfaceAlt: '#EEE7DD', hero: '#8F1428', heroRaised: '#871B30', text: '#17243A', muted: '#62574C', onHero: '#FFFFFF', heroMuted: '#F5D9D9', border: '#D7C9B6', accent: '#9C1830', mint: '#DCC18A', mintTint: '#E5EDDF', coralTint: '#F5DFE1', blueTint: '#E2E8F0', warningTint: '#F0E3C8', expense: '#AD2436', income: '#146B50', transfer: '#245FBD' },
  liverpool: { id: 'liverpool', name: 'Liverpool', description: 'Anfield red, clean white and warm gold. The Liver bird in the details.', dark: false, canvas: '#FAF7F2', surface: '#FFFFFF', surfaceAlt: '#EEE7DA', hero: '#981326', heroRaised: '#851A2A', text: '#232725', muted: '#64584A', onHero: '#FFFFFF', heroMuted: '#F5DEDB', border: '#D9CBB7', accent: '#A71930', mint: '#E1C685', mintTint: '#E0EDE7', coralTint: '#F6E0E1', blueTint: '#E2E9EE', warningTint: '#F0E4CA', expense: '#AD2436', income: '#146B50', transfer: '#245FBD' },
  grandline: { id: 'grandline', name: 'Grand Line / One Piece', description: 'Parchment, ocean navy, straw gold and pirate red. Set sail with the crew.', dark: false, canvas: '#F6EDD9', surface: '#FFFAEF', surfaceAlt: '#E9DDC3', hero: '#123249', heroRaised: '#254A61', text: '#173047', muted: '#605C50', onHero: '#FFF8E8', heroMuted: '#C3D2D8', border: '#CEBE9C', accent: '#96372D', mint: '#EBC775', mintTint: '#E5EAD7', coralTint: '#F3DCD2', blueTint: '#DDE7EC', warningTint: '#EFE0B9', expense: '#AD2436', income: '#146B50', transfer: '#245FBD' },
  saiyan: { id: 'saiyan', name: 'Saiyan / Dragon Ball', description: 'Deep blue, fiery orange and Super Saiyan gold. Find your next power level.', dark: true, canvas: '#0B1628', surface: '#162640', surfaceAlt: '#223754', hero: '#102C51', heroRaised: '#24466C', text: '#FFF5E5', muted: '#B3C4D9', onHero: '#FFF7EA', heroMuted: '#B6CCE6', border: '#3E5673', accent: '#FFAA52', mint: '#FFD16A', mintTint: '#333A2A', coralTint: '#49332F', blueTint: '#243C61', warningTint: '#403821', expense: '#FF9397', income: '#86DFB5', transfer: '#99C8FF' },
} as const;
export type AppPalette = typeof appThemes[AppThemeId];
export const themeIds: AppThemeId[] = ['cream', 'midnight', 'neutral', 'grove', 'dusk', 'folio', 'onyx', 'cyberpunk', 'arabia', 'arsenal', 'liverpool', 'grandline', 'saiyan'];
export const validThemeId = (value: unknown): AppThemeId => typeof value === 'string' && themeIds.includes(value as AppThemeId) ? value as AppThemeId : 'cream';

export const themeTypography = {
  cream: { heading: 'system', body: 'system', label: 'system', number: 'system' },
  midnight: { heading: 'SpaceGrotesk', body: 'Manrope', label: 'SpaceGrotesk', number: 'SpaceGrotesk' },
  neutral: { heading: 'Manrope', body: 'Manrope', label: 'Manrope', number: 'Manrope' },
  grove: { heading: 'Lora', body: 'Manrope', label: 'Manrope', number: 'Lora' },
  dusk: { heading: 'SpaceGrotesk', body: 'SpaceGrotesk', label: 'SpaceGrotesk', number: 'SpaceGrotesk' },
  folio: { heading: 'Lora', body: 'SpaceGrotesk', label: 'SpaceGrotesk', number: 'Lora' },
  onyx: { heading: 'SpaceGrotesk', body: 'Manrope', label: 'SpaceGrotesk', number: 'SpaceGrotesk' },
  cyberpunk: { heading: 'SpaceGrotesk', body: 'SpaceGrotesk', label: 'SpaceGrotesk', number: 'SpaceGrotesk' },
  arabia: { heading: 'Lora', body: 'Manrope', label: 'Manrope', number: 'Lora' },
  arsenal: { heading: 'SpaceGrotesk', body: 'Manrope', label: 'SpaceGrotesk', number: 'SpaceGrotesk' },
  grandline: { heading: 'PirataOne', body: 'Manrope', label: 'SpaceGrotesk', number: 'SpaceGrotesk' },
  saiyan: { heading: 'Bangers', body: 'Manrope', label: 'SpaceGrotesk', number: 'SpaceGrotesk' },
  liverpool: { heading: 'SpaceGrotesk', body: 'Manrope', label: 'SpaceGrotesk', number: 'SpaceGrotesk' },
} as const;
export type TypographyRole = keyof typeof themeTypography.cream;
/** Resolve explicit static font faces; never ask Android to synthesize a custom weight. */
export function themeFont(id: AppThemeId, style: { fontFamily?: string; fontWeight?: string | number; fontSize?: number; letterSpacing?: number; fontStyle?: string } = {}, role?: TypographyRole) {
  if (id === 'cream' || style.fontFamily === 'monospace') return {};
  const resolved = role ?? (style.fontFamily === 'serif' || (style.fontSize ?? 0) >= 24 ? 'heading' : (style.letterSpacing ?? 0) >= 1 ? 'label' : 'body');
  const family = themeTypography[id][resolved];
  const weight = style.fontWeight === 'bold' ? 700 : Number(style.fontWeight) || 400;
  const face = family === 'PirataOne' || family === 'Bangers' ? 'Regular' : weight >= 700 ? 'Bold' : weight >= 500 ? 'Medium' : 'Regular';
  return { fontFamily: `LeanLog${family}${face}`, fontWeight: 'normal' as const };
}

// Explicit aliases for legacy styles: no RGB inversion, luminance heuristics,
// global mutation, or changes to saved account/icon/chart identity colours.
const words = (value: string) => new Set(value.split(' '));
const canvas = words('#F7F0E1 #FFF9EA #FFF9ED #FFF7E8');
const paper = words('#FFF #FFFFFF #FFFDF7 #FFF4DB #FFF9ED #FFF9EA #FFF7F2 #FBF6EB');
const ink = words('#101A2B #101722 #111A2A #111827 #263247 #222 #3A3A4A #252535');
const hero = words('#101A2B #111A2A #111827 #172338 #17243A #172033 #15243A #0D1A0D #0D0D1A #33326D');
const raised = words('#26334A #33415C #1C2940 #29364D #24334C #29364B #2A3A5A #344158 #2D405D #2A3A53 #34314F #344560 #30405A #293348 #29405E #202B3E #344057 #303650 #4A5870 #202C40 #536079');
const muted = words('#7D8799 #737A84 #7C8290 #657086 #8D97A8 #68758A #59616D #8E9AAF #7E8AA0 #596173 #8A93A1 #94A1B4 #4D586A #8B8B8B #9AA8BA #9CA5B4 #8993A6 #AAA393 #566070 #8A8272 #5F6670 #758198 #53627A #667389 #9299A4 #AAA #8993A5 #718096 #748096 #68717E #697180 #93A0B3 #6F7E93 #9CA7B7 #555B70 #8E99A9 #8792A5 #7C756B #5E6672 #8A8175 #485260 #737A85');
const heroMuted = words('#7F8BA0 #AAB3C2 #AAB5C7 #AEB8C9 #AEB7C7 #93A0B2 #8490A3 #CBD2DD #CDD4E0');
const borders = words('#EFE5D4 #F0E8DB #E2D9C9 #E7DECE #DED5C5 #E4DBCB #E1DCCF #E7E1D5 #D9CFBF #EEE6D8 #E9E1D3 #F4EDDE #DDD4C5 #D6CCBC #D8CEBE #F0EADD #E2D9C8 #DED6C8 #E8DFD0 #DDD3C1 #E4DFD3 #F7EEDC #F2E9D8 #DCD3C1 #E1D8C8 #DED5C6 #F0E6D4 #B9B3A8 #C8C1B5 #E5DDCF #E3DACB #D8CEBD #EEE8D8 #EAE2D5 #F0E5D1 #E2D7C3 #F3EDDF #CFC4B3 #CEC3B2 #E7DFD0 #D2C8B8 #E5DDCE #EFE7D8 #F1E9DA #DDD2C0 #D7CDBC #E9E2D3 #DED7CC #E5DCCA #E8DFCF #DCD3C4 #EAE2D4 #F6EFE2 #E4DAC9 #E9E0D2 #E6DDCD #C4BAAA #DDD8CB #E9E4D8 #E9E1D4 #F8F0DF #E4D9C6 #EEE5D6 #EEE3CF #EFE6D6 #E0D9CD #CEC7B9 #DED6C6 #DDD8CD #D6CEBE #D9D3C6 #F3EBDC #F3EAD7');
const mintTints = words('#DDF1E7 #E2F4EB #D8EFE4 #DDF5E9 #E6F6EF #E4F3EB');
const coralTints = words('#FFE6DC #FFF0EB #FFE4DC #FFE0D6 #FFE2DB #FFF1E9 #FFE6DE #FFD8CF');
const blueTints = words('#E8E8FF #EEF0FF #E8EDF8 #D5DDED #E3E2F7 #D9D8FF #D4D3F4');
const accents = words('#FF6542 #FF7659 #FF856B #FF8069 #FF7043 #C9472C');
const expenses = words('#F04444 #EF3F43 #EF4444 #FF0000 #C14335 #BD493B #A93424');
const incomes = words('#168A65 #18A879 #379B73 #399778 #167C72 #3A5A3A #2A5C2A');
const transfers = words('#528FF2 #1565C0 #6A8ABF #5C5AA3 #525190 #676792 #66659A');
export type ColourRole = 'color' | 'backgroundColor' | 'borderColor' | 'shadowColor' | 'onAccent';
export function themeColour(value: string, palette: AppPalette, role: ColourRole = 'color'): string {
  if (palette.id === 'cream' || role === 'onAccent' || role === 'shadowColor') return value;
  const key = value.toUpperCase();
  if (role === 'borderColor') {
    if (paper.has(key) || borders.has(key) || raised.has(key) || /^RGBA\(16,\s*(26|23),/.test(key)) return palette.border;
  }
  if (role === 'backgroundColor') {
    if (key === '#8FD6B4' && (palette.id === 'cyberpunk' || palette.id === 'arabia' || palette.id === 'arsenal' || palette.id === 'liverpool' || palette.id === 'grandline' || palette.id === 'saiyan')) return palette.mint;
    if (canvas.has(key)) return palette.canvas;
    if (paper.has(key)) return palette.surface;
    if (hero.has(key)) return palette.hero;
    if (raised.has(key)) return palette.heroRaised;
    if (borders.has(key)) return palette.surfaceAlt;
    if (mintTints.has(key)) return palette.mintTint;
    if (coralTints.has(key)) return palette.coralTint;
    if (blueTints.has(key)) return palette.blueTint;
    if (key === '#F2E7CB' || key === '#F6E4AC') return palette.warningTint;
    if (palette.dark && expenses.has(key)) return '#B93A43';
    if (palette.dark && incomes.has(key)) return '#147151';
    if (palette.dark && transfers.has(key)) return '#356DC1';
  } else {
    if (ink.has(key) || hero.has(key)) return palette.text;
    if (muted.has(key) || borders.has(key)) return palette.muted;
    if (heroMuted.has(key)) return palette.heroMuted;
    if (raised.has(key)) return palette.muted;
    if (paper.has(key) || canvas.has(key)) return palette.onHero;
    if (/^RGBA\(16,\s*(26|23),/.test(key)) return palette.muted;
  }
  if (role === 'color' && palette.dark) {
    if (expenses.has(key)) return palette.expense;
    if (incomes.has(key)) return palette.income;
    if (transfers.has(key)) return palette.transfer;
    if (key === '#846139' || key === '#997123') return '#E5BD77';
  }
  if (accents.has(key)) return role === 'backgroundColor' && palette.dark ? palette.id === 'dusk' ? '#73528C' : palette.id === 'cyberpunk' ? '#75315E' : '#C44831' : palette.accent;
  return value;
}
export function themeStyleSheet<T extends Record<string, object>>(styles: T, palette: AppPalette): T {
  if (palette.id === 'cream') return styles;
  return Object.fromEntries(Object.entries(styles).map(([name, style]) => [name, Object.fromEntries(Object.entries(style).map(([key, value]) => {
    const role = key === 'color' || key === 'backgroundColor' || key === 'shadowColor' ? key : /Color$/.test(key) ? 'borderColor' : null;
    // Explicit semantic exception: ink labels drawn on saturated mint/colour
    // actions must remain dark instead of turning white in Midnight.
    const onAccent = /^(moneyTextDark|resumeButtonText|doneTxtOn|habitCreateText|aiButtonText|budgetSaveText|guardAddText|pinnedPillText|guardSaveText|timelineToggleTextActive|detectorButtonText|detectionReviewText|reminderControlPrimaryText|confirmImportText|widgetButtonText|memoryAddText|repeatTextActive)$/.test(name);
    return [key, typeof value === 'string' && role ? themeColour(value, palette, onAccent && role === 'color' ? 'onAccent' : role) : value];
  }))])) as T;
}
