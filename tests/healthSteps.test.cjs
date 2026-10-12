const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function harness({pages=[[]],preferred=420,fallback=850,failPreferred=false,failDiscovery=false}={}){
 const calls=[];const now=new Date(),start=new Date(now);start.setHours(0,0,0,0);
 const record=(origin,count=1,end=now.toISOString())=>({count,startTime:start.toISOString(),endTime:end,metadata:{dataOrigin:origin}});
 const native={initialize:async()=>true,readRecords:async(type,options)=>{
 calls.push({kind:'read',type,...options});if(type!=='Steps')return {records:[]};
 if(!('pageSize' in options))return {records:[record('com.xiaomi.wearable')]};
 if(failDiscovery)throw Error('read');const page=Number(options.pageToken||0);return {records:pages[page].map(x=>record(...x)),pageToken:page+1<pages.length?String(page+1):undefined};
 },aggregateRecord:async options=>{calls.push({kind:'aggregate',...options});if(options.recordType!=='Steps')return {BPM_AVG:70};if(options.dataOriginFilter){if(failPreferred)throw Error('preferred failed');return {COUNT_TOTAL:preferred};}return {COUNT_TOTAL:fallback};}};
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('services/health.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:()=>native,Date,Set,Number});return {read:exports.readHealthSnapshot,calls};
}
test('yesterday Mi history does not filter today steps; sleep keeps independent watch origin',async()=>{
 const h=harness();const result=await h.read();assert.equal(result.steps,850);assert.equal(result.sourceLabel,'Health Connect');assert.equal(h.calls.find(c=>c.kind==='aggregate'&&c.recordType==='Steps').dataOriginFilter,undefined);assert.equal(h.calls.find(c=>c.kind==='read'&&c.type==='SleepSession'&&c.dataOriginFilter).dataOriginFilter[0],'com.xiaomi.wearable');
});
test('today Mi steps replace rather than add Health Connect totals, including later pages',async()=>{
 const h=harness({pages:[[['phone.app',200]],[['com.mi.wearable',10]]]});const result=await h.read();assert.equal(result.steps,420);assert.equal(result.sourceLabel,'Mi Fitness via Health Connect');const reads=h.calls.filter(c=>c.kind==='aggregate'&&c.recordType==='Steps');assert.equal(reads.length,1);assert.equal(reads[0].dataOriginFilter[0],'com.mi.wearable');
});
test('zero today records, stale records and unrelated wearable cannot select Mi',async()=>{
 for(const item of [['com.mi.wearable',0],['other.wearable.app',5],['com.mi.wearable',5,new Date(Date.now()-86400000).toISOString()]]){const h=harness({pages:[[item]]});assert.equal((await h.read()).sourceLabel,'Health Connect');}
});
test('empty/failed preferred aggregate and failed discovery fall back safely',async()=>{
 for(const options of [{preferred:0},{failPreferred:true},{failDiscovery:true}]){const h=harness({pages:[[['com.mi.wearable',10]]],...options});const result=await h.read();assert.equal(result.steps,850);assert.equal(result.sourceLabel,'Health Connect');}
});
test('later sync switches to Mi only on next read, with no summed duplicate steps',async()=>{
 const pages=[[]],h=harness({pages});assert.equal((await h.read()).steps,850);pages[0]=[['com.mi.wearable',10]];assert.equal((await h.read()).steps,420);
});
