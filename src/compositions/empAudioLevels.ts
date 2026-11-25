import {interpolate} from 'remotion';
const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;
export const EMP_VOICE_GAIN=1.15;
export const EMP_DUCKED_MUSIC_GAIN=0.25*0.85;

export function empVoiceLevel(frame:number,fps:number,duration:number) {
  if(duration<=0)return 0;
  const fade=Math.min(0.02,duration/4);
  return interpolate(frame/fps,[0,fade,duration-fade,duration],[0,EMP_VOICE_GAIN,EMP_VOICE_GAIN,0],clamp);
}

export function empMusicLevel(frame:number,fps:number,durationInFrames:number,voiceDuration:number,short:boolean,hasLiner:boolean) {
  const time=frame/fps;
  const voiceStart=Math.round((short?0.55:4.04)*fps)/fps;
  const end=durationInFrames/fps;
  const duck=hasLiner && voiceDuration>0
    ? interpolate(time,[voiceStart-0.18,voiceStart,voiceStart+voiceDuration,voiceStart+voiceDuration+0.3],
      [0.8,EMP_DUCKED_MUSIC_GAIN,EMP_DUCKED_MUSIC_GAIN,0.8],clamp)
    : 0.8;
  return duck*interpolate(time,[0,0.08,end-0.35,end],[0,1,1,0],clamp);
}
