import React, {useEffect,useState} from 'react';
import {OffthreadVideo,cancelRender,delayRender,continueRender,useVideoConfig} from 'remotion';

type Props = Omit<React.ComponentProps<typeof OffthreadVideo>, 'trimBefore' | 'startFrom'> & {videoStartMs?:number};
/** Offset is relative to the first visible footage frame, not the animation clock.
 * Street footage and ambient audio are deliberately outside this component. */
export const DoohVideo:React.FC<Props> = ({videoStartMs=0,...props}) => {
  const {fps}=useVideoConfig();
  const [ready,setReady]=useState(videoStartMs===0);
  const [initial]=useState(()=>delayRender('Validate DOOH source offset'));
  useEffect(()=>{
    const handle=delayRender('Read DOOH source duration');
    let active=true;
    const finish=(error?:Error)=>{
      if(!active)return;
      if(error)cancelRender(error); else {setReady(true);continueRender(handle);continueRender(initial);}
    };
    if(!Number.isSafeInteger(videoStartMs)||videoStartMs<0){finish(new Error('Invalid videoStartMs'));return;}
    if(videoStartMs===0){finish();return;}
    const video=document.createElement('video');
    const timer=setTimeout(()=>finish(new Error('Could not read video duration for the selected start time')),15000);
    video.onloadedmetadata=()=>{
      clearTimeout(timer);
      finish(Number.isFinite(video.duration)&&video.duration+0.001>=videoStartMs/1000+11 ? undefined
        :new Error('Choose a video start with at least 11 seconds of footage remaining'));
    };
    video.onerror=()=>{clearTimeout(timer);finish(new Error('Cannot read the uploaded video'));};
    video.preload='metadata';video.src=props.src;
    return ()=>{active=false;clearTimeout(timer);video.onloadedmetadata=null;video.onerror=null;video.removeAttribute('src');video.load();continueRender(handle);continueRender(initial);};
  },[videoStartMs,props.src,initial]);
  if (!ready) return null;
  return <OffthreadVideo {...props} trimBefore={Math.round(videoStartMs*fps/1000)} />;
};
