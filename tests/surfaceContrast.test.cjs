const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,{exports,require:id=>{if(!(id in mocks))throw Error(id);return mocks[id];}});return exports;}
const colours=load('services/textContrast.ts'),themes=load('services/appTheme.ts');
function runtime(id){
 const react={createContext:value=>{const ctx={value};ctx.Provider={ctx};return ctx;},useContext:ctx=>ctx.value,forwardRef:fn=>fn,createElement:(type,props,...children)=>({type,props:{...props,children}})};
 const flatten=style=>Array.isArray(style)?Object.assign({},...style.filter(Boolean).map(flatten)):style||{};
 const native={View:'View',Text:'Text',TextInput:'Input',Pressable:'Pressable',TouchableOpacity:'Touch',ScrollView:'Scroll',Animated:{View:'AnimatedView'},StyleSheet:{flatten}};
 const mocks={react,'react-native':native,'react-native-safe-area-context':{SafeAreaView:'SafeArea'},'../services/textContrast':colours,'../services/appTheme':themes,'../context/ThemeContext':{useTheme:()=>({palette:themes.appThemes[id],fontsLoaded:false})}};
 mocks['../context/SurfaceContext']=load('context/SurfaceContext.ts',mocks);
 const surfaces=load('components/ThemeSurfaces.tsx',mocks),text=load('components/ThemePrimitives.tsx',mocks);const leaves=[];
 function render(node){if(Array.isArray(node)){node.forEach(render);return;}if(!node||typeof node!=='object')return;if(typeof node.type==='function'){render(node.type(node.props,node.props.ref));return;}if(node.type?.ctx){const ctx=node.type.ctx,previous=ctx.value;ctx.value=node.props.value;render(node.props.children);ctx.value=previous;return;}
 if(['Text','Input'].includes(node.type))leaves.push({type:node.type,props:node.props,style:flatten(node.props.style),background:mocks['../context/SurfaceContext'].SurfaceContext.value,painted:mocks['../context/SurfaceContext'].SurfaceArtworkContext.value});
 render(node.type==='Pressable'&&typeof node.props.children[0]==='function'?node.props.children[0]({pressed:true}):node.props.children);
 }
 return {react,surfaces,text,leaves,render};
}
test('text resolves against actual surfaces across every non-original theme, retaining readable financial hues',()=>{
 for(const id of themes.themeIds.filter(x=>x!=='cream')){const p=themes.appThemes[id],r=runtime(id),h=r.react.createElement;
 for(const bg of [p.canvas,p.surface,p.surfaceAlt,p.hero,p.heroRaised,p.mint,p.accent,p.warningTint,p.coralTint,'#E8B84A','#8D9BFF'])for(const fg of [p.text,p.muted,p.onHero,p.heroMuted,p.mint,p.accent,p.expense,p.income,'#FFFFFF','#8FD6B4']){
 r.leaves.length=0;r.render(h(r.surfaces.ThemeView,{style:{backgroundColor:bg}},h(r.text.ThemeText,{style:{color:fg}},'Readable')));const actual=r.leaves[0];assert.ok(colours.textContrast(colours.solidColour(actual.style.color,bg),bg)>=4.5,`${id}: ${fg} on ${bg}`);if(colours.textContrast(fg,bg)>=4.5)assert.equal(actual.style.color,fg);
 }}
});
test('nested transparent and alpha cards use their painted background; inputs keep value/events/ref with readable placeholder',()=>{
 const r=runtime('arsenal'),h=r.react.createElement,ref={},change=()=>{};
 r.render(h(r.surfaces.ThemeView,{style:{backgroundColor:'#981326'}},h(r.surfaces.ThemeView,{style:{backgroundColor:'rgba(255,255,255,.9)'}},h(r.text.ThemeText,{style:{color:'#FFFFFF'}},'Label'),h(r.text.ThemeTextInput,{ref,value:'30',onChangeText:change,selection:{start:1,end:1},placeholderTextColor:'#FFF6DF',style:{backgroundColor:'#EEE7DA',color:'#FFF6DF'}}))));
 const [label,input]=r.leaves;assert.ok(colours.textContrast(label.style.color,label.background)>=4.5);assert.equal(input.props.ref,ref);assert.equal(input.props.value,'30');assert.equal(input.props.onChangeText,change);assert.equal(input.props.selection.start,1);assert.ok(colours.textContrast(input.style.color,'#EEE7DA')>=4.5);assert.ok(colours.textContrast(input.props.placeholderTextColor,'#EEE7DA')>=4.5);
});
test('pressed callback surface and native event props are preserved; Original retains literal text colours',()=>{
 const r=runtime('liverpool'),h=r.react.createElement,press=()=>{},ref={};const tree=r.surfaces.ThemePressable({style:state=>({backgroundColor:state.pressed?'#981326':'#FFFFFF'}),onPress:press,children:h(r.text.ThemeText,{style:{color:'#981326'}},'Save')},ref);assert.equal(tree.props.ref,ref);assert.equal(tree.props.onPress,press);r.render(tree);assert.ok(colours.textContrast(r.leaves[0].style.color,'#981326')>=4.5);
 const original=runtime('cream');original.render(original.react.createElement(original.surfaces.ThemeView,{style:{backgroundColor:'#FFFFFF'}},original.react.createElement(original.text.ThemeText,{style:{color:'#FFFFFF'}},'Original')));assert.equal(original.leaves[0].style.color,'#FFFFFF');
});
test('Cutie small/muted/financial text and inputs pass on bare, black and white image pixels',()=>{
 const p=themes.appThemes.cutie;
 for(const bg of [p.canvas,p.surface,p.surfaceAlt,p.hero]){
  for(const fg of [p.text,p.muted,p.onHero,p.heroMuted,p.accent,p.mint,p.expense,p.income,p.transfer,'#000000','#FFFFFF']){
   const r=runtime('cutie'),h=r.react.createElement;
   const tree=h(r.surfaces.ThemeView,{artworkAlpha:.30,style:{backgroundColor:bg}},
    h(r.surfaces.ThemeView,{style:{backgroundColor:'transparent'}},
     h(r.text.ThemeText,{style:{color:fg,fontSize:10}},'Small label'),
     h(r.text.ThemeTextInput,{value:'30',placeholder:'Minutes',placeholderTextColor:fg,style:{color:fg,backgroundColor:'transparent'}})));
   r.render(tree);assert.equal(tree.props.artworkAlpha,.30);
   for(const leaf of r.leaves)for(const painted of leaf.painted){
    assert.ok(colours.textContrast(leaf.style.color,painted)>=4.5,`${fg} on ${bg}, painted ${painted}`);
    if(leaf.type==='Input')assert.ok(colours.textContrast(leaf.props.placeholderTextColor,painted)>=4.5);
   }
  }
 }
});
test('opaque and alpha controls over artwork resolve their own background; preview works while Original is active',()=>{
 const p=themes.appThemes.cutie,r=runtime('cutie'),h=r.react.createElement;
 const native=r.surfaces.ThemeView({artworkAlpha:.30,style:{backgroundColor:p.hero},children:'test'});
 assert.equal(native.props.artworkAlpha,undefined,'custom metadata must not reach Android views');
 r.render(h(r.surfaces.ThemeView,{artworkAlpha:.30,style:{backgroundColor:p.hero}},
  h(r.surfaces.ThemeView,{style:{backgroundColor:p.mint}},h(r.text.ThemeText,{style:{color:p.onHero}},'Button')),
  h(r.surfaces.ThemeView,{style:{backgroundColor:'rgba(255,255,255,.9)'}},h(r.text.ThemeText,{style:{color:p.heroMuted}},'Overlay'))));
 for(const leaf of r.leaves)for(const bg of leaf.painted)assert.ok(colours.textContrast(leaf.style.color,bg)>=4.5);
 const preview=runtime('cream'),hp=preview.react.createElement;
 preview.render(hp(preview.text.ThemeTypographyPreview,{id:'cutie'},hp(preview.surfaces.ThemeView,{artworkAlpha:.30,style:{backgroundColor:p.hero}},hp(preview.text.ThemeText,{style:{color:p.heroMuted}},'Candidate'))));
 for(const bg of preview.leaves[0].painted)assert.ok(colours.textContrast(preview.leaves[0].style.color,bg)>=4.5);
});
