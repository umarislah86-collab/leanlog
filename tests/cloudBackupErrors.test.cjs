const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const moduleData={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('services/cloudBackupErrors.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:moduleData,exports:moduleData.exports});
const {backupWriteError,cloudBackupFailure}=moduleData.exports;
test('backup diagnostics preserve Firebase code/key and correct UTF8 size without attaching payload',()=>{
 const value='abcé💛汉';const e=backupWriteError({code:'invalid-argument',message:'Document too large'},'redcoins_state_v1',value);
 assert.equal(e.backupBytes,Buffer.byteLength(value,'utf8'));assert.equal(e.backupKey,'redcoins_state_v1');assert.ok(!JSON.stringify(e).includes(value));assert.equal(e.code,'invalid-argument');
});
test('cloud failure distinguishes document size, permissions, quota, login and network',()=>{
 assert.match(cloudBackupFailure(backupWriteError({code:'invalid-argument',message:'Document too large'},'redcoins_state_v1','x'.repeat(1100000)),false),/1MiB.*chunking/);
 assert.match(cloudBackupFailure({code:'permission-denied'},false),/denied access/);
 assert.match(cloudBackupFailure({code:'resource-exhausted'},false),/quota/);
 assert.match(cloudBackupFailure({message:'Sign in before uploading a backup.'},false),/Sign in again/);
 assert.match(cloudBackupFailure({code:'firestore/unavailable'},true),/timeout/);
 assert.ok(!cloudBackupFailure({code:'permission-denied'},true).includes('internet'));
});
