const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
function load(file){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,jsx:ts.JsxEmit.React}}).outputText,{exports,require:name=>name==='react'?{}:name==='remotion'?{}:name==='../doohAssets'?{}:name.endsWith('.json')?JSON.parse(fs.readFileSync(path.resolve(path.dirname(file),name),'utf8')):load(path.resolve(path.dirname(file),name+'.ts'))});return exports;}
const {empCopyMotion}=load(path.join(root,'src/compositions/EmpMotion.tsx'));
for(const profile of ['landscape-10','landscape-15','social-10','social-15'])for(const part of ['artist','title','pill']){
 assert.equal(empCopyMotion(profile,part,-1).opacity,0);
 for(let frame=0;frame<=75;frame++){
  const style=empCopyMotion(profile,part,frame/30);
  const values=style.transform.slice(9,-1).split(',').map(Number);
  assert.equal(values.length,16);assert.ok(values.every(Number.isFinite),`${profile}/${part}/${frame}`);assert.ok(style.opacity>=0&&style.opacity<=1);
 }
 const settled=empCopyMotion(profile,part,2.5).transform.slice(9,-1).split(',').map(Number);
 const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
 settled.forEach((v,i)=>assert.ok(Math.abs(v-identity[i])<1e-7));
}
const data=JSON.parse(fs.readFileSync(path.join(root,'src/data/emp-motion.json'),'utf8'));
for(const rows of Object.values(data.logo)){assert.equal(rows.length,62);rows.forEach((row,i)=>{assert.equal(row[0],i);assert.ok(row.every(Number.isFinite));});}
assert.ok(data.logo.icon.find(r=>r.at(-1)>0)[0]<data.logo.word.find(r=>r.at(-1)>0)[0]);
console.log('PASS: all copy motion frames finite, independent entry, exact settled layout; tracked logo sequence valid');

