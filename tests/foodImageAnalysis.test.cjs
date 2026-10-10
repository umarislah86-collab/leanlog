const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const core = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('services/foodImageAnalysis.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, {exports:core});
const item = (patch={}) => ({nama:'Nasi',kalori:300,protein:10,karbohidrat:45,lemak:8,...patch});
const payload = () => ({nama:'Lunch buffet',plates:[{image_index:1,possible_duplicate_of:null,duplicate_reason:'',items:[item()]},{image_index:2,possible_duplicate_of:1,duplicate_reason:'Plate sama dari sudut lain',items:[item({nama:'Ayam',kalori:200})]},{image_index:3,possible_duplicate_of:null,items:[item({nama:'Buah',kalori:100})]}]});
const parse = (data=payload()) => core.parseFoodImageReview(JSON.stringify(data),3);
const photos = () => [1,2,3].map(n=>({uri:`file:///photo${n}.jpg`,base64:'YWJj'}));
test('bulk input fits deployed callable: three images and a single shared prompt, within payload cap',()=>{
 const input=core.foodImageInput(photos(),'Makan separuh nasi.');
 assert.equal(input.length,4);assert.equal(input.filter(p=>p.type==='text').length,1);
 const backend=fs.readFileSync('functions/index.js','utf8');
 const source=backend.slice(backend.indexOf('const validateInput ='),backend.indexOf('const consumeQuota'));
 const ctx={HttpsError:class extends Error{constructor(code,message){super(message);this.code=code;}}};
 vm.runInNewContext(source+'\nthis.validate=validateInput;',ctx);
 assert.doesNotThrow(()=>ctx.validate(input));
 assert.match(input[3].text,/SATU sesi makan/);
 assert.match(input[3].text,/Jangan buang atau gabungkan/);
 assert.match(input[3].text,/NOTA_PENGGUNA_JSON: "Makan separuh nasi\."/);
 assert.throws(()=>core.foodImageInput([...photos(),photos()[0]]),/1 hingga 3/);
 assert.throws(()=>core.foodImageInput([{uri:'f',base64:'a'.repeat(8000001)}]),/terlalu besar/);
});
test('AI flags require user confirmation and never silently exclude duplicate-looking buffet plates',()=>{
 const review=parse();assert.equal(review.plates[1].decision,'unconfirmed');
 assert.throws(()=>core.sumReviewedMeal(review),/Sahkan gambar 2/);
 review.plates[1].decision='include';assert.equal(core.sumReviewedMeal(review).calories,600);
 review.plates[1].decision='exclude';assert.equal(core.sumReviewedMeal(review).calories,400);
});
test('portion edits and user calorie correction are summed locally with matching item totals/macros',()=>{
 const review=parse();review.plates[1].decision='exclude';
 review.plates[0].items[0].portion='0.5';review.plates[2].items[0].kalori=80;
 const result=core.sumReviewedMeal(review);
 assert.equal(result.calories,230);assert.equal(result.items[0].protein,5);
 assert.equal(result.items.reduce((s,i)=>s+i.kalori,0),result.calories);
 review.plates[0].items[0].portion='0';assert.equal(core.sumReviewedMeal(review).items.length,1);
});
test('malformed or partial AI responses cannot save a partial meal',()=>{
 for (const modify of [p=>p.plates.pop(),p=>p.plates[1].image_index=1,p=>p.plates[1].possible_duplicate_of=3,p=>p.plates[0].items[0].kalori=-1,p=>p.plates[0].items[0].protein='10',p=>p.plates[0].items[0].nama='',p=>p.plates.forEach(x=>x.items=[])]) {const p=payload();modify(p);assert.throws(()=>parse(p));}
 assert.throws(()=>core.parseFoodImageReview('not JSON',3),/JSON/);
});
test('JSON code fences accepted, image order normalized, and empty non-food image does not invent food',()=>{
 const p=payload();p.plates.reverse();p.plates[0].items=[];
 const review=core.parseFoodImageReview('```json\n'+JSON.stringify(p)+'\n```',3);
 assert.equal(review.plates[0].imageIndex,1);assert.equal(review.plates[2].items.length,0);
 review.plates[1].decision='exclude';assert.equal(core.sumReviewedMeal(review).calories,300);
});
test('invalid edits and empty selections are blocked before Save',()=>{
 for (const portion of ['', '-1','abc','Infinity','11']) {const r=parse();r.plates[1].decision='exclude';r.plates[0].items[0].portion=portion;assert.throws(()=>core.sumReviewedMeal(r));}
 const review=parse();review.plates.forEach(p=>p.decision='exclude');assert.throws(()=>core.sumReviewedMeal(review),/sekurang-kurangnya/);
 const invalid=parse();invalid.plates[1].decision='exclude';invalid.plates[0].items[0].kalori=NaN;assert.throws(()=>core.sumReviewedMeal(invalid));
});
test('single-image meal uses the same review without requiring buffet metadata or a second AI call',()=>{
 const review=core.parseFoodImageReview(JSON.stringify({nama:'Dinner',plates:[{image_index:1,items:[item()]}]}),1);
 assert.equal(core.sumReviewedMeal(review).calories,300);
 assert.equal(core.foodImageInput([photos()[0]]).length,2);
});
