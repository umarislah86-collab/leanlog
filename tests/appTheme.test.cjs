const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.join(__dirname, '..');
function load(file, mocks = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports, console: { warn() {} }, require: id => mocks[id] || {} });
  return exports;
}
const api = load('services/appTheme.ts');
const { appThemes, themeColour, themeStyleSheet, validThemeId } = api;
const source = file => fs.readFileSync(path.join(root, file), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function runtime(values = new Map(), failure = {}) {
  const slots = []; let cursor = 0; const effects = [];
  const react = {
    createContext: value => { const ctx = { value }; ctx.Provider = { ctx }; return ctx; },
    useContext: ctx => ctx.value,
    useState: initial => { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
    useRef: initial => { const index = cursor++; return slots[index] ||= { current: initial }; },
    useEffect: (callback, deps) => { const index = cursor++; if (!slots[index] || deps.some((dep, i) => dep !== slots[index][i])) effects.push(callback); slots[index] = deps; },
    useCallback: fn => fn, useMemo: fn => fn(), forwardRef: fn => fn,
  };
  const jsx = (type, props) => ({ type, props });
  const flatten = styles => Array.isArray(styles) ? Object.assign({}, ...styles.filter(Boolean).map(flatten)) : styles;
  const native = { StyleSheet: { create: styles => styles, flatten }, Text: 'NativeText', TextInput: 'NativeTextInput' };
  const storage = { getItem: async key => { if (failure.read) throw new Error('read failed'); return values.get(key) ?? null; }, setItem: async (key, value) => { if (failure.write) throw new Error('write failed'); if (failure.wait) await failure.wait; values.set(key, value); } };
  const mocks = { react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': native, '@react-native-async-storage/async-storage': storage, '../services/appTheme': api, '../services/themeFonts': { loadThemeFonts: async () => { if (failure.fontWait) await failure.fontWait; if (failure.fonts) throw new Error('font load failed'); } } };
  const context = load('context/ThemeContext.tsx', mocks);
  const render = () => { cursor = 0; const tree = context.ThemeProvider({ children: 'mounted-app' }); tree.type.ctx.value = tree.props.value; effects.splice(0).forEach(fn => fn()); return tree; };
  return { context, render, values, failure, primitives: () => load('components/ThemePrimitives.tsx', { ...mocks, '../context/ThemeContext': context }) };
}
const luminance = hex => { const rgb = hex.replace('#', '').match(/../g).map(x => parseInt(x, 16) / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4); return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722; };
const contrast = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };

test('six explicit themes, unknown/missing preference safely defaults to Original', () => {
  assert.equal(Object.keys(appThemes).length, 6);
  for (const value of [null, undefined, 'auto', 'invalid', '{}']) assert.equal(validThemeId(value), 'cream');
  assert.equal(validThemeId('midnight'), 'midnight'); assert.equal(validThemeId('neutral'), 'neutral');
  for (const id of api.themeIds) assert.equal(validThemeId(id), id);
});
test('Original retains exact legacy stylesheet and inline colors without mutation', () => {
  const styles = { card: { backgroundColor: '#FFF9EA', color: '#111A2A', padding: 16 }, input: { borderColor: '#E4DFD3', color: '#7C8290' } };
  assert.equal(themeStyleSheet(styles, appThemes.cream), styles);
  for (const color of ['#101A2B', '#FFFDF7', 'rgba(0,0,0,.6)', '#F04444']) assert.equal(themeColour(color, appThemes.cream), color);
  const before = JSON.stringify(styles); themeStyleSheet(styles, appThemes.midnight); assert.equal(JSON.stringify(styles), before);
});
test('Midnight distinguishes surfaces/hero/text, protects ink-on-mint and geometry', () => {
  const styles = { card: { backgroundColor: '#FFFFFF', borderColor: '#E1DCCF', padding: 18, borderRadius: 22 }, title: { color: '#111A2A', fontSize: 24 }, hero: { backgroundColor: '#101A2B' }, money: { color: '#FFFDF7' }, budgetSaveText: { color: '#101A2B' }, saveText: { color: '#111A2A' }, repeatText: { color: '#111A2A' }, repeatTextActive: { color: '#111A2A' } };
  const dark = themeStyleSheet(styles, appThemes.midnight);
  assert.equal(dark.card.backgroundColor, appThemes.midnight.surface); assert.equal(dark.title.color, appThemes.midnight.text);
  assert.equal(dark.hero.backgroundColor, appThemes.midnight.hero); assert.equal(dark.money.color, appThemes.midnight.onHero);
  assert.equal(dark.budgetSaveText.color, '#101A2B'); assert.equal(dark.saveText.color, appThemes.midnight.text);
  assert.equal(dark.repeatTextActive.color, '#111A2A'); assert.equal(dark.repeatText.color, appThemes.midnight.text);
  assert.equal(dark.card.padding, 18); assert.equal(dark.card.borderRadius, 22);
});
test('neutral background roles and user identity colors are explicit, not inverted', () => {
  assert.equal(themeColour('#FFF9EA', appThemes.neutral, 'backgroundColor'), appThemes.neutral.canvas);
  assert.equal(themeColour('#101A2B', appThemes.neutral, 'backgroundColor'), appThemes.neutral.hero);
  for (const color of ['#F4C7B8', '#185E50', '#C9D8F4', '#8D9BFF', '#E8B84A']) assert.equal(themeColour(color, appThemes.midnight), color);
});
test('foreground contrast for themed surfaces, navy heroes and mint actions stays readable', () => {
  for (const id of api.themeIds.filter(id => id !== 'cream')) {
    const p = appThemes[id];
    for (const bg of [p.canvas, p.surface, p.surfaceAlt]) { assert.ok(contrast(p.text, bg) >= 4.5, `${id} text`); assert.ok(contrast(p.muted, bg) >= 4.5, `${id} muted`); }
    assert.ok(contrast(p.onHero, p.hero) >= 4.5); assert.ok(contrast(p.heroMuted, p.hero) >= 4.5); assert.ok(contrast('#101A2B', p.mint) >= 4.5);
    if (p.dark) assert.ok(contrast(p.onHero, themeColour('#FF6542', p, 'backgroundColor')) >= 4.5, `${id} accent action`);
  }
  for (const color of ['#F04444', '#18A879', '#528FF2']) {
    assert.ok(contrast(themeColour(color, appThemes.midnight), appThemes.midnight.surface) >= 4.5);
    assert.ok(contrast(appThemes.midnight.onHero, themeColour(color, appThemes.midnight, 'backgroundColor')) >= 4.5);
  }
});
test('hydration loads stored theme before mounting app; failed read falls back without blocking startup', async () => {
  const r = runtime(new Map([[api.APP_THEME_KEY, 'midnight']]));
  assert.equal(r.render().props.children, null); await tick();
  assert.equal(r.render().props.children, 'mounted-app'); assert.equal(r.context.useTheme().palette.id, 'midnight');
  const failed = runtime(new Map(), { read: true }); failed.render(); await tick(); failed.render();
  assert.equal(failed.context.useTheme().ready, true); assert.equal(failed.context.useTheme().palette.id, 'cream');
});
test('apply waits for persistence; failure keeps current theme and concurrent changes reject', async () => {
  let release; const failure = { wait: new Promise(resolve => { release = resolve; }) };
  const r = runtime(new Map(), failure); r.render(); await tick(); r.render();
  const pending = r.context.useTheme().setTheme('midnight'); r.render();
  assert.equal(r.context.useTheme().palette.id, 'cream'); assert.equal(r.context.useTheme().saving, true);
  await assert.rejects(r.context.useTheme().setTheme('neutral'), /Another appearance/);
  release(); await pending; r.render(); assert.equal(r.context.useTheme().palette.id, 'midnight');
  assert.equal(r.values.get(api.APP_THEME_KEY), 'midnight');
  r.failure.write = true; await assert.rejects(r.context.useTheme().setTheme('neutral'), /write failed/); r.render();
  assert.equal(r.context.useTheme().palette.id, 'midnight'); assert.equal(r.context.useTheme().saving, false);
});
test('styles are cached across renders/theme changes; original style object is preserved', async () => {
  const r = runtime(); r.render(); await tick(); r.render();
  const base = { title: { color: '#111A2A' } }; assert.equal(r.context.useThemeStyles(base), base);
  await r.context.useTheme().setTheme('midnight'); r.render(); const dark = r.context.useThemeStyles(base);
  assert.equal(r.context.useThemeStyles(base), dark);
  await r.context.useTheme().setTheme('neutral'); r.render(); assert.notEqual(r.context.useThemeStyles(base), dark);
  await r.context.useTheme().setTheme('midnight'); r.render(); assert.equal(r.context.useThemeStyles(base), dark);
  assert.equal(base.title.color, '#111A2A');
});
test('TextInput forwards value, events, ref and selection; nested text keeps native inheritance', async () => {
  const r = runtime(new Map([[api.APP_THEME_KEY, 'midnight']])); r.render(); await tick(); r.render();
  const { ThemeTextInput } = r.primitives(); const ref = {}; const change = () => {}; const selection = { start: 2, end: 2 };
  const tree = ThemeTextInput({ value: 'Air', onChangeText: change, selection, style: { fontSize: 22 } }, ref);
  assert.equal(tree.type, 'NativeTextInput'); assert.equal(tree.props.ref, ref); assert.equal(tree.props.onChangeText, change); assert.equal(tree.props.value, 'Air'); assert.equal(tree.props.selection, selection); assert.equal(tree.props.keyboardAppearance, 'dark');
  assert.ok(source('components/ThemePrimitives.tsx').includes('!nested && { color: palette.text }'));
});
test('Appearance preview applies only on explicit save; all screens use stable context, not remount keys', () => {
  const appearance = source('components/AppearanceSettings.tsx');
  assert.equal((appearance.match(/await setTheme\(preview\)/g) || []).length, 1);
  assert.ok(appearance.includes('setPreview(id)')); assert.ok(appearance.includes('onRequestClose={close}')); assert.ok(appearance.includes('onPress={close}'));
  const app = source('App.tsx'); assert.ok(app.includes('<ThemeProvider><AppStatusBar /><AppContent /></ThemeProvider>')); assert.ok(app.includes('DarkTheme')); assert.ok(!/key=\{(?:palette|theme)/.test(app));
  for (const file of fs.readdirSync(path.join(root, 'screens')).filter(file => file.endsWith('.tsx'))) assert.ok(source('screens/' + file).includes('useThemeStyles'), file);
  for (const file of ['components/RedCoinsBudgetEditor.tsx', 'components/RedCoinsBankReviewModal.tsx', 'components/RedCoinsAiPromptModal.tsx', 'components/RedCoinsBatchModal.tsx']) assert.ok(source(file).includes('useThemeStyles'), file);
  for (const file of ['services/redcoinsSqlStore.ts', 'services/redcoins.ts', 'widgets/widget-data.ts', 'services/redcoinsReport.ts']) if (fs.existsSync(path.join(root, file))) assert.ok(!source(file).includes('APP_THEME_KEY'), file);
});
test('theme hooks never run inside conditional section renderers or ledger/category map callbacks', () => {
  for (const file of ['App.tsx', ...['screens', 'components'].flatMap(dir => fs.readdirSync(path.join(root, dir)).filter(name => name.endsWith('.tsx')).map(name => `${dir}/${name}`))]) {
    const ast = ts.createSourceFile(file, source(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
      if (ts.isCallExpression(node) && ['useTheme', 'useThemeStyles'].includes(node.expression.getText(ast))) {
        let owner = node.parent; while (owner && !ts.isFunctionLike(owner)) owner = owner.parent;
        let parent = owner?.parent; while (parent && !ts.isFunctionLike(parent)) parent = parent.parent;
        assert.ok(!parent, `${file}: nested theme hook at ${ast.getLineAndCharacterOfPosition(node.pos).line + 1}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
});

test('custom typography resolves heading/body/label/number faces and honors original/mono', () => {
  assert.equal(api.themeFont('grove', { fontFamily: 'serif', fontWeight: '800' }).fontFamily, 'LeanLogLoraBold');
  assert.equal(api.themeFont('grove', { fontWeight: '600' }).fontFamily, 'LeanLogManropeMedium');
  assert.equal(api.themeFont('folio', { letterSpacing: 2, fontWeight: 'bold' }).fontFamily, 'LeanLogSpaceGroteskBold');
  assert.equal(api.themeFont('dusk', { fontSize: 32 }).fontFamily, 'LeanLogSpaceGroteskRegular');
  assert.equal(api.themeFont('grove', {}, 'number').fontFamily, 'LeanLogLoraRegular');
  assert.equal(Object.keys(api.themeFont('cream', { fontFamily: 'serif' })).length, 0);
  assert.equal(Object.keys(api.themeFont('folio', { fontFamily: 'monospace' })).length, 0);
  for (const id of api.themeIds.filter(id => id !== 'cream')) assert.equal(api.themeFont(id, { fontWeight: '900' }).fontWeight, 'normal');
});

test('font loading precedes first app mount, with safe system-font fallback on failure', async () => {
  let release; const r = runtime(new Map([[api.APP_THEME_KEY, 'folio']]), { fontWait: new Promise(resolve => { release = resolve; }) });
  r.render(); await tick(); assert.equal(r.render().props.children, null);
  release(); await tick(); assert.equal(r.render().props.children, 'mounted-app');
  assert.equal(r.context.useTheme().fontsLoaded, true); assert.equal(r.context.useTheme().palette.id, 'folio');
  const failed = runtime(new Map([[api.APP_THEME_KEY, 'grove']]), { fonts: true });
  failed.render(); await tick(); assert.equal(failed.render().props.children, 'mounted-app');
  assert.equal(failed.context.useTheme().fontsLoaded, false);
  const tree = failed.primitives().ThemeText({ style: { fontFamily: 'serif' }, children: 'Heading' }, {});
  assert.equal(Object.keys(tree.props.style.at(-1)).length, 0);
});

test('Text/Input override legacy fonts without rewriting editable props; candidate preview uses its own face', async () => {
  const r = runtime(new Map([[api.APP_THEME_KEY, 'grove']])); r.render(); await tick(); r.render();
  const { ThemeText, ThemeTextInput, ThemeTypographyPreview } = r.primitives();
  const heading = ThemeText({ style: [{ fontFamily: 'serif' }, { fontWeight: '800', fontSize: 30 }], children: 'Your day' }, {});
  assert.equal(heading.props.style.at(-1).fontFamily, 'LeanLogLoraBold');
  const amount = ThemeTextInput({ keyboardType: 'decimal-pad', value: '1856.97', selection: { start: 3, end: 3 }, style: { fontWeight: 'bold' } }, {});
  assert.equal(amount.props.style.at(-1).fontFamily, 'LeanLogLoraBold');
  assert.equal(amount.props.value, '1856.97'); assert.equal(amount.props.selection.start, 3);
  const scope = ThemeTypographyPreview({ id: 'dusk', children: 'sample' }); scope.type.ctx.value = scope.props.value;
  assert.equal(ThemeText({ style: { fontFamily: 'serif', fontSize: 30 }, children: 'Your day' }, {}).props.style.at(-1).fontFamily, 'LeanLogSpaceGroteskRegular');
  assert.ok(source('components/AppearanceSettings.tsx').includes('<ThemeTypographyPreview id={p.id}>'));
});

test('all resolved font faces are bundled static TTFs, with accessible licences and no remote requests', () => {
  const assets = source('services/themeFonts.ts');
  const paths = [...assets.matchAll(/require\('([^']+\.ttf)'\)/g)].map(match => match[1]);
  assert.equal(paths.length, 9);
  const aliases = [...assets.matchAll(/(LeanLog\w+): require/g)].map(match => match[1]);
  for (const id of api.themeIds.filter(id => id !== 'cream')) for (const role of ['heading', 'body', 'label', 'number']) for (const weight of [400, 600, 800]) assert.ok(aliases.includes(api.themeFont(id, { fontWeight: weight }, role).fontFamily));
  let size = 0;
  for (const font of paths) { const bytes = fs.readFileSync(require.resolve(font, { paths: [root] })); assert.equal(bytes.readUInt32BE(0), 0x00010000); size += bytes.length; }
  assert.ok(size < 1.5 * 1024 * 1024, `Font footprint: ${size}`);
  assert.ok(!assets.includes('https://'));
  assert.ok(source('components/AppearanceSettings.tsx').includes('themeFontLicenses'));
});
