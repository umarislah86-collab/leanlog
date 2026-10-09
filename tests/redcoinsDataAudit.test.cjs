const {test}=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const api={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('services/redcoinsDataAudit.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:api,Date});
const now=new Date('2026-10-08T12:00:00');
const entry=(id,extra={})=>({id,type:'expense',item:'Food',account:'Bank',category:'Living',subcategory:'Food',amount:10,date:'2026-10-07T12:00:00',...extra});
const state=(extra={})=>({accounts:[{id:'bank',name:'Bank',balance:900}],entries:[],categories:[{id:'c',name:'Living',subcategories:['Food']}],reminders:[],subcategoryBudgets:{},...extra});
const audit=(s)=>api.auditRedCoinsData(s,now);
test('read-only audit does not reconstruct balances from zero or claim every balance verified',()=>{
 const s=state({entries:[entry('e')]});const before=JSON.stringify(s),r=audit(s);
 assert.equal(r.total,0);assert.equal(r.bankChecks,0);assert.equal(r.unverifiedBalances,1);assert.equal(JSON.stringify(s),before);
});
test('missing accounts, broken transfers and invalid values have review targets',()=>{
 const r=audit(state({entries:[entry('a',{account:'Deleted'}),entry('b',{type:'transfer',toAccount:'Missing'}),entry('c',{amount:NaN})]}));
 assert.equal(r.errors,3);assert.equal(r.issues[0].target.entryId,'a');
});
test('same-day repeated purchases are hints; future, void and intentional copies excluded',()=>{
 const r=audit(state({entries:[entry('a'),entry('b'),entry('copy',{duplicateOfId:'a'}),entry('future',{date:'2026-10-10T12:00:00'}),entry('void',{status:'void'})]}));
 assert.equal(r.issues.filter(i=>i.title==='Possible same-day duplicate').length,1);assert.equal(r.errors,0);
});
test('monthly income warning permits different amounts and income attribution months',()=>{
 const r=audit(state({entries:[entry('a',{type:'income',item:'EPF',incomePeriod:'2026-09'}),entry('b',{type:'income',item:'epf',incomePeriod:'2026-09',amount:15}),entry('c',{type:'income',item:'EPF',incomePeriod:'2026-10'})]}));
 assert.equal(r.issues.filter(i=>i.title==='Possible repeated monthly income').length,1);
});
test('saved bank comparison rewinds post-cutoff applied transfers and keeps signed amounts',()=>{
 const s=state({accounts:[{id:'bank',name:'Bank',balance:900},{id:'card',name:'Card',balance:-80}],entries:[entry('e',{date:'2026-10-08T10:00:00',amount:100}),entry('f',{date:'2026-10-09T10:00:00',amount:500,balanceEffectApplied:false})],bankReviews:{bank:{endDay:'2026-10-07',bankBalance:'1000'},card:{endDay:'2026-10-07',bankBalance:'-80'}}});
 assert.equal(audit(s).bankChecks,2);assert.equal(audit(s).issues.some(i=>i.title==='Saved bank comparison differs'),false);
 s.bankReviews.bank.bankBalance='990';const r=audit(s);assert.equal(r.issues.find(i=>i.title==='Saved bank comparison differs').target.accountId,'bank');
});
test('budget overlap and broken enabled schedules identified; paused schedule ignored',()=>{
 const r=audit(state({subcategoryBudgets:{'Living\u0000Food':40},termBudgets:[{id:'t',category:'Living',subcategory:'Food',amount:80,startDay:'2026-10-01',endDay:'2026-11-30',repeat:true}],reminders:[{id:'r',enabled:true,template:{account:'Missing'}},{id:'p',enabled:false,template:{account:'Missing'}}]}));
 assert.equal(r.errors,1);assert.equal(r.issues.filter(i=>i.title==='Cycle and period budget overlap').length,1);
});
test('duplicate IDs/names flagged, results capped while totals remain exact',()=>{
 const rows=Array.from({length:350},(_,i)=>entry(String(i),{account:'Missing',item:String(i)}));
 const r=audit(state({entries:rows}));assert.equal(r.total,350);assert.equal(r.issues.length,300);
 const ids=audit(state({entries:[entry('x'),entry('x',{item:'Other'})],accounts:[{id:'a',name:'Bank',balance:1},{id:'b',name:'bank ',balance:1}]}));assert.ok(ids.errors>=2);
});
test('UI reads durable storage, never load/migrate data; targets consumed by RedCoins',()=>{
 const ui=fs.readFileSync('components/RedCoinsDataCheck.tsx','utf8');assert.ok(ui.includes('await readSavedRedCoinsRaw()'));assert.equal(/await loadRedCoins\(/.test(ui),false);
 const screen=fs.readFileSync('screens/RedCoinsScreen.tsx','utf8');assert.ok(screen.includes('auditTarget: undefined'));assert.ok(screen.includes('setBankReviewAccountId(target.accountId)'));
});
