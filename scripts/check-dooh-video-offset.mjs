import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
import {bundle} from '@remotion/bundler';
import {openBrowser, selectComposition, renderStill} from '@remotion/renderer';

// Local transport test: no Firebase reads or writes, and no bundled public assets.
const require=createRequire(import.meta.url);
const webpack=require('webpack');
const root=process.cwd();
const out=path.join(root,'out/dooh-video-offset-check');
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
    if(url.pathname==='/uploads/artist.jpg') relative='assets/la-sunset/artist.jpg';
    else if(url.pathname==='/uploads/video.mp4') relative='assets/la-sunset/video.mp4';
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
try {
  const serveUrl=await bundle({entryPoint:path.join(root,'src/index.ts'),outDir:path.join(out,'bundle'),publicDir:path.join(out,'empty-public'),webpackOverride:configuration=>({...configuration,plugins:[...(configuration.plugins??[]),new webpack.NormalModuleReplacementPlugin(/dooh-storage\.json$/,resource=>{resource.request=localConfig;})]})});
  browser=await openBrowser('chrome',{browserExecutable:process.env.REMOTION_BROWSER??'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const props={songTitleColor:{type:'text',value:'#e34b18'},artistName:{type:'text',value:'The Dogs Are Out'},songTitle:{type:'text',value:'Chilling by the fan'},pillCopy:{type:'text',value:'Debut Soon'},featuredArtistImage:{type:'image',uri:`${origin}/uploads/artist.jpg?token=test-image`},featuredVideo:{type:'video',uri:`${origin}/uploads/video.mp4?token=test-video`}};
  const cases=[['la','flat',240],['ny','flat',240],['mega','flat',240],['la','motion',480]];
  for(const [family,variant,frame] of cases){
    for(const offset of [0,2000]) {
      const inputProps={...props,outputVariant:variant,videoStartMs:{type:'number',value:offset}};
      const composition=await selectComposition({serveUrl,id:`us-dooh-${family}-test-v1`,inputProps,puppeteerInstance:browser});
      await renderStill({serveUrl,composition,inputProps,frame,scale:0.3,output:path.join(out,`${family}-${variant}-${offset}.png`),puppeteerInstance:browser});
      console.log(`PASS ${family}/${variant}/${offset}ms`);
    }
  }
  const badProps={...props,outputVariant:'flat',videoStartMs:{type:'number',value:4000}};
  const composition=await selectComposition({serveUrl,id:'us-dooh-la-test-v1',inputProps:badProps,puppeteerInstance:browser});
  await assert.rejects(renderStill({serveUrl,composition,inputProps:badProps,frame:240,scale:0.3,output:path.join(out,'invalid.png'),browserExecutable:process.env.REMOTION_BROWSER??'C:/Program Files/Google/Chrome/Application/chrome.exe'}),/at least 11 seconds/);
  console.log('PASS insufficient remaining footage rejected');
  assert.deepEqual(failures,[]);
  // These checkpoints are in the video section; the photo need not be fetched.
  assert.ok(requests.has('/uploads/video.mp4'));
  await fs.writeFile(path.join(out,'report.json'),JSON.stringify({cases,failures,requests:[...requests],publicAssetsBundled:false},null,2));
  console.log('PASS: remote static paths and uploaded media, with empty public directory.');
}finally{
  if(browser)await browser.close({silent:true});
  server.closeAllConnections();server.close();
}

