const fs=require('fs'),vm=require('vm'),ts=require('typescript');const p={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/compositions/megaProjection.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:p});
const e=require('../src/data/megazilla-geometry.json').items.find(x=>x.id==='videoLogo');
const bounds=JSON.parse(fs.readFileSync('../../../tmp/mega-logo-bounds.json','utf8'));
const pixels=JSON.parse(fs.readFileSync('../../../tmp/mega-logo-red-pixels.json','utf8'));
const rows=bounds.map(([f,x0,y0,x1,y1])=>{
 const r=p.rowAt(e.rows,f);const h=p.homography(818,275,[r.slice(0,2),r.slice(2,4),r.slice(4,6),r.slice(6,8)]);
 const points=pixels.map(pt=>p.mapped(h,pt));const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 const left=Math.min(...xs),top=Math.min(...ys),right=Math.max(...xs),bottom=Math.max(...ys);
 const sx=2*(x1-x0)/(right-left),sy=2*(y1-y0)/(bottom-top),dx=x0*2-2352-sx*left,dy=y0*2-sy*top;
 const corrected=[sx*h[0]+dx*h[6],sx*h[1]+dx*h[7],sx*h[2]+dx*h[8],sy*h[3]+dy*h[6],sy*h[4]+dy*h[7],sy*h[5]+dy*h[8],...h.slice(6)];
 if(f===340)console.log({sx,sy,dx,dy});
 return [f,...[[0,0],[818,0],[0,275],[818,275]].flatMap(pt=>p.mapped(corrected,pt)),1];
});
// Rejoin the settled original track after the measured entrance.
rows.push(...e.rows.filter(r=>r[0]>=350));
fs.writeFileSync('src/compositions/megazilla-logo-entry.json',JSON.stringify(rows,null,2)+'\n');
