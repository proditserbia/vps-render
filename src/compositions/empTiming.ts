export const EMP_FPS = 30000 / 1001;
export const empStartKeys = ['emp10InMs', 'emp15InMs'] as const;
export function readEmpStart(value: unknown): number {
  if (value === undefined) return 0;
  const slot = value as {type?:unknown;value?:unknown};
  if (!slot || slot.type !== 'number' || !Number.isSafeInteger(slot.value) || (slot.value as number) < 0)
    throw new Error('EMP source start must be non-negative integer milliseconds');
  return slot.value as number;
}
export function empTiming(inMs:number, short:boolean) {
  if (!Number.isSafeInteger(inMs) || inMs < 0) throw new Error('Invalid EMP source start');
  const startFrame = Math.round(inMs * EMP_FPS / 1000);
  const durationInFrames = short ? 300 : 450;
  const revealFrame = Math.floor((short ? 3.3 : 6.8) * EMP_FPS);
  return {startFrame, durationInFrames, revealFrame,
    videoTrimBefore:startFrame + revealFrame,
    requiredSeconds:(startFrame + durationInFrames) / EMP_FPS};
}

// Used by calculateMetadata so server renders also reject insufficient source media.
export async function validateEmpSource(src:string, minimum:number):Promise<void> {
  await new Promise<void>((resolve,reject)=>{
    const media=document.createElement('video');
    const finish=(error?:Error)=>{
      clearTimeout(timer);media.onloadedmetadata=null;media.onerror=null;
      media.removeAttribute('src');media.load();
      if(error)reject(error);else resolve();
    };
    const timer=setTimeout(()=>finish(new Error('EMP source metadata timed out')),15000);
    media.onloadedmetadata=()=>finish(Number.isFinite(media.duration)&&media.duration+0.001>=minimum
      ? undefined : new Error(`EMP source needs at least ${minimum.toFixed(3)} seconds for the selected segment`));
    media.onerror=()=>finish(new Error('Cannot read the EMP source video'));
    media.preload='metadata';media.src=src;
  });
}
