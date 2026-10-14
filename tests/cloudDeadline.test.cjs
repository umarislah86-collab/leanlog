const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('services/cloudDeadline.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:m,exports:m.exports,setTimeout,clearTimeout});
test('stalled upload times out and cannot submit later records or success metadata',async()=>{
 let release,submitted=0;const stalled=new Promise(resolve=>release=resolve);
 await assert.rejects(m.exports.cloudDeadline(async check=>{check();submitted++;await stalled;check();submitted++;},10),e=>e.code==='deadline-exceeded');
 release();await new Promise(r=>setTimeout(r,10));assert.equal(submitted,1);
});
test('confirmed operation succeeds normally',async()=>assert.equal(await m.exports.cloudDeadline(async check=>{check();return 'ok';},100),'ok'));
