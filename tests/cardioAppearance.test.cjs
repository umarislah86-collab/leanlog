const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports});return exports;}
const {appThemes,themeColour}=load('services/appTheme.ts'),{cardioAppearance,colourContrast,readableTextOn}=load('services/cardioAppearance.ts');
test('Cardio actual input, segment, card, hero and filled-action colour pairs meet text contrast in all eleven themes',()=>{
 for(const [id,p] of Object.entries(appThemes)){
  const s=cardioAppearance(p);
  const pairs=[[s.input.color,s.input.backgroundColor,'input'],[s.toggleTitle.color,s.segment.backgroundColor,'inactive segment'],[s.toggleTitle.color,s.segmentOn.backgroundColor,'active segment'],[s.modeText.color,s.mode.backgroundColor,'mode'],[s.hint.color,s.card.backgroundColor,'hint'],[s.fieldLabel.color,s.card.backgroundColor,'label'],[s.eyebrow.color,s.card.backgroundColor,'eyebrow'],[s.timer.color,s.hero.backgroundColor,'timer'],[s.heroHint.color,s.hero.backgroundColor,'hero hint'],[s.primaryText.color,s.primary.backgroundColor,'primary'],[s.phaseName.color,s.phaseCard.backgroundColor,'phase']];
  for(const [fg,bg,name] of pairs)assert.ok(colourContrast(fg,bg)>=4.5,`${id}/${name}: ${fg} on ${bg}`);
  const finish=themeColour('#FF6542',p,'backgroundColor');assert.ok(colourContrast(readableTextOn(finish),finish)>=4.5,`${id}/finish`);
 }
});
test('legacy cream segment/input surfaces change with dark themes while Original stays unchanged',()=>{
 for(const [id,p] of Object.entries(appThemes))for(const bg of ['#EFE5D4','#F0E8DB']){
  if(id==='cream')assert.equal(themeColour(bg,p,'backgroundColor'),bg);
  else assert.equal(themeColour(bg,p,'backgroundColor'),p.surfaceAlt);
 }
});
