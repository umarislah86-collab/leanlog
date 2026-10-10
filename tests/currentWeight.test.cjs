const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function runtime(profile=null){
 const values=new Map(profile?[['user_profile',JSON.stringify(profile)]]:[]), cloud=[];
 const core={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('services/currentWeight.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{exports:core,console,Date,require:id=>id.includes('async-storage')?{getItem:async k=>values.get(k)||null,setItem:async(k,v)=>values.set(k,v)}:{fsSetSettings:async data=>cloud.push(data)}});
 return {core,values,cloud};
}
const profile={weight:118,height:178,age:33,gender:'lelaki',activityLevel:'moderate'};
const now=new Date(2026,9,10);
const row=(id,date,weight)=>({id:String(id),date,weight});
test('current weight follows measurement date, not insertion order; same-day latest log wins without rounding',()=>{
 const {core}=runtime();
 const rows=[row(900,'1/10/2026',120),row(200,'10/10/2026',116.25),row(100,'10/10/2026',117)];
 assert.equal(core.latestLoggedWeight(rows,now),116.25);
 const result=core.profileWithLoggedWeight(profile,rows,now);
 assert.equal(result.weight,116.25);assert.equal(result.height,178);assert.equal(profile.weight,118);
});
test('future, malformed and invalid weight records cannot replace current weight',()=>{
 const {core}=runtime();
 const rows=[row(1,'9/10/2026',117),row(2,'11/10/2026',110),row(3,'31/9/2026',100),row(4,'10/10/2026',NaN),row(5,'10/10/2026',0),row(6,'10/10/2026',-2),row(7,'bad',90)];
 assert.equal(core.latestLoggedWeight(rows,now),117);
 assert.equal(core.latestLoggedWeight([],now),null);
 assert.equal(core.profileWithLoggedWeight(profile,[],now),profile);
});
test('removing latest measurement falls back to remaining latest dated weight',()=>{
 const {core}=runtime();
 const rows=[row(1,'8/10/2026',118),row(2,'9/10/2026',117)];
 assert.equal(core.profileWithLoggedWeight(profile,rows.slice(0,1),now).weight,118);
});
test('profile sync persists only weight and mirrors settings; no incomplete profile is created',async()=>{
 const r=runtime(profile);
 const rows=[row(1,'1/1/2020',116.25)];
 await r.core.syncProfileWeight(rows);
 assert.equal(JSON.parse(r.values.get('user_profile')).weight,116.25);
 assert.equal(JSON.parse(r.values.get('user_profile')).age,33);
 assert.equal(r.cloud.length,1);
 await r.core.syncProfileWeight(rows);assert.equal(r.cloud.length,1);
 const empty=runtime();assert.equal(await empty.core.syncProfileWeight(rows),null);assert.equal(empty.values.size,0);
});
