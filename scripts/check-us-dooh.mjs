import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {openBrowser,selectComposition,renderStill} from '@remotion/renderer';

const cwd=process.cwd();
const catalog=JSON.parse(await fs.readFile('src/usDoohOutputs.json','utf8'));
const example=JSON.parse(await fs.readFile('fixtures/artist-godzilla.json','utf8'));
const inputProps={outputVariant:'flat'};
for (const key of ['artistName','songTitle','pillCopy']) inputProps[key]={type:'text',value:example[key]};
inputProps.featuredArtistImage={type:'image',uri:example.featuredArtistImage};
inputProps.featuredVideo={type:'video',uri:example.featuredVideo};
const out=path.join(cwd,'out/us-dooh-integration');
await fs.mkdir(out,{recursive:true});
const serveUrl=await bundle({entryPoint:path.join(cwd,'src/index.ts')});
const browser=await openBrowser('chrome',{
  browserExecutable:process.env.GODZILLA_BROWSER ?? (process.platform==='win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined),
});
const report=[];
try {
  for (const family of ['la','ny']) {
    const id=`us-dooh-${family}-test-v1`;
    const manifest=JSON.parse(await fs.readFile(`../templates/${id}.json`,'utf8'));
    assert.equal(manifest.remotionCompositionId,id);
    assert.deepEqual(manifest.slots.find(s=>s.slotId==='outputVariant').options.map(o=>o.value),Object.keys(catalog[family]));
    for (const [variant,spec] of Object.entries(catalog[family])) {
      const props={...inputProps,outputVariant:variant};
      const composition=await selectComposition({serveUrl,id,inputProps:props,puppeteerInstance:browser});
      for (const key of ['width','height','fps','durationInFrames']) assert.equal(composition[key],spec[key],`${family}/${variant}/${key}`);
      assert.equal(composition.durationInFrames/composition.fps,15);
      report.push({family,variant,...spec});
      if (['flat','static','static-insitu','social'].includes(variant)) await renderStill({serveUrl,composition,inputProps:props,frame:variant==='static'?25:267,imageFormat:variant==='static'?'jpeg':'png',output:path.join(out,`${family}-${variant}.${variant==='static'?'jpg':'png'}`),puppeteerInstance:browser});
    }
    await assert.rejects(()=>selectComposition({serveUrl,id,inputProps:{...inputProps,outputVariant:'__proto__'},puppeteerInstance:browser}), /Unsupported/);
    await assert.rejects(()=>selectComposition({serveUrl,id,inputProps:{...inputProps,artistName:{type:'text',value:''}},puppeteerInstance:browser}), /Invalid artistName/);
    await assert.rejects(()=>selectComposition({serveUrl,id,inputProps:{...inputProps,featuredVideo:{type:'video',uri:'test.mp4',trim_start_seconds:2}},puppeteerInstance:browser}), /trim offsets/);
  }
  assert.equal(Object.entries(catalog.ny).filter(([k])=>k.startsWith('panel')).reduce((sum,[,v])=>sum+v.width,0),12552);
  await fs.writeFile(path.join(out,'validation.json'),JSON.stringify({outputs:report,invalidInputsRejected:true},null,2));
  console.log(`PASS: ${report.length} output profiles, manifest contracts, invalid inputs, panel widths, and both Flat still renders.`);
} finally {
  await browser.close({silent:true});
}
