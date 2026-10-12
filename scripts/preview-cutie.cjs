// Render the actual palette/artwork as a contact sheet, not a phone screenshot.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),sharp=require('sharp');
const root=path.join(__dirname,'..');
function load(file,mocks={}){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports,require:id=>mocks[id]});return module.exports;}
const themes=load('services/appTheme.ts');
const art=load('services/themeArtwork.ts',{'./appTheme':themes,'./themeMotifs':load('services/themeMotifs.ts',{'./appTheme':themes}),'./characterImageData':load('services/characterImageData.ts'),'./cutieImageData':load('services/cutieImageData.ts')});
const p=themes.appThemes.cutie;
(async()=>{
 const overlays=[];
 const places=['home','log','progress','coach','drawer','widget','account'];
 for(const [i,place]of places.entries()){
  const x=24+(i%4)*250,y=120+Math.floor(i/4)*270;
  const hero=place==='home'||place==='progress';
  const artwork=art.themeArtwork('cutie',place,hero).svg;
  const card=`<svg xmlns="http://www.w3.org/2000/svg" width="232" height="250"><rect width="232" height="250" rx="24" fill="${hero?p.hero:p.surface}"/><g opacity="0.30"><svg x="24" y="45" width="208" height="208" viewBox="0 0 320 320">${artwork}</svg></g><text x="20" y="35" font-family="Segoe UI,sans-serif" font-size="17" font-weight="700" fill="${hero?p.onHero:p.text}">${place==='widget'?'Daily widget':place[0].toUpperCase()+place.slice(1)}</text></svg>`;
  overlays.push({input:await sharp(Buffer.from(card)).png().toBuffer(),left:x,top:y});
 }
 const colours=[p.accent,p.mint,'#68B5E9',p.hero];
 const title=`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="680"><rect width="1024" height="680" fill="${p.canvas}"/><text x="30" y="58" font-family="Segoe UI,sans-serif" font-size="40" font-weight="700" fill="${p.text}">Cutie</text><text x="30" y="88" font-family="Segoe UI,sans-serif" font-size="16" fill="${p.muted}">Artwork + palette preview · original supplied images</text>${colours.map((c,i)=>`<circle cx="${810+i*48}" cy="55" r="18" fill="${c}"/>`).join('')}<text x="780" y="490" font-family="Segoe UI,sans-serif" font-size="18" font-weight="700" fill="${p.accent}">Pink. Sunshine. Smiles.</text><text x="780" y="520" font-family="Segoe UI,sans-serif" font-size="14" fill="${p.muted}">Bundled offline</text></svg>`;
 const out=path.resolve(root,'../../outputs/cutie-theme-preview.png');
 await sharp(Buffer.from(title)).composite(overlays).png().toFile(out);console.log(out);
})();
