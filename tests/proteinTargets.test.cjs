const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function runtime(){
 const values=new Map(),cloud=[];const core={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('services/proteinTargets.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{exports:core,console,Date,require:id=>id.includes('async-storage')?{getItem:async k=>values.get(k)||null,setItem:async(k,v)=>values.set(k,v)}:{fsFetchAll:async()=>[],fsUpsert:async(...args)=>cloud.push(args)}});
 return {core,values,cloud};
}
const profile={weight:118,height:178,age:33,gender:'lelaki',activityLevel:'moderate'};
test('auto follows current weight while reference and fixed targets retain their meaning',()=>{
 const {core:c}=runtime();assert.equal(c.proteinTarget(profile),142);assert.equal(c.proteinTarget({...profile,weight:110}),132);
 assert.equal(c.proteinTarget({...profile,protein:{mode:'strength'}}),189);
 assert.equal(c.proteinTarget({...profile,protein:{mode:'factor',factor:1.4,referenceWeight:80}}),112);
 assert.equal(c.proteinTarget({...profile,weight:100,protein:{mode:'fixed',grams:145}}),145);
 const macros=c.macroTargets(profile,2000);assert.equal(macros.protein,142);assert.ok(Math.abs(macros.protein*4+macros.carbs*4+macros.fat*9-2000)<=6);
});
test('invalid custom settings cannot create impossible macro targets',()=>{
 const {core:c}=runtime();for(const settings of [{mode:'factor',factor:NaN},{mode:'factor',factor:4},{mode:'fixed',grams:0},{mode:'fixed',grams:600},{mode:'auto',referenceWeight:-1}])assert.throws(()=>c.validateProteinSettings(settings,118,2000));
 assert.doesNotThrow(()=>c.validateProteinSettings({mode:'auto'},118,2000));
});
test('today updates preserve past snapshots and concurrent writes preserve each day',async()=>{
 const {core:c,values}=runtime();await Promise.all([c.snapshotProteinTarget(profile,new Date(2026,9,9)),c.snapshotProteinTarget({...profile,weight:110},new Date(2026,9,10))]);
 await c.snapshotProteinTarget({...profile,weight:100},new Date(2026,9,10));const history=JSON.parse(values.get(c.PROTEIN_HISTORY_KEY));assert.equal(history['9/10/2026'].target,142);assert.equal(history['10/10/2026'].target,120);assert.equal(history['8/10/2026'],undefined);
});
test('calendar distinguishes missing logs, zero protein, unknown targets and all threshold boundaries',()=>{
 const {core:c}=runtime();assert.equal(c.proteinLevel(false,0,100),'unlogged');assert.equal(c.proteinLevel(true,0),'unknown');
 for(const [grams,level] of [[0,'low'],[49.9,'low'],[50,'medium'],[79.9,'medium'],[80,'close'],[99.9,'close'],[100,'met'],[250,'met']])assert.equal(c.proteinLevel(true,grams,100),level);
 const result=c.proteinForDay([{id:'1',date:'09/10/2026',items:[{protein:12.5},{protein:NaN},{protein:-2}]},{id:'2',date:'9/10/2026',items:[{protein:7.5}]},{id:'3',date:'8/10/2026',items:[{protein:99}]}],'9/10/2026');assert.equal(result.rows.length,2);assert.equal(result.protein,20);
});
