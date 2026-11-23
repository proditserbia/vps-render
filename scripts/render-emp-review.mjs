import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {bundle} from '@remotion/bundler';
import {openBrowser, selectComposition, renderStill, renderMedia} from '@remotion/renderer';

// Local transport test: no Firebase reads or writes, and no bundled public assets.
const require=createRequire(import.meta.url);
const webpack=require('webpack');
const root=process.cwd();
const out=path.join(root,process.env.EMP_FULL_MIX==='1'?'out/emp-fullmix-test':process.env.EMP_LONG==='1'?'out/emp-longtext-v2':'out/emp-review-v3-final');
await fs.mkdir(path.join(out,'empty-public'),{recursive:true});
const config=JSON.parse(await fs.readFile('src/dooh-storage.json','utf8'));
const files=JSON.parse(await fs.readFile('src/dooh-static-files.json','utf8'));
const allowed=new Set(files);
const requests=new Set();
const failures=[];
const mime={'.png':'image/png','.jpg':'image/jpeg','.ttf':'font/ttf','.mp4':'video/mp4','.m4a':'audio/mp4'};
const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    requests.add(url.pathname);
    let relative;
    if(url.pathname==='/uploads/artist.jpg') relative='assets/emp/artist.jpg';
    else if(url.pathname==='/uploads/liner.wav') relative='assets/emp/liner.wav';
    else if(url.pathname==='/uploads/video.mp4') relative='assets/emp/video.mp4';
    else {
      const prefix=`/v0/b/${config.bucket}/o/`;
      assert.ok(url.pathname.startsWith(prefix),'Unexpected asset URL');
      const object=decodeURIComponent(url.pathname.slice(prefix.length));
      assert.ok(object.startsWith(`${config.prefix}/`));
      relative=object.slice(config.prefix.length+1);
      assert.ok(allowed.has(relative),`Unlisted asset: ${relative}`);
    }
    const file=path.join(root,'public',relative);
    const {size}=await fs.stat(file);
    let start=0,end=size-1,status=200;
    if(req.headers.range){
      const match=/bytes=(\d+)-(\d*)/.exec(req.headers.range);
      assert.ok(match);
      start=Number(match[1]); end=match[2]?Math.min(Number(match[2]),size-1):size-1; status=206;
      res.setHeader('Content-Range',`bytes ${start}-${end}/${size}`);
    }
    res.writeHead(status,{'Access-Control-Allow-Origin':'*','Accept-Ranges':'bytes','Content-Type':mime[path.extname(file)]??'application/octet-stream','Content-Length':end-start+1});
    if(req.method==='HEAD')res.end(); else createReadStream(file,{start,end}).pipe(res);
  }catch(error){failures.push(String(error));res.writeHead(404);res.end(String(error));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const localConfig=path.join(out,'test-storage.json');
await fs.writeFile(localConfig,JSON.stringify({...config,origin}));


let browser;
const catalog=JSON.parse(await fs.readFile('src/empOutputs.json','utf8'));
const input={artistName:'Gracie Abrams',songTitle:'Look at My Life',pillCopy:'New Song',featuredArtistImage:origin+'/uploads/artist.jpg',featuredVideo:origin+'/uploads/video.mp4',artistLiner:origin+'/uploads/liner.wav'};
if(process.env.EMP_LONG==='1')Object.assign(input,{artistName:'King Gizzard & the Lizard Wizard',songTitle:'The Destruction of the Universe and Everything in Between',pillCopy:'New Album Available Now',verticalArtist:'King Gizzard &\nthe Lizard Wizard',verticalTitle:'The Destruction of the Universe\nand Everything in Between',textColor:'#ffe49b',bannerColor:'#142467'});
if(process.env.EMP_FULL_MIX==='1')Object.assign(input,{fullAudio10:origin+'/uploads/video.mp4',artistLiner:origin+'/uploads/missing.wav'});
try {
 const serveUrl=await bundle({entryPoint:path.join(root,'src/index.ts'),outDir:path.join(out,'bundle'),publicDir:path.join(out,'empty-public'),webpackOverride:c=>({...c,plugins:[...(c.plugins??[]),new webpack.NormalModuleReplacementPlugin(/dooh-storage\.json$/,r=>{r.request=localConfig;})]})});
 browser=await openBrowser('chrome',{browserExecutable:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 for(const [variant,spec] of Object.entries(catalog).filter(([v])=>!process.env.EMP_VARIANTS || process.env.EMP_VARIANTS.split(',').includes(v))){
  const inputProps={...input,outputVariant:variant};
  const composition=await selectComposition({serveUrl,id:'emp-v1',inputProps,puppeteerInstance:browser});
  if(process.env.EMP_STILLS==='1'){
   for(const frame of spec.format==='png'?[0]:(process.env.EMP_FRAMES ? process.env.EMP_FRAMES.split(',').map(Number) : process.env.EMP_LONG==='1'?[135,285]:[0,6,9,12,15,24,30,135,225,285,...(spec.durationInFrames===450?[345,420]:[])])){
    await renderStill({serveUrl,composition,inputProps,frame,imageFormat:'png',output:path.join(out,variant+'-'+frame+'.png'),puppeteerInstance:browser});
   }
  }else{
   const outputLocation=path.join(out,variant+'.'+spec.format);
   if(spec.format==='png')await renderStill({serveUrl,composition,inputProps,frame:0,imageFormat:'png',output:outputLocation,puppeteerInstance:browser});
   else await renderMedia({serveUrl,composition,inputProps,outputLocation,puppeteerInstance:browser,...(process.env.EMP_FULL_MIX==='1'?{frameRange:[0,59]}:{}),codec:'h264',pixelFormat:'yuv420p',videoBitrate:'15M',audioBitrate:'320k',concurrency:3,offthreadVideoThreads:2,imageFormat:'jpeg',jpegQuality:95,x264Preset:'fast',onProgress:({progress})=>{if(Math.floor(progress*100)%20===0)console.log(variant+' '+Math.floor(progress*100)+'%');}});
  }
  console.log('DONE '+variant);
 }
 assert.deepEqual(failures,[]);
}finally{if(browser)await browser.close({silent:true});server.closeAllConnections();server.close();}
