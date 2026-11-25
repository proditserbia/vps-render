const fs = require('node:fs/promises');
const path = require('node:path');
const {execFile} = require('node:child_process');
const {promisify} = require('node:util');
const {renderMedia, RenderInternals} = require('@remotion/renderer');
const execFileAsync = promisify(execFile);
const {prepareEmpAudio} = require('./emp-audio-preparation.cjs');

// Raw intermediate AAC loses encoder priming information in the current renderer.
// Keep the mix lossless until the final MP4 mux, which preserves that information.
// No source offset or timeline compensation is applied. Video is copied unchanged.
async function renderEmpMedia(options) {
  const output = path.resolve(options.outputLocation);
  // /tmp output directories may be absent after a reboot or cleanup.
  await fs.mkdir(path.dirname(output), {recursive: true});
  const temp = await fs.mkdtemp(path.join(path.dirname(output), '.emp-audio-'));
  try {
    const intermediate = path.join(temp, 'render.mov');
    const final = path.join(temp, 'final.mp4');
    // Use the same platform-specific FFmpeg that ships with the installed renderer.
    const ffmpeg = RenderInternals.getExecutablePath({
      type: 'ffmpeg', indent: false, logLevel: 'error',
      binariesDirectory: options.binariesDirectory ?? null,
    });
    const ffprobe = RenderInternals.getExecutablePath({type:'ffprobe',indent:false,logLevel:'error',binariesDirectory:options.binariesDirectory??null});
    const prepared = await prepareEmpAudio({options,ffmpeg,ffprobe,temp});
    console.log('[emp-audio]', JSON.stringify(prepared.reports));
    const result = await renderMedia({...options, inputProps:prepared.props, composition:{...options.composition,props:{...options.composition.props,...prepared.props}}, outputLocation: intermediate, audioCodec: 'pcm-16'});
    const mixedMeta=JSON.parse((await execFileAsync(ffprobe,['-v','error','-show_streams','-of','json',intermediate])).stdout);
    const measurement=mixedMeta.streams.some(s=>s.codec_type==='audio')?await execFileAsync(ffmpeg,['-hide_banner','-i',intermediate,'-vn','-af','loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json','-f','null','-']):{stderr:''};
    const peakMatch=measurement.stderr.match(/\{\s*"input_i"[\s\S]*?\}/);
    const peak=peakMatch?Number(JSON.parse(peakMatch[0]).input_tp):-Infinity;
    const attenuation=Number.isFinite(peak)?Math.min(0,-1.5-peak):0;
    await execFileAsync(ffmpeg, [
      '-hide_banner', '-loglevel', 'error', '-y', '-i', intermediate,
      '-map', '0:v:0', '-map', '0:a:0?', '-c:v', 'copy',
      '-c:a', 'libfdk_aac', '-b:a', options.audioBitrate ?? '320k',
      '-af', `volume=${attenuation}dB`,
      '-movflags', '+faststart', final,
    ], {windowsHide: true, maxBuffer: 4 * 1024 * 1024});
    await fs.rename(final, output);
    return {...result, buffer: null, contentType: 'video/mp4'};
  } finally {
    // temp is created above beneath the output directory, never user-supplied.
    await fs.rm(temp, {recursive: true, force: true});
  }
}

module.exports = {renderEmpMedia};

