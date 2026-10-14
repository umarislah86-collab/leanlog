const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module:m,exports:m.exports,require:id=>{if(!(id in mocks))throw Error(id);return mocks[id];},console,setTimeout,clearTimeout});return m.exports;}
const scope=load('services/cloudBackupScope.ts');
function fixture(options={}){
 const stored=new Map(),writes=[],reads=[];const auth={currentUser:{uid:'qc-user'}};
 const snap=value=>({exists:()=>value!==undefined,data:()=>value});
 const api={getFirestore:()=>({}),collection:(_db,...p)=>p.join('/'),doc:(_db,...p)=>p.join('/'),setDoc:async(p,v)=>{writes.push([p,v]);if(options.write)await options.write();stored.set(p,v);},getDoc:async p=>{reads.push(p);return snap(stored.get(p));},getDocs:async()=>({docs:[]}),deleteDoc:async()=>{}};
 const deadline=load('services/cloudDeadline.ts');
 const firebase=load('firebase.ts',{'@react-native-async-storage/async-storage':{},'firebase/app':{getApps:()=>[],initializeApp:()=>({})},'firebase/firestore':api,'firebase/auth':{initializeAuth:()=>auth,getAuth:()=>auth,getReactNativePersistence:()=>({})},'./services/cloudDeadline':options.timeout?{cloudDeadline:work=>deadline.cloudDeadline(work,options.timeout)}:deadline,'./services/cloudBackupErrors':load('services/cloudBackupErrors.ts'),'./services/cloudBackupScope':scope});
 return {firebase,stored,writes,reads};
}

test('timed-out Firebase write blocks retries until settled and never submits remaining keys or metadata',async()=>{
 let release;const pending=new Promise(resolve=>release=resolve);
 const f=fixture({write:()=>pending,timeout:10});
 await assert.rejects(f.firebase.fsUploadAppState({calorie_entries:'[]',activity_entries:'[]'}),e=>e.code==='deadline-exceeded');
 await assert.rejects(f.firebase.fsUploadAppState({calorie_entries:'new'}),e=>e.code==='failed-precondition');
 assert.equal(f.writes.length,1);release();await new Promise(resolve=>setTimeout(resolve,10));
 assert.equal(f.writes.length,1);
 await f.firebase.fsUploadAppState({calorie_entries:'new'});
 assert.equal(f.writes.length,3);
});
test('upload cannot send finance keys even when a caller supplies the full old state',async()=>{
 const f=fixture();await f.firebase.fsUploadAppState({calorie_entries:'[]',user_profile:'{}',redcoins_state_v1:'large-ledger',bluecoins_monthly_budget_v1:'999',redcoins_receipt_folder_v1:'content://private'});
 assert.deepEqual(f.writes.map(([p])=>p),['users/qc-user/appState/calorie_entries','users/qc-user/appState/user_profile','users/qc-user/appStateMeta/latest']);
 assert.equal(JSON.stringify(f.writes).includes('large-ledger'),false);
});
test('legacy cloud restore does not fetch finance records or return them for local application',async()=>{
 const f=fixture();f.stored.set('users/qc-user/appStateMeta/latest',{keys:['redcoins_state_v1','bluecoins_payday_v1','activity_entries']});
 f.stored.set('users/qc-user/appState/activity_entries',{value:'[{"id":"walk"}]'});
 const restored=await f.firebase.fsFetchAppState();
 assert.equal(restored.activity_entries,'[{"id":"walk"}]');assert.equal(Object.keys(restored).length,1);assert.equal(f.reads.length,2);
 const merged=new Map([['redcoins_state_v1','current-ledger'],['bluecoins_payday_v1','20']]);for(const [key,value]of Object.entries(scope.filterCloudState(restored)))merged.set(key,value);
 assert.equal(merged.get('redcoins_state_v1'),'current-ledger');assert.equal(merged.get('bluecoins_payday_v1'),'20');
});
test('finance-only legacy backup returns no LeanLog checkpoint',async()=>{
 const f=fixture();f.stored.set('users/qc-user/appStateMeta/latest',{keys:['redcoins_state_v1','bluecoins_monthly_budget_v1']});assert.equal(await f.firebase.fsFetchAppState(),null);assert.equal(f.reads.length,1);
});
test('all JSON finance preferences and finance prefixes are excluded; LeanLog records remain',()=>{
 const prefs=load('services/redcoinsBackupFormat.ts').BACKUP_PREFERENCE_KEYS;
 for(const key of [...prefs,'redcoins_home_layout_v1','redcoins_before_json_restore_v1','redcoins_backup_folder_v1','BLUECOINS_PAYDAY_V1','@redcoins_state_v1'])assert.equal(scope.shouldCloudBackupKey(key),false,key);
 for(const key of ['calorie_entries','activity_entries','weight_entries','user_profile','gym_sessions','app_language','leanlog_appearance_v1'])assert.equal(scope.shouldCloudBackupKey(key),true,key);
 const screen=fs.readFileSync('screens/SettingsScreen.tsx','utf8');assert.ok(!/readSavedRedCoinsRaw|replaceRedCoinsFromBackup|parseRedCoinsBackup/.test(screen));
});
