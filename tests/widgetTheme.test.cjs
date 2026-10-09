const { test } = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm'); const ts = require('typescript'); const React = require('react');
const root = path.join(__dirname, '..'); const source = file => fs.readFileSync(path.join(root, file), 'utf8');
function load(file, mocks = {}) {
  const module = { exports: {} }; const requireMock = id => { if (!(id in mocks)) throw new Error(id); return mocks[id]; };
  requireMock.resolve = id => require.resolve(id, { paths: [root] });
  vm.runInNewContext(ts.transpileModule(source(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText, { module, exports: module.exports, require: requireMock }); return module.exports;
}
const api = load('services/appTheme.ts'); const stored = new Map(); let fail = false;
const theme = load('widgets/widget-theme.tsx', { react: React, '../services/appTheme': api, '@react-native-async-storage/async-storage': { getItem: async key => { if (fail) throw new Error('unavailable'); return stored.get(key); } } });
const primitive = name => Object.assign(() => {}, { __name__: name, convertProps: props => props });
const mocks = { react: React, './widget-theme': theme, 'react-native-android-widget': { FlexWidget: primitive('LinearLayoutWidget'), TextWidget: primitive('TextWidget') } };
const { LeanLogWidget } = load('widgets/LeanLogWidget.tsx', mocks); const others = load('widgets/RedCoinsWidgets.tsx', mocks);
const { buildWidgetTree } = require('../node_modules/react-native-android-widget/lib/commonjs/api/build-widget-tree');
const samples = id => [
  LeanLogWidget({ themeId: id, eaten: 700, burned: 0, meals: 2, goal: 2000, steps: 3000, updated: '10:00', cashReality: { trueSpendable: -300 }, bottomMode: 'accounts', accounts: [{ name: 'Aeon', balance: 100 }, { name: 'Card', balance: -378 }], guards: [] }),
  LeanLogWidget({ themeId: id, eaten: 0, burned: 0, meals: 0, goal: 2000, steps: 0, updated: '10:00', cashReality: null, guards: [{ id: 'guard', name: 'Dining', percent: 120, spent: 480, limit: 400 }] }),
  others.AccountSnapshotWidget({ themeId: id, account: { name: 'Card', type: 'Credit', balance: -378 }, updated: '10:00' }),
  others.CashRealityWidget({ themeId: id, cash: { trueSpendable: -300, liquidBalance: 1000, cardOutstanding: 1300 }, updated: '10:00' }),
  others.QuickLogWidget({ themeId: id }),
  others.AutomationWidget({ themeId: id, rows: [{ id: 'one', item: 'Mortgage', amount: 1200, due: '25 Oct', automatic: true }], updated: '10:00' }),
];
const lum = hex => { const rgb = hex.slice(1).match(/../g).map(x => parseInt(x, 16) / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4); return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722; };
const contrast = (a,b) => (Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
test('headless widgets read the saved theme, safely defaulting on invalid/missing/read error', async () => {
  for (const id of api.themeIds) { stored.set(api.APP_THEME_KEY, id); assert.equal(await theme.getWidgetTheme(), id); }
  stored.set(api.APP_THEME_KEY, 'unknown'); assert.equal(await theme.getWidgetTheme(), 'cream'); fail = true; assert.equal(await theme.getWidgetTheme(), 'cream'); fail = false;
});
test('Original retains exact tree identity/style objects', () => {
  const style = { color: '#172033', fontSize: 11 }; assert.equal(theme.widgetThemeStyle(style, 'cream', 'Title'), style);
  const node = React.createElement(mocks['react-native-android-widget'].TextWidget, { text: 'Title', style }); assert.equal(theme.themedWidgetTree(node, 'cream'), node);
});
test('all five widget types build headlessly for all six themes, keeping actions and values', () => {
  for (const id of api.themeIds) for (const widget of samples(id)) {
    const tree = buildWidgetTree(widget); const text = JSON.stringify(tree);
    assert.match(text, /match_parent/);
    if (id !== 'cream') assert.match(text, /LeanLog(?:Lora|Manrope|SpaceGrotesk)/);
  }
  const quick = JSON.stringify(buildWidgetTree(samples('dusk')[4])); assert.match(quick, /leanlog:\/\/quick\/food/); assert.match(quick, /leanlog:\/\/redcoins\/transfer/);
});
test('all themed widget text passes contrast against its actual inherited background', () => {
  function visit(node, background, id) {
    if (Array.isArray(node)) return node.forEach(child => visit(child, background, id));
    if (!node?.props) return;
    const style = node.props.style || {}; const bg = style.backgroundColor || background;
    if (node.props.text && style.color) assert.ok(contrast(style.color, bg) >= 4.5, `${id}: ${node.props.text}, ${style.color} on ${bg}`);
    visit(node.props.children, bg, id);
  }
  for (const id of api.themeIds.filter(id => id !== 'cream')) samples(id).forEach(widget => visit(widget, api.appThemes[id].canvas, id));
});
test('theme Apply refresh happens only after preference persistence; every native render path reads theme', () => {
  const context = source('context/ThemeContext.tsx'); assert.ok(context.indexOf('await AsyncStorage.setItem(APP_THEME_KEY') < context.indexOf("import('../services/widget')"));
  for (const file of ['services/widget.tsx', 'widgets/widget-task-handler.tsx', 'widgets/WidgetConfigurationScreen.tsx', 'widgets/widget-data.ts']) assert.ok(source(file).includes('getWidgetTheme'), file);
  assert.ok(source('plugins/withWidgetThemeFonts.js').includes('app/src/main/assets/fonts')); assert.ok(source('app.json').includes('withWidgetThemeFonts'));
});
test('native-font plugin copies all nine faces that the Android widget loader can resolve', async () => {
  const temp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'leanlog-widget-fonts-'));
  const plugin = load('plugins/withWidgetThemeFonts.js', { '@expo/config-plugins': { withDangerousMod: (_config, [, callback]) => callback }, fs, path });
  const mod = { modRequest: { platformProjectRoot: temp } }; assert.equal(await plugin({})(mod), mod);
  const fonts = path.join(temp, 'app/src/main/assets/fonts'); assert.equal(fs.readdirSync(fonts).length, 9);
  for (const id of api.themeIds.filter(id => id !== 'cream')) for (const role of ['heading', 'body', 'number']) {
    const family = api.themeFont(id, { fontWeight: '700' }, role).fontFamily;
    assert.ok(fs.statSync(path.join(fonts, `${family}.ttf`)).size > 50000);
  }
});
