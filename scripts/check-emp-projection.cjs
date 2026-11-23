const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
function load(file){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,jsx:ts.JsxEmit.React}}).outputText,{exports,require:name=>name==='react'?{}:name==='remotion'?{}:name==='../doohAssets'?{}:name.endsWith('.json')?JSON.parse(fs.readFileSync(path.resolve(path.dirname(file),name),'utf8')):load(path.resolve(path.dirname(file),name+'.ts'))});return exports;}
const {empPlaneAt}=load(path.join(root,'src/compositions/empProjection.ts'));
const {homography,mapped,rowAt}=load(path.join(root,'src/compositions/megaProjection.ts'));
const data=JSON.parse(fs.readFileSync(path.join(root,'src/data/emp-geometry.json')));
for(const [profile,scene] of Object.entries(data)) for(const p of scene.planes) {
 for(let f=0;f<scene.frames;f++) assert.ok(empPlaneAt(p,f,scene).h.every(Number.isFinite),`${profile}/${p.kind}/${f}`);
 for(const row of p.rows){
  const h=empPlaneAt(p,row[0],scene).h;
  [[0,0],[p.width,0],[0,p.height],[p.width,p.height]].forEach((pt,i)=>{
   const actual=mapped(h,pt);
   actual.forEach((v,j)=>assert.ok(Math.abs(v-row[1+2*i+j])<Math.max(.01,Math.abs(v)*1e-7),`sample changed: ${profile}/${p.kind}/${row[0]}`));
  });
 }
}
const p=data['landscape-10'].planes.find(p=>p.kind==='video');
for(const f of [99,117,231]) {
 const points=[f-1,f,f+1].map(fr=>mapped(empPlaneAt(p,fr,data["landscape-10"]).h,[p.width/2,p.height/2]));
 for(let i=0;i<2;i++)assert.ok(points[1][i]>=Math.min(points[0][i],points[2][i]) && points[1][i]<=Math.max(points[0][i],points[2][i]),`geometry jump at ${f}`);
}
console.log('PASS: all EMP frames finite; original samples preserved; frames 99/117/231 stay between adjacent camera positions');