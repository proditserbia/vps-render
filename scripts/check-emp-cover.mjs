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
const out=path.join(root,'out/emp-cover-check');
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
    else if(url.pathname==='/uploads/mix.wav') relative='mix.wav';
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
    const file=relative==='mix.wav' ? path.join(out,relative) : path.join(root,'public',relative);
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


execFileSync(process.env.FFMPEG_PATH??'C:/Portable/ffmpeg/bin/ffmpeg.exe',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','sine=frequency=600:duration=16:sample_rate=48000','-c:a','pcm_s16le',path.join(out,'mix.wav')]);
let browser;
const catalog=JSON.parse(await fs.readFile('src/empOutputs.json','utf8'));
const input={artistName:'Artwork Only',songTitle:'No PMV supplied',pillCopy:'New Single',featuredArtistImage:origin+'/uploads/artist.jpg'};
try {
 const serveUrl=await bundle({entryPoint:path.join(root,'src/index.ts'),outDir:path.join(out,'bundle'),publicDir:path.join(out,'empty-public'),webpackOverride:c=>({...c,plugins:[...(c.plugins??[]),new webpack.NormalModuleReplacementPlugin(/dooh-storage\.json$/,r=>{r.request=localConfig;})]})});
 browser=await openBrowser('chrome',{browserExecutable:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 for(const [variant,spec] of Object.entries(catalog)) {
  const inputProps={...input,outputVariant:variant,
   ...(variant==='landscape-10'?{fullAudio10:origin+'/uploads/mix.wav'}:{}),
   ...(variant==='social-15'?{fullAudio15:origin+'/uploads/mix.wav'}:{}),
   ...(variant==='landscape-15'?{artistLiner:origin+'/uploads/liner.wav'}:{})};
  const composition=await selectComposition({serveUrl,id:'emp-v1',inputProps,puppeteerInstance:browser});
  const outputLocation=path.join(out,variant+'.'+spec.format);
  if(spec.format==='png')await renderStill({serveUrl,composition,inputProps,frame:0,output:outputLocation,puppeteerInstance:browser});
  else {
   let last=-1;
   await renderMedia({serveUrl,composition,inputProps,outputLocation,puppeteerInstance:browser,codec:'h264',scale:0.25,crf:25,audioBitrate:'192k',concurrency:2,imageFormat:'jpeg',jpegQuality:85,x264Preset:'ultrafast',onProgress:({progress})=>{const p=Math.floor(progress*4);if(p!==last){last=p;console.log(variant+' '+p*25+'%');}}});
  }
  console.log('PASS '+variant);
 }
 assert.deepEqual(failures,[]);
 assert.ok(![...requests].some(url=>url.includes('video.mp4')),'Artwork-only mode must not request any video');
 await fs.writeFile(path.join(out,'report.json'),JSON.stringify({outputs:6,videoSupplied:false,requests:[...requests],failures,audioCases:{'landscape-10':'full-mix','landscape-15':'voice-liner','social-10':'none','social-15':'full-mix'}},null,2));
}finally{if(browser)await browser.close({silent:true});server.closeAllConnections();server.close();}