const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function runtime(initial=null,fail=false){
 const values=new Map(initial?[['leanlog_progress_cards_v1',initial]]:[]),core={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('services/progressCardOrder.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{exports:core,require:()=>({getItem:async k=>values.get(k)||null,setItem:async(k,v)=>{if(fail)throw Error('storage unavailable');values.set(k,v);}})});
 return {core,values};
}
test('saved order preserves valid preferences and fills new/missing cards once',()=>{
 const {core:c}=runtime();assert.equal(c.normalizeProgressOrder(['calendar','protein','calendar','retired']).join(','),'calendar,protein,weight,timeline,brief,export');
 assert.equal(c.normalizeProgressOrder({}).join(','),c.progressCardIds.join(','));
});
test('moving cards cannot cross boundaries, drop cards or mutate the previous order',()=>{
 const {core:c}=runtime();const original=c.normalizeProgressOrder(null);const moved=c.moveProgressCard(original,'calendar',-1);
 assert.equal(original.join(','),'protein,weight,timeline,brief,export,calendar');assert.equal(moved.join(','),'protein,weight,timeline,brief,calendar,export');
 assert.equal(c.moveProgressCard(original,'protein',-1).join(','),original.join(','));assert.equal(c.moveProgressCard(original,'calendar',1).join(','),original.join(','));
});
test('chosen order survives a fresh load and malformed stored JSON falls back safely',async()=>{
 const r=runtime();const next=r.core.normalizeProgressOrder(['calendar','weight','protein']);await r.core.saveProgressOrder(next);
 const fresh=runtime(r.values.get('leanlog_progress_cards_v1'));assert.equal((await fresh.core.loadProgressOrder()).join(','),next.join(','));
 const bad=runtime('bad json');assert.equal((await bad.core.loadProgressOrder()).join(','),bad.core.progressCardIds.join(','));
});
test('failed persistence rejects instead of returning an order that was not saved',async()=>{
 const r=runtime(JSON.stringify(['weight','protein']),true);await assert.rejects(()=>r.core.saveProgressOrder(r.core.normalizeProgressOrder(['calendar'])));
 assert.equal(r.values.get('leanlog_progress_cards_v1'),JSON.stringify(['weight','protein']));
});
