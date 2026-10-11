const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript'), vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
function load(file, requireStub) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText, { exports, require: requireStub });
  return exports;
}
const api = load('services/redcoinsSwipe.ts');

test('native page positions include all five sections and both exit pages', () => {
  assert.equal(api.redcoinsPageTarget(0).route, 'Coach');
  ['home', 'activity', 'accounts', 'plan', 'reports'].forEach((section, index) => {
    assert.equal(api.redcoinsPageTarget(index + 1).section, section);
  });
  assert.equal(api.redcoinsPageTarget(6).route, 'Settings');
  for (const position of [-1, 7, 1.5, NaN]) assert.equal(api.redcoinsPageTarget(position), null);
});

// Checks real component callbacks/ref commands, not Android touch dispatch.
// Nested native swipes still require Expo Go/device QC.
function mount(initial = 'home') {
  const refs = [], effects = [], calls = [], previews = [];
  const control = { current: null };
  let cursor = 0, section = initial, tree;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useRef: value => refs[cursor++] ||= { current: value },
    useImperativeHandle: (ref, create) => effects.push(() => { ref.current = create(); }),
  };
  const { RedCoinsPager } = load('components/RedCoinsPager.tsx', name => {
    if (name === 'react') return react;
    if (name === 'react-native') return { View: 'View' };
    if (name === 'react-native-pager-view') return { __esModule: true, default: 'NativePagerView' };
    if (name === '../services/redcoinsSwipe') return api;
    throw new Error(name);
  });
  function render(next = section, enabled = true) {
    section = next;
    cursor = 0;
    tree = RedCoinsPager({ section, enabled, renderSection: name => name, pagerControlRef: control, onPreview: name => previews.push(name),
      onSection: name => calls.push(['section', name]),
      onExit: route => calls.push(['exit', route]),
    });
    tree.props.ref.current = { setPageWithoutAnimation: page => calls.push(['setPage', page]) };
    effects.splice(0).forEach(effect => effect());
    return tree;
  }
  render();
  return { calls, previews, render, show: name => control.current.showSection(name), scroll: (position, offset) => tree.props.onPageScroll({ nativeEvent: { position, offset } }), select: position => tree.props.onPageSelected({ nativeEvent: { position } }) };
}

test('native selection updates section; controlled tab/back changes command native pager', () => {
  const pager = mount();
  pager.select(2);
  assert.deepEqual(pager.calls, [['section', 'activity']]);
  pager.render('activity');
  assert.equal(pager.calls.length, 1, 'selected page must not be reset during swipe');
  pager.show('reports');
  assert.deepEqual(pager.calls.at(-1), ['setPage', 5], 'tap commands pager before React renders');
  pager.render('reports');
  assert.deepEqual(pager.calls.at(-1), ['setPage', 5]);
  pager.select(5);
  assert.equal(pager.calls.length, 2, 'programmatic callback must not add navigation history');
  pager.show('activity');
  pager.render('activity');
  assert.deepEqual(pager.calls.at(-1), ['setPage', 2]);
});

test('both edge exits reset pager before leaving so returning shows edge section', () => {
  for (const [section, sentinel, page, route] of [['home', 0, 1, 'Coach'], ['reports', 6, 5, 'Settings']]) {
    const pager = mount(section);
    pager.select(sentinel);
    assert.deepEqual(pager.calls, [['setPage', page], ['exit', route]]);
    pager.select(page);
    assert.equal(pager.calls.length, 2);
  }
});

test('busy/unfocused pager disables native scrolling and keeps native page wrappers', () => {
  const pager = mount();
  const tree = pager.render('home', false);
  assert.equal(tree.type, 'NativePagerView');
  assert.equal(tree.props.scrollEnabled, false);
  const pages = tree.props.children.flat();
  assert.equal(pages.length, 7);
  for (const page of pages) assert.equal(page.props.collapsable, false);
});


test('rapid tab taps ignore stale native callbacks and delayed screen commits', () => {
  const pager = mount();
  pager.show('reports');
  pager.show('accounts');
  pager.select(5);
  pager.render('reports');
  assert.equal(pager.calls.length, 2, 'old native event/render must not undo latest tap');
  pager.select(3);
  pager.render('accounts');
  assert.deepEqual(pager.calls, [['setPage', 5], ['setPage', 3]]);
});

test('swipe highlight follows halfway point and cancelled swipe restores it without section history', () => {
  const pager = mount();
  pager.scroll(1, 0.6);
  assert.equal(pager.previews.at(-1), 'activity');
  pager.scroll(1, 0);
  assert.equal(pager.previews.at(-1), 'home');
  assert.equal(pager.calls.length, 0);
  pager.scroll(0, 0.4);
  assert.equal(pager.previews.at(-1), 'home');
  pager.scroll(5, 0.8);
  assert.equal(pager.previews.at(-1), 'reports');
});
