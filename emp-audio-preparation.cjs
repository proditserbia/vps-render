const fs=require('node:fs/promises');
const path=require('node:path');
const {promisify}=require('node:util');
const {execFile}=require('node:child_process');
const run=promisify(execFile);
const read=v=>typeof v==='string'?v:(v?.value??v?.uri??'');
const rate=48000;

async function normalizeTrack({ffmpeg,ffprobe,source,temp,name,start=0,duration,target}) {
  if(!source)return {uri:'',report:{name,missing:true}};
  const input=path.join(temp,name+'-input');
  const url=new URL(source);
  if(!['http:','https:'].includes(url.protocol))throw new Error('EMP audio input must be an HTTP(S) asset URL');
  const response=await fetch(url,{signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw new Error(`EMP ${name} download failed: HTTP ${response.status}`);
  const handle=await fs.open(input,'w');let size=0;
  try{for await(const chunk of response.body){size+=chunk.length;if(size>105*1024*1024)throw new Error('EMP audio input exceeds 105 MB');await handle.writeFile(chunk);}}finally{await handle.close();}
  const meta=JSON.parse((await run(ffprobe,['-v','error','-show_streams','-of','json',input])).stdout);
  if(!meta.streams.some(s=>s.codec_type==='audio'))return {uri:'',report:{name,noAudio:true}};
  const decoded=path.join(temp,name+'-decoded.wav');
  await run(ffmpeg,['-v','error','-y','-i',input,'-ss',String(start),'-t',String(duration),'-map','0:a:0','-vn','-ac','2','-ar',String(rate),'-c:a','pcm_s16le',decoded]);
  const wav=await fs.readFile(decoded);
  let raw=Buffer.alloc(0);
  for(let pos=12;pos+8<=wav.length;){const size=wav.readUInt32LE(pos+4);if(wav.toString('ascii',pos,pos+4)==='data'){raw=wav.subarray(pos+8,pos+8+size);break;}pos+=8+size+(size%2);}
  if(!raw.length)throw new Error('EMP decoded audio is empty');
  const peaks=[0,0];for(let i=0;i+3<raw.length;i+=4){peaks[0]=Math.max(peaks[0],Math.abs(raw.readInt16LE(i)/32768));peaks[1]=Math.max(peaks[1],Math.abs(raw.readInt16LE(i+2)/32768));}
  // Only repair a genuinely empty channel. Preserve normal stereo balance.
  const active=peaks[0]<.000032 && peaks[1]>.001?1:peaks[1]<.000032 && peaks[0]>.001?0:null;
  const pan=active===null?'':`pan=stereo|c0=c${active}|c1=c${active},`;
  const filter=`loudnorm=I=${target}:TP=-3:LRA=11`;
  const {stderr}=await run(ffmpeg,['-hide_banner','-i',decoded,'-af',pan+filter+':print_format=json','-f','null','-']);
  const match=stderr.match(/\{\s*"input_i"[\s\S]*?\}/);
  if(!match)throw new Error('EMP loudness measurement failed');
  const m=JSON.parse(match[0]);
  const finite=['input_i','input_tp','input_lra','input_thresh','target_offset'].every(k=>Number.isFinite(Number(m[k])));
  const measured=finite?`:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`:'';
  const output=path.join(temp,name+'-normalized.wav');
  await run(ffmpeg,['-v','error','-y','-i',decoded,'-af',pan+(finite?filter+measured:'anull'),'-ar',String(rate),'-ac','2','-c:a','pcm_s16le',output]);
  return {uri:'data:audio/wav;base64,'+(await fs.readFile(output)).toString('base64'),report:{name,inputLufs:m.input_i,targetLufs:finite?target:null,repairedChannel:active===null?null:active===0?'left-to-both':'right-to-both'}};
}

async function prepareEmpAudio({options,ffmpeg,ffprobe,temp}) {
  const props={...(options.inputProps??{})};
  // Never trust caller-provided internal prepared sources.
  for(const key of ['_empPreparedAudio','_empMusic','_empLiner'])delete props[key];
  const short=String(props.outputVariant??'').endsWith('-10');
  if(read(props[short?'fullAudio10':'fullAudio15']))return {props,reports:[{fullMix:true,normalization:'bypassed'}]};
  const fps=options.composition.fps;const duration=options.composition.durationInFrames/fps;
  const inMs=Number(read(props[short?'emp10InMs':'emp15InMs'])||0);
  if(!Number.isSafeInteger(inMs)||inMs<0)throw new Error('Invalid EMP source offset');
  const start=Math.round(inMs*fps/1000)/fps;
  const voiceStart=Math.round((short?.55:4.04)*fps)/fps;
  const music=await normalizeTrack({ffmpeg,ffprobe,source:read(props.featuredVideo),temp,name:'music',start,duration,target:-18});
  const voice=await normalizeTrack({ffmpeg,ffprobe,source:read(props.artistLiner),temp,name:'voice',duration:Math.max(.01,duration-voiceStart),target:-16});
  Object.assign(props,{_empPreparedAudio:'1',_empMusic:music.uri,_empLiner:voice.uri});
  return {props,reports:[music.report,voice.report]};
}
module.exports={prepareEmpAudio,normalizeTrack};
