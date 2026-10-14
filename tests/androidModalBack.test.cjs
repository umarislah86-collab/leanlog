const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

for (const file of ['screens/TodayScreen.tsx', 'screens/ProgressScreen.tsx', 'screens/SettingsScreen.tsx']) {
  test(`${file}: every native Modal handles Android Back`, () => {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let count = 0;
    function visit(node) {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(source) === 'Modal') {
        count++;
        assert.ok(node.attributes.properties.some(p => ts.isJsxAttribute(p) && p.name.getText(source) === 'onRequestClose'), `${file}:${source.getLineAndCharacterOfPosition(node.pos).line + 1}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    assert.ok(count > 0);
  });
}
