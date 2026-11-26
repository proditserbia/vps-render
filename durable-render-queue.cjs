'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));return value;}
const keyOf=job=>`${job.jobId}:${job.attempt??0}`;
class DurableRenderQueue {
  constructor(directory){
    this.directory=path.resolve(directory);fs.mkdirSync(this.directory,{recursive:true,mode:0o700});
    this.file=path.join(this.directory,'queue.json');
    this.state=fs.existsSync(this.file)?JSON.parse(fs.readFileSync(this.file,'utf8')):{version:1,records:{}};
    if(this.state.version!==1||!this.state.records||Array.isArray(this.state.records))throw new Error('Invalid durable render queue; refusing to discard it');
    for(const [key,r] of Object.entries(this.state.records)){
      if(!r.job||keyOf(r.job)!==key||!['queued','rendering','callback','done'].includes(r.state)||!r.fingerprint)throw new Error('Invalid queue record: '+key);
      if(r.state==='callback'&&!r.result)throw new Error('Missing callback payload: '+key);
    }
    this.commit(state=>{for(const r of Object.values(state.records)){if(r.state==='rendering'){r.state='queued';r.recoveries=(r.recoveries??0)+1;}if(r.state==='callback')r.nextAt=0;}});
  }
  commit(change){
    const next=JSON.parse(JSON.stringify(this.state));change(next);
    const temp=this.file+'.tmp';const fd=fs.openSync(temp,'w',0o600);
    try{fs.writeFileSync(fd,JSON.stringify(next));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
    fs.renameSync(temp,this.file);
    // Make the rename durable on Linux, where the production worker runs.
    if(process.platform!=='win32'){const dir=fs.openSync(this.directory,'r');try{fs.fsyncSync(dir);}finally{fs.closeSync(dir);}}
    this.state=next;
  }
  enqueue(job){
    const normalized=JSON.parse(JSON.stringify({...job,attempt:job.attempt??0}));
    if(!normalized.attempt)delete normalized.attempt;
    const key=keyOf(normalized),fingerprint=crypto.createHash('sha256').update(JSON.stringify(stable(normalized))).digest('hex');
    const found=this.state.records[key];
    if(found){if(found.fingerprint!==fingerprint){const e=new Error('Same job attempt has different inputs');e.status=409;throw e;}return {duplicate:true,state:found.state};}
    this.commit(state=>{
      // Retain completed receipts for 7 days to deduplicate delayed HTTP retries.
      for(const [k,r] of Object.entries(state.records))if(r.state==='done'&&r.completedAt<Date.now()-7*86400000)delete state.records[k];
      state.records[key]={job:normalized,fingerprint,state:'queued',createdAt:Date.now(),recoveries:0};
    });
    return {duplicate:false,state:'queued'};
  }
  next(now=Date.now()){return Object.values(this.state.records).filter(r=>r.state==='queued'||r.state==='callback'&&(r.nextAt??0)<=now).sort((a,b)=>a.createdAt-b.createdAt)[0]??null;}
  update(job,change){this.commit(s=>change(s.records[keyOf(job)]));}
  start(job){this.update(job,r=>{r.state='rendering';});}
  result(job,result){this.update(job,r=>{r.state='callback';r.result=result;r.nextAt=0;});}
  defer(job){this.update(job,r=>{r.state='callback';r.nextAt=Date.now()+60000;r.callbackRetries=(r.callbackRetries??0)+1;});}
  redo(job){this.update(job,r=>{r.state='queued';delete r.result;});}
  done(job){this.update(job,r=>{r.state='done';r.completedAt=Date.now();r.job={jobId:r.job.jobId,...(r.job.attempt?{attempt:r.job.attempt}:{})};delete r.result;});}
  pending(){return Object.values(this.state.records).filter(r=>r.state!=='done');}
  snapshot(){const records=this.pending();return {durable:true,queued:records.filter(r=>r.state==='queued').length,rendering:records.filter(r=>r.state==='rendering').length,callbacksPending:records.filter(r=>r.state==='callback').length,jobs:records.map(r=>({jobId:r.job.jobId,attempt:r.job.attempt??null,state:r.state,recoveries:r.recoveries}))};}
}
module.exports={DurableRenderQueue,keyOf};
