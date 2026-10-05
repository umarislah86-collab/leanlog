const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const exportsObject = {};
vm.runInNewContext(ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '../services/mediaPicker.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText, { exports: exportsObject });
const { openNativeImagePicker } = exportsObject;

function mockPicker(permission, requestedPermission = permission) {
  const calls = [];
  const result = { canceled: true, assets: null };
  return {
    calls, result,
    getCameraPermissionsAsync: async () => { calls.push('check'); return permission; },
    requestCameraPermissionsAsync: async () => { calls.push('request'); return requestedPermission; },
    launchCameraAsync: async () => { calls.push('camera'); return result; },
    launchImageLibraryAsync: async () => { calls.push('gallery'); return result; },
  };
}

test('already-granted camera permission never opens a permission Activity', async () => {
  const picker = mockPicker({ granted: true, canAskAgain: true });
  assert.equal(await openNativeImagePicker(picker, true), picker.result);
  assert.deepEqual(picker.calls, ['check', 'camera']);
});
test('first-time camera permission is requested then camera opens', async () => {
  const picker = mockPicker({ granted: false, canAskAgain: true }, { granted: true });
  await openNativeImagePicker(picker, true);
  assert.deepEqual(picker.calls, ['check', 'request', 'camera']);
});
test('denied camera permission does not open the camera', async () => {
  const picker = mockPicker({ granted: false, canAskAgain: true });
  assert.equal(await openNativeImagePicker(picker, true), null);
  assert.deepEqual(picker.calls, ['check', 'request']);
});
test('permanently denied permission is not requested again', async () => {
  const picker = mockPicker({ granted: false, canAskAgain: false });
  assert.equal(await openNativeImagePicker(picker, true), null);
  assert.deepEqual(picker.calls, ['check']);
});
test('gallery opens directly without any permission request', async () => {
  const picker = mockPicker({ granted: false, canAskAgain: false });
  assert.equal(await openNativeImagePicker(picker, false), picker.result);
  assert.deepEqual(picker.calls, ['gallery']);
});
test('native launch error propagates to the UI error handler', async () => {
  const picker = mockPicker({ granted: true });
  picker.launchCameraAsync = async () => { throw new Error('native launch failed'); };
  await assert.rejects(openNativeImagePicker(picker, true), /native launch failed/);
});
