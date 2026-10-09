const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const cache={};function load(name){if(cache[name])return cache[name];const api={};cache[name]=api;vm.runInNewContext(ts.transpileModule(fs.readFileSync(`services/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:api,require:path=>load(path.replace('./','')),Date});return api;}
const api=load('redcoinsBudgetSetup'),now=new Date('2026-10-08T12:00:00');
const b=(id,extra={})=>({id,category:'Engines',subcategory:'Oil',amount:80,startDay:'2026-10-01',endDay:'2026-11-30',months:2,repeat:true,carryForward:false,reserve:false,...extra});
const state=(extra={})=>({categories:[{name:'Engines',subcategories:['Oil','Fuel']},{name:'Living',subcategories:['Food']}],subcategoryBudgets:{'Engines\u0000Oil':40,'Living\u0000Food':100},termBudgets:[],entries:[{id:'e',amount:12}],accounts:[{id:'a',balance:200}],...extra});
test('cycle to period replaces only the exact target without changing ledger/cash',()=>{
 const s=state(),before=JSON.stringify(s),next=api.replaceTargetBudget(s,'Engines','Oil',{period:b('t')});
 assert.equal(next.subcategoryBudgets['Engines\u0000Oil'],undefined);assert.equal(next.subcategoryBudgets['Living\u0000Food'],100);assert.equal(next.termBudgets.length,1);assert.equal(next.accounts,s.accounts);assert.equal(next.entries,s.entries);assert.equal(JSON.stringify(s),before);assert.equal(api.periodAllocation(next,now),40);
});
test('conflicts remain untouched until explicit replacement; period to cycle removes legacy duplicates',()=>{
 const s=state({termBudgets:[b('t'),b('t2')]});assert.equal(api.targetBudgetChoices(s,'Engines','Oil').conflict,true);assert.equal(api.periodAllocation(s,now),0);assert.equal(s.termBudgets.length,2);
 const next=api.replaceTargetBudget(s,'Engines','Oil',{cycle:50});assert.equal(next.termBudgets.length,0);assert.equal(next.subcategoryBudgets['Engines\u0000Oil'],50);assert.equal(s.termBudgets.length,2);
});
test('remove target preserves unrelated definitions and never creates transactions',()=>{
 const s=state({termBudgets:[b('t'),b('other',{subcategory:'Fuel'})]});const next=api.replaceTargetBudget(s,'Engines','Oil',null);assert.equal(next.termBudgets.length,1);assert.equal(next.termBudgets[0].id,'other');assert.equal(next.entries,s.entries);
});
test('monthly planning equivalence excludes upcoming/ended and labels custom average',()=>{
 assert.equal(api.periodMonthlyEquivalent(b('t'),now),40);assert.equal(api.periodMonthlyEquivalent(b('future',{startDay:'2027-01-01',endDay:'2027-02-28'}),now),0);assert.equal(api.periodMonthlyEquivalent(b('ended',{repeat:false,startDay:'2025-01-01',endDay:'2025-02-28'}),now),0);
 const custom=b('c',{months:undefined,startDay:'2026-10-01',endDay:'2026-10-10',amount:100,repeat:false});assert.equal(api.periodMonthlyEquivalent(custom,now),304.36875);
});
test('category-wide vs child overlap refused without silently removing the other level',()=>{
 const s=state();assert.throws(()=>api.replaceTargetBudget(s,'Engines','',{period:b('wide',{subcategory:undefined})}),/overlap/);
 const broad=state({subcategoryBudgets:{},termBudgets:[b('wide',{subcategory:undefined})]});assert.throws(()=>api.replaceTargetBudget(broad,'Engines','Oil',{cycle:20}),/overlap/);assert.equal(api.replaceTargetBudget(broad,'Engines','',null).termBudgets.length,0);
});
test('invalid allocation/period rejected',()=>{
 assert.throws(()=>api.replaceTargetBudget(state(),'Engines','Oil',{cycle:NaN}));assert.throws(()=>api.replaceTargetBudget(state(),'Engines','Oil',{period:b('bad',{amount:-1})}));
});
test('orphan and category-level overlaps never inflate monthly planning allocation',()=>{
 assert.equal(api.periodAllocation(state({categories:[],subcategoryBudgets:{},termBudgets:[b('t')]}),now),0);
 assert.equal(api.periodAllocation(state({termBudgets:[b('wide',{subcategory:undefined})]}),now),0);
 assert.equal(api.periodAllocation(state({subcategoryBudgets:{},termBudgets:[b('wide',{subcategory:undefined}),b('child')]}),now),0);
});
test('settings grouped without losing backup/import/widget/reminder/update actions; macros beside nutrition',()=>{
 const source=fs.readFileSync('screens/SettingsScreen.tsx','utf8');for(const name of ['Personal preferences','Reminders & home screen','Data & recovery','Account & app'])assert.equal(source.split(`<SettingsGroup title="${name}"`).length,2);
 const personal=source.slice(source.indexOf('<SettingsGroup title="Personal'),source.indexOf('<SettingsGroup title="Reminders'));assert.ok(personal.includes('Cara Makro Dikira'));
 for(const component of ['<RedCoinsBackupSettings />','<RedCoinsDataCheck />','<BluecoinsImportSettings />']) assert.equal(source.split(component).length,2);
 for(const action of ['onPress={uploadToCloud}','onPress={restoreFromCloud}','onPress={checkForUpdate}',"addHomeWidget('LeanLogAutomation'"])assert.ok(source.includes(action));
});
test('accounts doorway, plan subpages and editor stable across ordinary state renders',()=>{
 const source=fs.readFileSync('screens/RedCoinsScreen.tsx','utf8');assert.ok(source.includes('Manage categories'));assert.ok(source.includes('if (categoriesOpen) return Categories()'));assert.ok(source.includes("if (section === 'plan' && planPage !== 'overview')"));assert.ok(source.includes('<RedCoinsBudgetEditor'));assert.equal(source.includes('<RedCoinsTermBudgets'),false);
 assert.ok(source.includes("section === 'plan' ? planPage"));const editor=fs.readFileSync('components/RedCoinsBudgetEditor.tsx','utf8');assert.ok(editor.includes('Replace existing setup?'));assert.ok(editor.includes('onRequestClose'));assert.ok(editor.includes("setAmount(String(b.amount))"));
});
