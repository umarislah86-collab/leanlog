const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),sharp=require('sharp'),React=require('react');
const moduleData={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('services/nativeArtwork.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:moduleData,exports:moduleData.exports});
const {nativeArtwork}=moduleData.exports;
test('every native character/page and widget has real nonempty transparent PNG pixels',async()=>{
 for(const id of ['grandline','saiyan','cutie'])for(const place of ['home','log','progress','coach','drawer','widget','account','cash','quick','upcoming']){
  const art=nativeArtwork(id,place);assert.ok(art,id+'/'+place);
  for(const key of ['uri','widget']){
   const buffer=Buffer.from(art[key].split(',')[1],'base64');
   assert.equal(buffer.subarray(1,4).toString(),'PNG');
   const {data,info}=await sharp(buffer).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   assert.equal(info.width,320);assert.equal(info.height,320);
   let visible=0,max=0,transparent=0;for(let i=3;i<data.length;i+=4){max=Math.max(max,data[i]);if(data[i]>10)visible++;if(data[i]===0)transparent++;}
   assert.ok(visible>2000,id+'/'+place+'/'+key+' blank');
   assert.ok(transparent>100,id+'/'+place+' missing transparent edges');
   if(key==='widget')assert.ok(max<=61&&max>=50,'baked widget opacity');
  }
 }
 assert.equal(nativeArtwork('arsenal','home'),undefined);
});
test('native app artwork uses Image, while vector themes retain SvgXml',()=>{
 const mod={exports:{}},Image=()=>{},SvgXml=()=>{};
 const themes={appThemes:{},themeMotif:()=>({svg:'<svg/>',ratio:1})};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/ThemeMotif.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,{module:mod,exports:mod.exports,require:id=>({'react':React,'react-native':{Image,View:()=>{}},'react-native-svg':{SvgXml},'../services/nativeArtwork':{nativeArtwork},'../services/themeArtwork':{themeArtwork:themes.themeMotif},'../services/themeMotifs':themes})[id]});
 for(const id of ['grandline','saiyan','cutie']){const node=mod.exports.ThemeMotif({id,artwork:'drawer',size:64});assert.equal(node.type,Image);assert.match(node.props.source.uri,/^data:image\/png;base64,/);assert.equal(node.props.resizeMode,'contain');}
 assert.equal(mod.exports.ThemeMotif({id:'arsenal'}).type,SvgXml);
});
