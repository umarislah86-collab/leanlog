const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript'), vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
const api = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../services/redcoinsSwipe.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: api });
test('swipes walk all RedCoins tabs and exit to adjacent main tabs at boundaries', () => {
 const sections = ['home', 'activity', 'accounts', 'plan', 'reports'];
 assert.equal(api.redcoinsSwipeTarget('home', 100, 0).route, 'Coach');
 assert.equal(api.redcoinsSwipeTarget('reports', -100, 0).route, 'Settings');
 for(let i=0;i<4;i++) assert.equal(api.redcoinsSwipeTarget(sections[i], -100, 10).section, sections[i+1]);
 for(let i=1;i<5;i++) assert.equal(api.redcoinsSwipeTarget(sections[i], 100, 10).section, sections[i-1]);
});
test('short, vertical and diagonal gestures do not navigate', () => {
 for(const [dx,dy] of [[10,0],[0,100],[70,60],[-20,5]]) assert.equal(api.redcoinsSwipeTarget('home',dx,dy),null);
});
