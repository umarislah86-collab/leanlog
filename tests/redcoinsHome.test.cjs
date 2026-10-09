const { test } = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm'); const ts = require('typescript');
const root = path.join(__dirname, '..');
const source = file => fs.readFileSync(path.join(root, file), 'utf8');
function load(file) { const exports = {}; const code = ts.transpileModule(source(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText; vm.runInNewContext(code, { exports, require: () => ({}) }); return exports; }
const layout = load('services/redcoinsHomeLayout.ts'); const appearance = load('services/redcoinsHomeAppearance.ts'); const { appThemes } = load('services/appTheme.ts');
const list = value => Array.from(value);
test('Home layout normalizes missing, corrupt, duplicate and future card preferences', () => {
  for (const value of [undefined, null, {}, 'bad']) assert.deepEqual(list(layout.normalizeHomeOrder(value)), list(layout.homeCardIds));
  assert.deepEqual(list(layout.normalizeHomeOrder(['cash', 'cash', 'invalid', 'daily'])), ['cash', 'daily', 'calendar', 'budget', 'favorites', 'flow']);
});
test('moving cards preserves all six once, handles boundaries and leaves input untouched', () => {
  const input = list(layout.homeCardIds); const before = JSON.stringify(input);
  assert.deepEqual(list(layout.moveHomeCard(input, 'calendar', -1)), ['calendar', 'daily', 'budget', 'favorites', 'flow', 'cash']);
  assert.deepEqual(list(layout.moveHomeCard(input, 'flow', 1)), ['daily', 'calendar', 'budget', 'favorites', 'cash', 'flow']);
  assert.deepEqual(list(layout.moveHomeCard(input, 'daily', -1)), input); assert.deepEqual(list(layout.moveHomeCard(input, 'cash', 1)), input);
  assert.equal(JSON.stringify(input), before);
});
const luminance = hex => { const rgb = hex.slice(1).match(/../g).map(x => parseInt(x, 16) / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4); return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722; };
const contrast = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
test('every non-original Home surface and financial label passes 4.5:1 contrast', () => {
  for (const p of Object.values(appThemes).filter(p => p.id !== 'cream')) {
    const c = appearance.homeColours(p); const styles = appearance.homeStyleOverrides(p);
    assert.equal(styles.dashCard.backgroundColor, p.surface); assert.ok(!styles.dashCard.backgroundColor.includes('rgba'));
    for (const role of ['text', 'muted', 'expense', 'income', 'transfer']) assert.ok(contrast(c[role], c.surface) >= 4.5, `${p.id} ${role}`);
    for (const [key, style] of Object.entries(styles)) if (style.color) assert.ok(contrast(style.color, c.surface) >= 4.5, `${p.id} ${key}`);
  }
});
test('appearance overlays preserve geometry, unrelated styles and Original identity', () => {
  const base = { dashCard: { backgroundColor: 'rgba(255,255,255,.78)', padding: 14, borderRadius: 20 }, favoriteName: { color: '#111A2A', fontWeight: '800' }, unrelated: { width: 42 } };
  assert.equal(appearance.applyHomeAppearance(base, appThemes.cream), base);
  const modified = appearance.applyHomeAppearance(base, appThemes.midnight);
  assert.equal(modified.dashCard.padding, 14); assert.equal(modified.favoriteName.fontWeight, '800'); assert.equal(modified.unrelated, base.unrelated);
  assert.equal(base.dashCard.backgroundColor, 'rgba(255,255,255,.78)');
});
test('Home renderer orders six stable cards; layout Save persists before applying without touching finance', () => {
  const screen = source('screens/RedCoinsScreen.tsx'); const start = screen.indexOf('const Home ='); const block = screen.slice(start, screen.indexOf('const activityHeader', start));
  for (const id of layout.homeCardIds) assert.ok(new RegExp(`\\b${id}: \\(`).test(block), id);
  assert.ok(block.includes('homeOrder.map(id => <React.Fragment key={id}>{cards[id]}</React.Fragment>)'));
  assert.ok(block.includes('Arrange Home')); assert.ok(block.includes('disabled={!homeLayoutReady}'));
  const save = screen.slice(screen.indexOf('<RedCoinsHomeLayoutModal'), screen.indexOf('<FavoriteAccountsModal'));
  assert.ok(save.indexOf('await AsyncStorage.setItem') < save.indexOf('setHomeOrder(next)'));
  assert.ok(!save.includes('persist(')); assert.ok(!save.includes('saveRedCoins'));
  const modal = source('components/RedCoinsHomeLayoutModal.tsx'); assert.ok(modal.includes('onRequestClose={dismiss}')); assert.ok(modal.includes('onPress={dismiss}')); assert.ok(modal.includes('lock.current = true')); assert.ok(modal.includes('await save(draft)'));
});
