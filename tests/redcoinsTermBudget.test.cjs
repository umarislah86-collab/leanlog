const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const api = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('services/redcoinsTermBudget.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:api,Date});
const b = {id:'b',category:'Engines',subcategory:'Oil',amount:80,startDay:'2026-01-01',endDay:'2026-02-28',months:2,repeat:true,carryForward:false,reserve:true};
const row = (date,amount,extra={}) => ({type:'expense',category:'Engines',subcategory:'Oil',date:new Date(`${date}T12:00:00`).toISOString(),amount,...extra});
test('two-month limit resets March and reserve is not a transaction',()=>{
 const entries=[row('2026-02-01',60),row('2026-03-01',20)],before=JSON.stringify(entries);
 const first=api.termBudgetSummary(b,entries,new Date('2026-02-20T12:00:00'));
 assert.equal(first.spent,60);assert.equal(first.monthlyReserve,40);assert.equal(first.remaining,20);
 const next=api.termBudgetSummary(b,entries,new Date('2026-03-20T12:00:00'));
 assert.equal(next.startDay,'2026-03-01');assert.equal(next.endDay,'2026-04-30');assert.equal(next.spent,20);assert.equal(next.limit,80);assert.equal(JSON.stringify(entries),before);
});
test('carry-forward uses prior actuals and excludes future, void, income and wrong scope',()=>{
 const r=api.termBudgetSummary({...b,carryForward:true},[row('2026-02-01',60),row('2026-03-01',10),row('2026-03-02',500,{status:'void'}),row('2026-03-03',500,{type:'income'}),row('2026-03-04',500,{subcategory:'Fuel'}),row('2026-04-01',500)],new Date('2026-03-20T12:00:00'));
 assert.equal(r.carry,20);assert.equal(r.limit,100);assert.equal(r.spent,10);
});
test('one-off custom inclusive range, upcoming and ended, category-wide scope',()=>{
 const plan={...b,months:undefined,repeat:false,subcategory:undefined,startDay:'2026-01-10',endDay:'2026-01-12'};
 assert.equal(api.termBudgetSummary(plan,[],new Date('2026-01-09')).status,'Upcoming');
 const r=api.termBudgetSummary(plan,[row('2026-01-12',30,{subcategory:'Fuel'}),row('2026-01-13',20)],new Date('2026-01-14'));
 assert.equal(r.spent,30);assert.equal(r.status,'Ended');assert.equal(r.endDay,'2026-01-12');
});
test('custom repeats exact days and calendar months clamp without drifting',()=>{
 const custom={...b,months:undefined,startDay:'2026-01-01',endDay:'2026-01-03'};
 assert.equal(api.termBudgetSummary(custom,[],new Date('2026-01-07')).startDay,'2026-01-07');
 const month={...b,months:1,startDay:'2024-01-31',endDay:'2024-02-28'};
 assert.equal(api.termBudgetSummary(month,[],new Date('2024-02-29T12:00:00')).startDay,'2024-02-29');
 assert.equal(api.termBudgetSummary(month,[],new Date('2024-03-31T12:00:00')).startDay,'2024-03-31');
});
test('reject invalid dates, ranges, amounts and intervals',()=>{
 for(const extra of [{startDay:'2026-02-30'},{endDay:'2025-01-01'},{amount:NaN},{months:0},{months:1.5}]) assert.equal(api.validTermBudget({...b,...extra}),false);
});
