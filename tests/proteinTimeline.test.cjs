const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function runtime(){const core={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('services/proteinTimeline.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:core,Date});return core;}
const row=(date,protein,category='tengahari')=>({id:date,date,category,items:[{protein}]});
test('timeline continues far beyond seven days through every date to the first real food log',()=>{
 const c=runtime();const days=c.buildProteinTimeline([row('1/1/2020',60),row('9/10/2026',100)],new Date(2026,9,10));
 assert.ok(days.length>2000);assert.equal(days[0].key,'10/10/2026');assert.equal(days[0].entries.length,0);
 assert.equal(days[1].protein,100);assert.equal(days.at(-1).key,'1/1/2020');assert.equal(days.at(-1).protein,60);
 assert.equal(days[8].entries.length,0);assert.equal(days[8].protein,0);
});
test('year/month transitions preserve local calendar days and ordered swipe direction',()=>{
 const c=runtime();const days=c.buildProteinTimeline([row('31/12/2025',1)],new Date(2026,0,2));
 assert.equal(days.map(d=>d.key).join(','),'2/1/2026,1/1/2026,31/12/2025');
});
test('protein aggregates meals across padded/ISO dates; zero logged and missing are distinct',()=>{
 const c=runtime();const days=c.buildProteinTimeline([row('09/10/2026',12.5,'sarapan'),row('2026-10-09',7.5,'malam'),row('8/10/2026',0)],new Date(2026,9,10));
 assert.equal(days[1].protein,20);assert.equal(days[1].meals.sarapan,12.5);assert.equal(days[1].meals.malam,7.5);
 assert.equal(days[2].protein,0);assert.equal(days[2].entries.length,1);assert.equal(days[0].entries.length,0);
});
test('invalid/future dates cannot extend timeline; invalid protein/category cannot corrupt totals',()=>{
 const c=runtime();const days=c.buildProteinTimeline([row('31/9/2026',100),row('11/10/2026',100),row('1/1/1900',100),row('bad',100),row('10/10/2026',NaN),row('10/10/2026',-5),row('10/10/2026',12,'constructor')],new Date(2026,9,10));
 assert.equal(days.length,1);assert.equal(days[0].protein,12);assert.equal(days[0].meals.snek,12);
 assert.equal(c.buildProteinTimeline([],new Date(2026,9,10)).length,1);
});
