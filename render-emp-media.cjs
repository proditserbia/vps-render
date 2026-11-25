const fs = require('node:fs/promises');
const path = require('node:path');
const {execFile} = require('node:child_process');
const {promisify} = require('node:util');
const {renderMedia, RenderInternals} = require('@remotion/renderer');
const execFileAsync = promisify(execFile);

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
    const result = await renderMedia({...options, outputLocation: intermediate, audioCodec: 'pcm-16'});
    // Use the same platform-specific FFmpeg that ships with the installed renderer.
    const ffmpeg = RenderInternals.getExecutablePath({
      type: 'ffmpeg', indent: false, logLevel: 'error',
      binariesDirectory: options.binariesDirectory ?? null,
    });
    await execFileAsync(ffmpeg, [
      '-hide_banner', '-loglevel', 'error', '-y', '-i', intermediate,
      '-map', '0:v:0', '-map', '0:a:0?', '-c:v', 'copy',
      '-c:a', 'libfdk_aac', '-b:a', options.audioBitrate ?? '320k',
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

