const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const exportsObject={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('services/activityDateTime.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:exportsObject});
const {activityDate,activityTime,normalizeActivityDate,normalizeActivityTime}=exportsObject;
test('picker serializes local date and time without locale-dependent AM/PM',()=>{
 const d=new Date(2026,9,11,19,5);assert.equal(activityDate(d),'11/10/2026');assert.equal(activityTime(d),'19:05');
});
test('review accepts 12-hour English/Malay and bidi locale marks, stores canonical 24-hour time',()=>{
 for(const input of ['7:05 PM','07:05 pm','7:05 PTG','\u200e7:05\u202fPM\u200f','7:05 p.m.'])assert.equal(normalizeActivityTime(input),'19:05');
 assert.equal(normalizeActivityTime('12:00 AM'),'00:00');assert.equal(normalizeActivityTime('12:00 PTG'),'12:00');assert.equal(normalizeActivityTime('7:05 PG'),'07:05');assert.equal(normalizeActivityTime('19:05'),'19:05');
 assert.equal(normalizeActivityDate(' 11/10/2026 '),'11/10/2026');assert.equal(normalizeActivityDate('01/02/2026'),'1/2/2026');
});
test('invalid dates/times fail with the correct field identified',()=>{
 for(const time of ['25:00','19:60','13:00 PM','0:00 AM','7pm',''])assert.throws(()=>normalizeActivityTime(time),/Time/);
 for(const date of ['31/2/2026','29/2/2025','11/10/26'])assert.throws(()=>normalizeActivityDate(date),/Date/);
});
