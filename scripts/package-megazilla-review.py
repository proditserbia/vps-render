import json, subprocess, zipfile
from pathlib import Path

root=Path(__file__).resolve().parents[1]
out=root/'out/megazilla-v1'
ffmpeg='C:/Portable/ffmpeg/bin/ffmpeg.exe'
probe=root/'node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe'
profiles={
 'farleft-panel01':(2352,1666,60), 'centerleft-panel02':(4124,1666,60),
 'centerright-panel03':(4124,1666,60), 'farright-panel04':(1952,1666,60),
 'bottomcenter-panel05':(4840,1198,60), 'flat':(6276,1432,30),
 'insitu':(1920,1080,30), 'social':(1080,1920,30)}
files=[]
for name,(w,h,fps) in profiles.items():
 p=out/f'megazilla-{name}-{fps}fps.mp4'
 data=json.loads(subprocess.check_output([str(probe),'-v','error','-show_streams','-of','json',str(p)]))
 video=next(s for s in data['streams'] if s['codec_type']=='video')
 audio=[s for s in data['streams'] if s['codec_type']=='audio']
 assert (video['width'],video['height'],video['r_frame_rate'],int(video['nb_frames']))==(w,h,f'{fps}/1',fps*15),name
 assert video['codec_name']=='h264' and video['pix_fmt']=='yuv420p',name
 assert len(audio)==(1 if name=='social' else 0),name
 assert abs(float(video['duration'])-15)<.04,name
 files.append(p)
 print('PASS',name,flush=True)
hd=out/'megazilla-flat-review-HD-30fps.mp4'
if not hd.exists():
 subprocess.run([ffmpeg,'-y','-v','error','-i',str(out/'megazilla-flat-30fps.mp4'),'-vf','scale=1920:-2','-an','-c:v','libx264','-preset','fast','-crf','18','-threads','3','-movflags','+faststart',str(hd)],check=True)
data=json.loads(subprocess.check_output([str(probe),'-v','error','-show_streams','-of','json',str(hd)]))
v=next(s for s in data['streams'] if s['codec_type']=='video')
assert (v['width'],v['height'],v['r_frame_rate'],int(v['nb_frames']))==(1920,438,'30/1',450)
assert not any(s['codec_type']=='audio' for s in data['streams'])
subprocess.run([ffmpeg,'-y','-v','error','-i',str(hd),'-vf','fps=1,scale=960:-2,tile=3x5','-frames:v','1',str(out/'megazilla-timeline.jpg')],check=True)
readme='''MEGAZILLA — FIRST REVIEW

All videos: 15 seconds.

Panels/: Five synchronized screens, native dimensions, 60 fps, silent.
Previews/: Flat (6276 x 1432) and InSitu (1920 x 1080), 30 fps, silent.
Previews/flat-review-HD: Smaller copy for quick playback.
Extra/: Additional social street preview (1080 x 1920), 30 fps, ambient audio.

This review uses the supplied Alain Perez test media and editable placeholder text.
The large center-photo crop follows the original AE template.
No Firebase or VPS changes were made.
'''
archive=out/'Megazilla_First_Review_2026-11-18.zip'
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_STORED) as z:
 z.writestr('README.txt',readme)
 for p in files:
  folder='Panels' if 'panel' in p.name else 'Extra' if 'social' in p.name else 'Previews'
  z.write(p,f'{folder}/{p.name}')
 z.write(hd,f'Previews/{hd.name}')
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None, 'ZIP integrity check failed'
print('READY',archive,flush=True)
