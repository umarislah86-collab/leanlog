const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript'), vm = require('node:vm'), fs = require('node:fs');
function renderDock(route) {
  const calls = [], stateWrites = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: value => [value, next => stateWrites.push(next)],
    useRef: value => ({ current: value }), useEffect: () => {},
  };
  const exports = {};
  const themed = color => color;
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/MainNavigationDock.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText, { exports, setTimeout: callback => callback(), require: name => {
    if (name === './ThemeMotif') return {ThemeWatermark:'ThemeWatermark'};
    if (name === './ThemeSurfaces') return {ThemeAnimatedView:'AnimatedView',ThemeView:'View',ThemeTouchableOpacity:'TouchableOpacity'};
    if (name === 'react') return react;
    if (name === 'react-native') return { View: 'View', TouchableOpacity: 'TouchableOpacity', Modal: 'Modal',
      Animated: { View: 'AnimatedView', Value: class { interpolate(config) { return config; } } },
      StyleSheet: { create: x => x, absoluteFill: {} } };
    if (name === '@expo/vector-icons') return { Ionicons: 'Icon' };
    if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ bottom: 24 }) };
    if (name === './RedCoinsMark') return {RedCoinsMark:'RedCoinsMark'};
    if (name === './ThemePrimitives') return { ThemeText: 'Text' };
    if (name === '../context/ThemeContext') return { useTheme: () => ({ themed, palette:{dark:false} }), useThemeStyles: x => x };
    if (name === '../context/NavigationDockContext') return { useMoneyNavigation: () => ({ section: 'accounts', select: x => calls.push(['section', x]) }) };
    if (name === '../services/redcoinsSwipe') return { redcoinsSections: ['home', 'activity', 'accounts', 'plan', 'reports'] };
    if (name === '../theme') return { colors: {} };
    throw Error(name);
  }});
  const routes = ['Home', 'Log', 'Progress', 'Coach', 'RedCoins'].map(name => ({ name, key: name }));
  const tree = exports.MainNavigationDock({ state: { routes, index: routes.findIndex(r => r.name === route) },
    descriptors: Object.fromEntries(routes.map(r => [r.key, { options: {} }])), navigation: { navigate: (...args) => calls.push(args) } });
  function find(node, predicate) {
    if (!node || typeof node !== 'object') return null;
    if (predicate(node)) return node;
    for (const child of (node.props?.children || []).flat(Infinity)) { const found = find(child, predicate); if (found) return found; }
    return null;
  }
  return { tree, calls, stateWrites, find: predicate => find(tree, predicate) };
}

test('shared plus stays outside animated tabs in both modes, opens quick logger and long-press logs expense', () => {
  for (const route of ['Home', 'RedCoins']) {
    const dock = renderDock(route);
    const fab = dock.find(n => n.props?.accessibilityLabel === 'Open quick logger');
    assert.ok(fab);
    const layers = dock.tree.props.children.flat().filter(n => n?.type === 'View');
    assert.ok(layers[1].props.children.includes(fab), 'plus is a sibling of animated tab slot');
    fab.props.onPress(); assert.equal(dock.stateWrites.at(-1), true);
    fab.props.onLongPress(); assert.equal(dock.calls.at(-1)[0], 'RedCoins'); assert.equal(dock.calls.at(-1)[1].mode, 'expense');
  }
});

test('only active navigation layer is touchable; RedCoins selection calls screen navigation', () => {
  for (const route of ['Coach', 'RedCoins']) {
    const dock = renderDock(route);
    const slot = dock.tree.props.children.find(n => n?.type === 'View' && n.props.style?.height === 64);
    const [main, money] = slot.props.children;
    assert.equal(main.props.pointerEvents, route === 'RedCoins' ? 'none' : 'auto');
    assert.equal(money.props.pointerEvents, route === 'RedCoins' ? 'auto' : 'none');
    assert.equal(money.props.accessibilityElementsHidden, route !== 'RedCoins');
    const accounts = dock.find(n => n.props?.accessibilityLabel === 'RedCoins accounts');
    assert.equal(accounts.props.accessibilityState.selected, true);
    dock.find(n => n.props?.accessibilityLabel === 'RedCoins reports').props.onPress();
    assert.equal(dock.calls.at(-1)[0], 'section'); assert.equal(dock.calls.at(-1)[1], 'reports');
  }
});

test('dock publishes selection synchronously without waiting for a screen effect; repeated previews do not rerender', () => {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('services/navigationDock.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { exports });
  const dock = exports.createNavigationDock();
  const notifications = [];
  const unsubscribe = dock.subscribe(() => notifications.push(dock.getSnapshot()?.section));
  const select = () => {};
  const disconnect = dock.connect('home', select);
  dock.showSection('accounts');
  assert.equal(notifications.at(-1), 'accounts');
  assert.equal(dock.getSnapshot().select, select);
  const count = notifications.length;
  const snapshot = dock.getSnapshot();
  dock.showSection('accounts');
  assert.equal(notifications.length, count);
  assert.equal(dock.getSnapshot(), snapshot);
  dock.connect('reports', () => {});
  disconnect();
  assert.equal(dock.getSnapshot().section, 'reports', 'old cleanup must not disconnect newer screen');
  unsubscribe();
  const lastCount = notifications.length;
  dock.showSection('home');
  assert.equal(notifications.length, lastCount);
});
