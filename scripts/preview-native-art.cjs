const fs=require('fs'),vm=require('vm'),ts=require('typescript'),sharp=require('sharp');
const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('services/nativeArtwork.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:m,exports:m.exports});
(async()=>{const overlays=[];for(const [i,id]of ['grandline','saiyan','cutie'].entries())for(const [j,place]of ['home','drawer','widget'].entries()){
 const a=m.exports.nativeArtwork(id,place);const b=Buffer.from(a[place==='widget'?'widget':'uri'].split(',')[1],'base64');
 overlays.push({input:await sharp(b).resize(200,200).toBuffer(),left:30+i*240,top:45+j*235});
 }await sharp({create:{width:740,height:750,channels:4,background:'#eee4e8'}}).composite(overlays).png().toFile('../../outputs/native-art-fix-preview.png');})();
