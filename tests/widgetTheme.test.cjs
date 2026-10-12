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
const mocks = { react: React, './widget-theme': theme, 'react-native-android-widget': { FlexWidget: primitive('LinearLayoutWidget'), TextWidget: primitive('TextWidget'), SvgWidget: primitive('SvgWidget'), OverlapWidget: primitive('FrameLayoutWidget') } };
const motifs = load('services/themeMotifs.ts', {'./appTheme':api});
const artwork = load('services/themeArtwork.ts', {'./appTheme': api, './themeMotifs': motifs});
mocks['./widget-watermark'] = load('widgets/widget-watermark.tsx', {...mocks, '../services/themeArtwork': artwork, '../services/textContrast':load('services/textContrast.ts')});
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
test('all five widget types build headlessly for every theme, keeping actions and values', () => {
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
    const style = node.props.style || {}; let bg = style.backgroundColor || background;
    if (node.type?.__name__ === 'FrameLayoutWidget') {
      const xml = node.props.children[0].props.children.props.svg;
      const ink = [api.appThemes[id].accent, api.appThemes[id].mint].find(c => xml.includes(c));
      const rgb = hex => hex.slice(1).match(/../g).map(x => parseInt(x, 16));
      const base = rgb(bg), top = rgb(ink);
      // Worst-case fully painted motif stroke behind text, not only the blank SVG area.
      bg = '#' + base.map((x,i) => Math.round(x * .925 + top[i] * .075).toString(16).padStart(2,'0')).join('');
    }
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
test('native-font plugin copies all eleven faces that the Android widget loader can resolve', async () => {
  const temp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'leanlog-widget-fonts-'));
  const plugin = load('plugins/withWidgetThemeFonts.js', { '@expo/config-plugins': { withDangerousMod: (_config, [, callback]) => callback }, fs, path });
  const mod = { modRequest: { platformProjectRoot: temp } }; assert.equal(await plugin({})(mod), mod);
  const fonts = path.join(temp, 'app/src/main/assets/fonts'); assert.equal(fs.readdirSync(fonts).length, 11);
  for (const id of api.themeIds.filter(id => id !== 'cream')) for (const role of ['heading', 'body', 'number']) {
    const family = api.themeFont(id, { fontWeight: '700' }, role).fontFamily;
    assert.ok(fs.statSync(path.join(fonts, `${family}.ttf`)).size > 10000);
  }
});

test('all widget motifs are subtle background layers behind unchanged content', () => {
  for (const id of api.themeIds) for (const widget of samples(id)) {
    const tree=buildWidgetTree(widget), images=[];
    const visit=node=>{if(node.type==='SvgWidget')images.push(node);(node.children||[]).forEach(visit);};visit(tree);
    assert.equal(images.length, 1);
    assert.equal(tree.type, 'FrameLayoutWidget');
    assert.equal(tree.children.length, 2);
    assert.equal(tree.children[0].children[0].type, 'SvgWidget');
    assert.equal(tree.children[1].props.style.backgroundColor, undefined);
    assert.ok(images[0].props.style.height >= 42);
    assert.match(images[0].props.svg, /<g opacity="0.075">/);
    assert.equal(images[0].props.clickAction, undefined);
    for (const image of images) { assert.match(image.props.svg, /<svg/); assert.ok(!image.props.svg.includes('http:') || image.props.svg.includes('http://www.w3.org/2000/svg')); assert.ok(!image.props.svg.includes('<image')); assert.ok([api.appThemes[id].accent,api.appThemes[id].mint].some(colour=>image.props.svg.includes(colour))); }
  }
});

test('all thirteen motifs have distinct identities and XML without text or external images', () => {
  const names=api.themeIds.map(id=>motifs.themeMotif(id).name);assert.equal(new Set(names).size,13);
  for(const id of api.themeIds)for(const hero of [false,true]){const motif=motifs.themeMotif(id,hero);assert.ok(motif.ratio>0);assert.ok(!/<text|<image|href=/i.test(motif.svg));assert.ok(motif.svg.includes(hero?api.appThemes[id].mint:api.appThemes[id].accent));}
});

 test('every theme has distinct artwork per surface; anime pages have separate characters', () => {
  const places=['home','log','progress','coach','drawer','widget','account','cash','quick','upcoming'];
  for(const id of api.themeIds){
    const pieces=places.map(place=>artwork.themeArtwork(id,place));
    assert.equal(new Set(pieces.map(x=>x.svg)).size,places.length,id);
    pieces.forEach(x=>{assert.equal(x.ratio,1);assert.ok(!/<text|<image|href=/i.test(x.svg));});
  }
  assert.deepEqual(['log','progress','coach','drawer'].map(p=>artwork.themeArtwork('grandline',p).name),['luffy','zoro','sanji','chopper']);
  assert.deepEqual(['log','progress','coach','drawer'].map(p=>artwork.themeArtwork('saiyan',p).name),['goku','vegeta','piccolo','shenron']);
});
