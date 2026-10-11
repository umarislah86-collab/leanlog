const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {sqliteHarness}=require('./helpers/redcoins-sql.cjs');
function load(file,requireStub,extra={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{exports,require:requireStub,console,...extra});return exports;}
const core=load('services/cardioCore.ts');
const cfg=(overrides={})=>({...core.defaultCardioConfig,gps:false,...overrides});

test('active clock catches up after background, excludes pause, and survives resume/finish',()=>{
 let s=core.createCardioSession(cfg(),100,1000);
 assert.equal(core.elapsedCardioMs(s,61000),60000);
 s=core.transitionCardio(s,'pause',61000);assert.equal(core.elapsedCardioMs(s,361000),60000);
 s=core.transitionCardio(s,'resume',361000);assert.equal(core.elapsedCardioMs(s,421000),120000);
 s=core.transitionCardio(s,'finish',421000);assert.equal(core.elapsedCardioMs(s,999999),120000);
 assert.equal(core.transitionCardio(s,'resume',999999),s);
 assert.equal(core.elapsedCardioMs(core.createCardioSession(cfg(),100,1000),500),0);
});
test('interval phase boundaries and calorie weighting use actual active seconds',()=>{
 const s=core.createCardioSession(cfg({mode:'jog',intervals:{walkSeconds:120,effortSeconds:60,rounds:2}}),100,0);
 assert.equal(core.cardioPhase(s,119000).mode,'walk');assert.equal(core.cardioPhase(s,120000).mode,'jog');
 assert.equal(core.cardioPhase(s,180000).round,2);assert.equal(core.cardioPhase(s,360000).done,true);
 assert.equal(core.cardioCalories(s,180000),Math.round((4.8*2+7.5)*3.5*100/200));
 assert.equal(core.cardioCalories(s,0),0);
 const paused=core.transitionCardio(s,'pause',120000);assert.equal(core.cardioCalories(paused,999999),17);
});
test('invalid goals/intervals/weights fail before starting; pace rounding carries minutes',()=>{
 for(const c of [cfg({goal:'distance'}),cfg({target:NaN}),cfg({target:0}),cfg({intervals:{walkSeconds:0,effortSeconds:30,rounds:2}})])assert.throws(()=>core.createCardioSession(c,100));
 assert.throws(()=>core.createCardioSession(cfg(),0));
 assert.equal(core.cardioPace(119.6),'2:00');assert.equal(core.cardioPace(null),'—');
});
const fix=(lat,t,accuracy=3)=>({latitude:lat,longitude:0,timestamp:t,accuracy});
test('GPS rejects weak, duplicate, stale, teleporting and paused points without inventing distance',()=>{
 let s=core.createCardioSession(cfg({gps:true}),100,0);
 s=core.recordCardioFix(s,fix(0,1000));
 assert.equal(core.recordCardioFix(s,fix(0.001,2000,90)),s);
 assert.equal(core.recordCardioFix(s,fix(0.001,500)),s);
 assert.equal(core.recordCardioFix(s,fix(0,1000)),s);
 assert.equal(core.recordCardioFix(s,fix(1,2000)).distanceM,0);
 s=core.recordCardioFix(s,fix(0.001,61000));assert.ok(s.distanceM>110&&s.distanceM<112);
 const paused=core.transitionCardio(s,'pause',62000);assert.equal(core.recordCardioFix(paused,fix(0.02,63000)),paused);
 const resumed=core.transitionCardio(paused,'resume',120000);assert.equal(core.recordCardioFix(resumed,fix(0.1,121000)).distanceM,s.distanceM);
 assert.equal(core.recordCardioFix(s,fix(0.1,500000)).distanceM,s.distanceM,'long GPS outage must not bridge distance');
});
test('GPS splits cross whole kilometres and goals reflect accepted distance only',()=>{
 let s=core.createCardioSession(cfg({gps:true,goal:'distance',target:1}),100,0);
 for(let i=0;i<=11;i++)s=core.recordCardioFix(s,fix(i*0.001,1000+i*60000));
 assert.equal(s.splits.length,1);assert.equal(s.splits[0].km,1);assert.ok(s.splits[0].seconds>500);
 assert.equal(core.cardioGoalProgress(s,999999),1);
 assert.equal(core.cardioGoalProgress(core.createCardioSession(cfg({goal:'free'}),100)),null);
});
function runtime(){
 const sql=sqliteHarness(),values=new Map([['user_profile',JSON.stringify({weight:118})],['weight_entries',JSON.stringify([{id:'latest',date:'12/10/2026',weight:110}])]]);
 const store=load('services/cardioStore.ts',()=>sql.expo);
 let now=Date.now(),failStorage=false;const scheduled=new Map(),tasks={};
 class Clock extends Date{static now(){return now;}}
 const clockCore=load("services/cardioCore.ts",undefined,{Date:Clock});
 const notifications={AndroidImportance:{HIGH:4,LOW:2},SchedulableTriggerInputTypes:{DATE:'date'},
  setNotificationChannelAsync:async()=>{},setNotificationCategoryAsync:async()=>{},getPermissionsAsync:async()=>({granted:true}),
  getAllScheduledNotificationsAsync:async()=>[...scheduled.values()],cancelScheduledNotificationAsync:async id=>scheduled.delete(id),dismissNotificationAsync:async()=>{},
  scheduleNotificationAsync:async request=>{const id=request.identifier||String(scheduled.size+1);scheduled.set(id,{...request,identifier:id});return id;}};
 const api=load('services/cardioRuntime.ts',name=>{
  if(name==='@react-native-async-storage/async-storage')return{getItem:async k=>values.get(k)||null,setItem:async(k,v)=>{if(failStorage)throw Error('disk full');values.set(k,v);}};
  if(name==='react-native')return{AppState:{currentState:'active'},Platform:{OS:'android'},Vibration:{vibrate(){}}};
  if(name==='expo-constants')return{appOwnership:'expo'};
  if(name==='expo-location')return{hasStartedLocationUpdatesAsync:async()=>false};
  if(name==='expo-task-manager')return{isTaskDefined:()=>false,defineTask:(id,fn)=>tasks[id]=fn};
  if(name==='expo-notifications')return notifications;
  if(name==='expo-speech')return{stop:async()=>{},speak(){}};
  if(name==='../firebase')return{fsUpsert:async()=>{}};
  if(name==='./currentWeight')return{latestLoggedWeight:rows=>rows.at(-1)?.weight||null};
  if(name==='./cardioCore')return clockCore;
  if(name==='./cardioStore')return store;
  throw Error('Unexpected dependency: '+name);
 },{Date:Clock});
 return{api,store,values,sql,scheduled,tasks,advance:ms=>now+=ms,now:()=>now,failStorage:value=>failStorage=value};
}
test('saving twice/concurrently writes one Activity and one history record with latest weight, no AI',async()=>{
 const r=runtime();const s=await r.api.manualCardio(cfg(),30,3);
 assert.equal(s.weightKg,110);
 await Promise.all([r.api.saveCardioActivity(s.id),r.api.saveCardioActivity(s.id)]);
 assert.equal(JSON.parse(r.values.get('activity_entries')).length,1);
 assert.equal((await r.store.loadCardioHistory()).length,1);
 assert.equal((await r.store.loadCardioSession()).status,'saved');
 assert.equal(JSON.parse(r.values.get('activity_entries'))[0].caloriesBurned,277);
 r.sql.db.close();
});
test('storage/history write failures preserve unsaved session; retry cannot duplicate logged Activity',async()=>{
 const r=runtime();const s=await r.api.manualCardio(cfg(),20,0);
 r.failStorage(true);await assert.rejects(r.api.saveCardioActivity(s.id),/disk full/);
 assert.equal((await r.store.loadCardioSession()).status,'finished');assert.equal((await r.store.loadCardioHistory()).length,0);
 r.failStorage(false);r.sql.fail(sql=>{if(sql.includes('INTO cardio_history'))throw Error('history disk full');});
 await assert.rejects(r.api.saveCardioActivity(s.id),/history disk full/);
 assert.equal((await r.store.loadCardioSession()).status,'finished');assert.equal(JSON.parse(r.values.get('activity_entries')).length,1);
 r.sql.fail(null);await r.api.saveCardioActivity(s.id);assert.equal(JSON.parse(r.values.get('activity_entries')).length,1);
 r.sql.db.close();
});
test('pause cancels scheduled cues; resume reschedules from remaining active time; old notification cannot finish new session',async()=>{
 const r=runtime();const s=await r.api.startCardio(cfg({target:1}));
 r.advance(30000);await r.api.controlCardio('pause',s.id);
 assert.equal([...r.scheduled.values()].filter(n=>n.trigger.type==='date').length,0);
 r.advance(120000);await r.api.controlCardio('resume',s.id);
 const cue=[...r.scheduled.values()].find(n=>n.trigger.type==='date');assert.equal(+cue.trigger.date,r.now()+30000);
 await r.api.controlCardio('finish','wrong-session');assert.equal((await r.store.loadCardioSession()).status,'running');
 await r.api.controlCardio('finish',s.id);assert.equal([...r.scheduled.values()].filter(n=>n.trigger.type==='date').length,0);
 r.sql.db.close();
});
test('SQLite exclusive updates preserve GPS changes and reject overwrite of unfinished session',async()=>{
 const r=runtime();const s=await r.api.startCardio(cfg());
 await Promise.all([r.store.updateCardioSession(s=>({...s,distanceM:s.distanceM+10})),r.store.updateCardioSession(s=>({...s,distanceM:s.distanceM+20}))]);
 assert.equal((await r.store.loadCardioSession()).distanceM,30);
 await assert.rejects(r.api.startCardio(cfg()),/current session/);
 await assert.rejects(r.api.manualCardio(cfg(),10,1),/current session/);
 r.sql.db.close();
});
