const path = require('path');

// Load .env from the same directory as this file before reading any env vars.
require('dotenv').config({path: path.join(__dirname, '.env')});

const express = require('express');
const {bundle} = require('@remotion/bundler');
const {
  renderMedia,
  renderStill,
  ensureBrowser,
  selectComposition,
} = require('@remotion/renderer');
const os = require('os');
const fs = require('fs');
const {renderEmpMedia} = require('./render-emp-media.cjs');

const app = express();
app.use(express.json({limit: '10mb'}));

const PORT = process.env.PORT || 8080;

/**
 * Directory where rendered output files are stored and served from.
 * Default: OS temp directory.  Override via OUTPUT_DIR env var.
 */
const OUTPUT_DIR = path.resolve(process.env.OUTPUT_DIR || path.join(__dirname, 'var', 'render-output'));
fs.mkdirSync(OUTPUT_DIR, {recursive:true});

/**
 * Base URL at which THIS server is reachable by the Firebase Function.
 * Used to construct the videoUrl returned in render responses.
 * Default: http://127.0.0.1:<PORT>
 */
const SERVER_BASE_URL = (
  process.env.SERVER_BASE_URL || `http://127.0.0.1:${PORT}`
).trim().replace(/\/$/, '');

/**
 * Full URL of the Firebase Cloud Function that receives render results.
 * Example: https://<region>-<project>.cloudfunctions.net/renderCallback
 * Set via RENDER_CALLBACK_URL env var.
 */
const RENDER_CALLBACK_URL = (process.env.RENDER_CALLBACK_URL || '').trim();

/**
 * Shared secret sent in the x-render-secret header of every callback POST.
 * Must match RENDER_CALLBACK_SECRET in the Firebase Functions environment.
 */
const RENDER_CALLBACK_SECRET = (process.env.RENDER_CALLBACK_SECRET || '').trim();

/**
 * How long (ms) to wait for the callback endpoint to respond.
 * Default: 60 seconds.
 */
const CALLBACK_TIMEOUT_MS = (() => {
  const raw = parseInt(process.env.CALLBACK_TIMEOUT_MS || '', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 60_000;
})();

const CANONICAL_OUTPUT_FORMAT = 'mp4';
const CANONICAL_CODEC = 'h264';
const CANONICAL_EXTENSION = 'mp4';

/**
 * YouTube / Shorts oriented encode profile.
 *
 * Keep the MVP async callback flow intact, but expose Remotion/FFmpeg quality
 * knobs through env vars so production can render native 1080x1920 output by
 * default while still allowing faster/lower-res smoke tests when needed.
 */
const RENDER_PROFILE = {
  videoBitrate: process.env.REMOTION_VIDEO_BITRATE || '8M',
  maxRate: process.env.REMOTION_MAX_RATE || '10M',
  bufferSize: process.env.REMOTION_BUFFER_SIZE || '16M',
  x264Preset: process.env.REMOTION_X264_PRESET || 'slow',
  audioBitrate: process.env.REMOTION_AUDIO_BITRATE || '320k',
  pixelFormat: process.env.REMOTION_PIXEL_FORMAT || 'yuv420p',
  colorSpace: process.env.REMOTION_COLOR_SPACE || 'bt709',
  imageFormat: process.env.REMOTION_IMAGE_FORMAT || 'jpeg',
};

const RENDER_SCALE = (() => {
  const raw = parseFloat(process.env.REMOTION_SCALE || '1');
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
})();

const LOG_FFMPEG_ARGS = /^(1|true|yes)$/i.test(process.env.REMOTION_LOG_FFMPEG_ARGS || '');

/** Prefixed log helper for per-request lines. */
function makeLog(jobId) {
  const tag = jobId ? `[job:${jobId}]` : '[job:?]';
  return {
    info: (...args) => console.log(tag, ...args),
    error: (...args) => console.error(tag, ...args),
  };
}

/**
 * Sanitize a caller-supplied jobId so it is safe to use as a filename
 * component. Only alphanumerics, hyphens, and underscores are kept;
 * everything else (including path separators) is stripped.
 */
function sanitizeJobId(jobId) {
  if (!jobId) return null;
  return String(jobId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128) || null;
}

/**
 * POST the render result back to the Firebase renderCallback function.
 *
 * Retries up to 3 times with exponential back-off on network errors or
 * non-2xx responses.  Failures are logged but do not throw — the render
 * itself already completed; we must not block or crash the worker.
 */
async function postCallback(jobId, payload) {
  const body = JSON.stringify(payload);
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CALLBACK_TIMEOUT_MS);

      let response;
      try {
        response = await fetch(RENDER_CALLBACK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-render-secret': RENDER_CALLBACK_SECRET,
          },
          body,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      if (response.ok) {
        console.log(`[callback] Callback accepted (attempt ${attempt})`, { jobId, status: response.status });
        return true;
      }

      const text = await response.text().catch(() => '');
      console.error(`[callback] Callback rejected (attempt ${attempt}/${maxAttempts})`, {
        jobId,
        status: response.status,
        body: text.slice(0, 200),
      });

      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    } catch (err) {
      console.error(`[callback] Callback network error (attempt ${attempt}/${maxAttempts})`, {
        jobId,
        message: err?.message || String(err),
      });
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
  }

  console.error(`[callback] All callback attempts exhausted for job ${jobId}`);
  return false;
}

let bundlePath = null;
let bundleReady = false;
let bundleBuilding = false;

async function buildBundle() {
  if (bundleBuilding || bundleReady) return;

  bundleBuilding = true;
  console.log('[bundle] Building Remotion bundle from source...');

  try {
    const entryPoint = path.join(__dirname, 'src', 'index.ts');
    const publicDir = path.join(__dirname, 'public');
    bundlePath = await bundle({entryPoint, publicDir});
    bundleReady = true;
    console.log('[bundle] Bundle built at:', bundlePath);
  } finally {
    bundleBuilding = false;
  }
}

// ---------------------------------------------------------------------------
// Async render queue
// ---------------------------------------------------------------------------
//
// The /render endpoint accepts jobs immediately (202 Accepted) and enqueues
// them.  The worker processes one job at a time.  On completion or failure
// the worker POSTs the result to the Firebase renderCallback function.

const {DurableRenderQueue} = require('./durable-render-queue.cjs');
const QUEUE_DIR = path.resolve(process.env.RENDER_QUEUE_DIR || path.join(__dirname,'var','render-queue'));
const startedAt = new Date().toISOString();
// Exactly one worker process may own this journal. Do not use PM2 cluster mode.
fs.mkdirSync(QUEUE_DIR,{recursive:true,mode:0o700});
const lockPath=path.join(QUEUE_DIR,'worker.lock');
if(fs.existsSync(lockPath)){
  const pid=Number(fs.readFileSync(lockPath,'utf8'));
  if(!Number.isSafeInteger(pid)||pid<1)throw new Error('Invalid worker.lock; inspect before removing');
  let live=true;try{process.kill(pid,0);}catch(error){if(error.code==='ESRCH')live=false;else throw error;}
  if(live)throw new Error(`Render queue already owned by PID ${pid}`);
  fs.unlinkSync(lockPath);
}
fs.writeFileSync(lockPath,String(process.pid),{flag:'wx',mode:0o600});
process.on('exit',()=>{try{if(fs.readFileSync(lockPath,'utf8')===String(process.pid))fs.unlinkSync(lockPath);}catch{}});
const renderQueue = new DurableRenderQueue(QUEUE_DIR);
let workerBusy = false;
let stopping = false;
function outputFilename(job){return `${job.jobId}${job.attempt?`-a${job.attempt}`:''}.${job.outputFormat||'mp4'}`;}
function enqueueRenderJob(job) {
  const receipt=renderQueue.enqueue(job); // Atomic disk write BEFORE sending HTTP 202.
  void maybeRunWorker();
  return receipt;
}
async function maybeRunWorker() {
  if(workerBusy||!bundleReady||stopping)return;
  workerBusy=true;
  try {
    let record;
    while(!stopping && (record=renderQueue.next())){
      const job=record.job;
      if(record.state==='callback' && record.result.success){
        const file=path.join(OUTPUT_DIR,outputFilename(job));
        // e.g. /tmp removed on reboot: regenerate, never publish a missing file.
        if(!fs.existsSync(file)||fs.statSync(file).size!==record.result.size){renderQueue.redo(job);continue;}
      }
      let result=record.result;
      if(record.state==='queued'){
        renderQueue.start(job);
        result=await executeRenderJob(job);
        renderQueue.result(job,result); // Durable callback outbox before network I/O.
      }
      if(await postCallback(job.jobId,result))renderQueue.done(job);
      else renderQueue.defer(job);
    }
  } catch(error){
    // Fail closed: keep the journal and let PM2 restart/recover it.
    console.error('[worker] FATAL durable worker error',error);
    process.exit(1);
  } finally {workerBusy=false;}
}
setInterval(()=>{void maybeRunWorker();},5000).unref();
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{
  stopping=true;
  console.log(`[queue] ${signal}: pending jobs remain on disk for restart`);
  process.exit(0);
});

/**
 * Execute a single render job and POST the result to the callback URL.
 */
async function executeRenderJob({jobId, composition, inputProps, outputFormat, codec, attempt}) {
  const log = makeLog(jobId);
  if (!jobId) {
    throw new Error('jobId is required for deterministic output filename');
  }
  const isEmpPng = composition === 'emp-v1' && ['banner', 'banner-2x'].includes(inputProps.outputVariant) && outputFormat === 'png';
  const isStill = isEmpPng || composition === 'us-dooh-la-test-v1' && ['static', 'static-insitu'].includes(inputProps.outputVariant) && outputFormat === 'jpg';
  if (outputFormat !== CANONICAL_OUTPUT_FORMAT && !isStill) {
    throw new Error(`Unsupported outputFormat "${outputFormat}". Only "${CANONICAL_OUTPUT_FORMAT}" is supported.`);
  }
  if (codec !== CANONICAL_CODEC) {
    throw new Error(`Unsupported codec "${codec}". Only "${CANONICAL_CODEC}" is supported.`);
  }
  const filename = `${jobId}${attempt ? `-a${attempt}` : ''}.${isStill ? outputFormat : CANONICAL_EXTENSION}`;
  const outputPath = path.join(OUTPUT_DIR, filename);

  let interval = null;
  const startedAt = Date.now();

  try {
    log.info('Worker starting render', {composition, codec, outputFormat, outputPath});

    log.info('Ensuring browser is available...');
    await ensureBrowser();

    log.info('Selecting composition...');
    const serveUrl = bundlePath;
    const selectedComposition = await selectComposition({
      serveUrl,
      id: composition,
      inputProps,
    });

    log.info('Composition selected', {
      id: selectedComposition.id,
      width: selectedComposition.width,
      height: selectedComposition.height,
      fps: selectedComposition.fps,
      durationInFrames: selectedComposition.durationInFrames,
    });

    log.info(`Starting render → codec=${codec} ext=${CANONICAL_EXTENSION} output=${outputPath}`);

    let lastLoggedPercent = -1;
    interval = setInterval(() => {
      log.info(`Still rendering... ${Math.round((Date.now() - startedAt) / 1000)}s elapsed`);
    }, 5000);

    const renderOptions = {
      serveUrl,
      composition: selectedComposition,
      codec,
      inputProps,
      outputLocation: outputPath,
      overwrite: true,

      videoBitrate: RENDER_PROFILE.videoBitrate,
      maxRate: RENDER_PROFILE.maxRate,
      bufferSize: RENDER_PROFILE.bufferSize,
      x264Preset: RENDER_PROFILE.x264Preset,
      audioBitrate: RENDER_PROFILE.audioBitrate,
      pixelFormat: RENDER_PROFILE.pixelFormat,
      colorSpace: RENDER_PROFILE.colorSpace,
      imageFormat: RENDER_PROFILE.imageFormat,

      onStart: ({frameCount, parallelEncoding, resolvedConcurrency}) => {
        log.info('Render started', {
          frameCount,
          parallelEncoding,
          resolvedConcurrency,
          renderProfile: RENDER_PROFILE,
          scale: RENDER_SCALE,
        });
      },

      onProgress: ({progress, renderedFrames, encodedFrames, stitchStage}) => {
        const percent = Math.round(progress * 100);
        if (percent % 10 === 0 && percent !== lastLoggedPercent) {
          lastLoggedPercent = percent;
          log.info('Render progress', {
            percent,
            renderedFrames,
            encodedFrames,
            stitchStage,
          });
        }
      },

      onDownload: (src) => {
        log.info('Downloading asset:', src);
      },

      onBrowserLog: (browserLog) => {
        log.info('Browser log:', browserLog);
      },
    };

    // Native US DOOH motion test outputs: do not inherit the Shorts scale/profile.
    const isUsDooh = ['us-dooh-la-test-v1', 'us-dooh-ny-test-v1', 'us-dooh-mega-test-v1'].includes(composition);
    if (isUsDooh) {
      const nativeLA = composition === 'us-dooh-la-test-v1' && inputProps.outputVariant === 'motion';
      Object.assign(renderOptions, {
        videoBitrate: nativeLA ? '40M' : '15M',
        maxRate: nativeLA ? '40M' : '15M',
        bufferSize: nativeLA ? '80M' : '30M',
        pixelFormat: 'yuv420p', colorSpace: 'bt709', muted: inputProps.outputVariant !== 'social',
        concurrency: 1, scale: 1,
      });
    }
    if (composition === 'emp-v1') Object.assign(renderOptions, {scale:1, concurrency:1, muted:false, videoBitrate:'15M', pixelFormat:'yuv420p', colorSpace:'bt709'});
    if (!isUsDooh && composition !== 'emp-v1' && RENDER_SCALE !== 1) {
      renderOptions.scale = RENDER_SCALE;
    }

    if (LOG_FFMPEG_ARGS) {
      renderOptions.ffmpegOverride = ({type, args}) => {
        log.info(`FFmpeg ${type} args`, args.join(' '));
        return args;
      };
    }

    if (isStill) await renderStill({serveUrl,composition:selectedComposition,inputProps,frame:isEmpPng ? 0 : 25,imageFormat:isEmpPng ? 'png' : 'jpeg',...(isEmpPng ? {} : {jpegQuality:100}),output:outputPath});
    else if (composition === 'emp-v1') await renderEmpMedia(renderOptions);
    else await renderMedia(renderOptions);

    const elapsedMs = Date.now() - startedAt;
    log.info(`Render completed in ${(elapsedMs / 1000).toFixed(1)}s`, {outputPath});

    if (!fs.existsSync(outputPath)) {
      throw new Error('Output file was not created');
    }
    const stats = fs.statSync(outputPath);
    if (isEmpPng && stats.size >= 300 * 1024) throw new Error('EMP banner exceeds 300 KB');
    if (stats.size === 0) {
      throw new Error('Output file is empty');
    }

    const videoUrl = `${SERVER_BASE_URL}/files/${filename}`;
    log.info(`Output file size: ${(stats.size / 1024).toFixed(1)} KB → ${videoUrl}`);

    return {
      jobId,
      success: true,
      ...(attempt ? {attempt} : {}),
      videoUrl,
      size: stats.size,
      metadata: {
        composition,
        renderedAt: new Date().toISOString(),
        elapsedMs,
      },
    };
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    log.error('=== RENDER ERROR ===');
    log.error(`Failed after ${(elapsedMs / 1000).toFixed(1)}s`);
    log.error('Error type:', error?.constructor?.name || typeof error);
    log.error('Error message:', error?.message || String(error));
    if (error?.stack) log.error('Stack:', error.stack);

    return {
      jobId,
      success: false,
      ...(attempt ? {attempt} : {}),
      error: error?.message || 'Unknown render error',
    };
  } finally {
    if (interval) clearInterval(interval);
  }
}

// ---------------------------------------------------------------------------
// Serve rendered output files
// ---------------------------------------------------------------------------

app.use('/files', express.static(OUTPUT_DIR));

// ---------------------------------------------------------------------------
// Periodic temp-file cleanup
// ---------------------------------------------------------------------------
//
// The /render endpoint writes output into OUTPUT_DIR and the Cloud Function
// downloads it via /files/... and uploads it to Firebase Storage.  After that
// upload the local copy is no longer needed.  We periodically purge files
// older than TEMP_FILE_TTL_MS so the temp directory does not grow without
// bound in long-running deployments.
//
// Override the TTL via TEMP_FILE_TTL_MS (default: 1 hour).  Set to 0 to
// disable cleanup entirely.
const TEMP_FILE_TTL_MS = (() => {
  const raw = parseInt(process.env.TEMP_FILE_TTL_MS || '', 10);
  if (Number.isFinite(raw) && raw >= 0) return raw;
  return 60 * 60 * 1000; // 1 hour
})();
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const CLEANUP_EXTENSIONS = new Set([
  '.mp4', '.mov', '.webm', '.gif', '.png', '.jpg', '.m4a', '.mp3', '.wav',
]);

function cleanupOldOutputFiles() {
  if (TEMP_FILE_TTL_MS === 0) return;
  let entries;
  try {
    entries = fs.readdirSync(OUTPUT_DIR);
  } catch (err) {
    console.warn('[cleanup] Could not read OUTPUT_DIR:', err?.message || err);
    return;
  }
  const cutoff = Date.now() - TEMP_FILE_TTL_MS;
  let removed = 0;
  for (const name of entries) {
    if(renderQueue.pending().some(r=>outputFilename(r.job)===name))continue;
    const ext = path.extname(name).toLowerCase();
    if (!CLEANUP_EXTENSIONS.has(ext)) continue;
    const full = path.join(OUTPUT_DIR, name);
    try {
      const st = fs.statSync(full);
      if (st.isFile() && st.mtimeMs < cutoff) {
        fs.unlinkSync(full);
        removed += 1;
      }
    } catch (err) {
      // Ignore individual file errors — best-effort cleanup.
      console.warn('[cleanup] Could not stat/unlink', name, err?.message || err);
    }
  }
  if (removed > 0) {
    console.log(`[cleanup] Removed ${removed} stale render file(s) from ${OUTPUT_DIR}`);
  }
}

if (TEMP_FILE_TTL_MS > 0) {
  setInterval(cleanupOldOutputFiles, CLEANUP_INTERVAL_MS).unref?.();
}

// Serve the Remotion public assets directory so that static assets (e.g.
// loading videos) are reachable at /assets/* during rendering.
// End card videos are stored in Firebase Storage and referenced by their
// Storage HTTPS URLs — they are not served from this directory.
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use('/assets', express.static(PUBLIC_DIR));

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

app.get('/health', (req, res) => {
  res.json({
    status: bundleReady ? 'healthy' : 'starting',
    bundleReady,
    bundlePath: bundleReady ? bundlePath : null,
    timestamp: new Date().toISOString(),
    startedAt,
    queue: renderQueue.snapshot(),
    runtime: {
      pid: process.pid,
      cwd: process.cwd(),
      file: __filename,
      node: process.version,
      renderProfile: RENDER_PROFILE,
      scale: RENDER_SCALE,
      logFfmpegArgs: LOG_FFMPEG_ARGS,
    },
  });
});

// ---------------------------------------------------------------------------
// Render endpoint
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Render endpoint — accepts jobs asynchronously (202 Accepted)
// ---------------------------------------------------------------------------
//
// The request is acknowledged immediately.  The actual render runs in the
// background worker; results are delivered via the RENDER_CALLBACK_URL.

app.post('/render', async (req, res) => {
  const requestedAt = new Date().toISOString();
  const {composition, inputProps = {}, jobId: rawJobId, codec: reqCodec, outputFormat, attempt} = req.body;
  const jobId = sanitizeJobId(rawJobId);
  const log = makeLog(jobId);
  const effectiveOutputFormat = outputFormat || CANONICAL_OUTPUT_FORMAT;
  const effectiveCodec = reqCodec || CANONICAL_CODEC;

  log.info(`POST /render received at ${requestedAt}`, {
    composition,
    outputFormat: effectiveOutputFormat,
    codec: effectiveCodec,
    inputPropsKeys: Object.keys(inputProps),
  });

  if (!RENDER_CALLBACK_URL || !RENDER_CALLBACK_SECRET) {
    log.error('Rejected: callback configuration missing');
    return res.status(503).json({
      error: 'Render callback configuration is missing (RENDER_CALLBACK_URL and RENDER_CALLBACK_SECRET are required)',
    });
  }

  if (!composition) {
    log.error('Rejected: missing required field "composition"');
    return res.status(400).json({
      error: 'Missing required field: composition',
    });
  }

  if (!bundleReady || !bundlePath) {
    log.error('Rejected: bundle not ready');
    return res.status(503).json({
      error: 'Bundle not ready yet — please retry in a moment',
    });
  }

  if (!jobId) {
    log.error('Rejected: missing required field "jobId"');
    return res.status(400).json({
      error: 'Missing required field: jobId',
    });
  }

  if (attempt !== undefined && (!Number.isSafeInteger(attempt) || attempt < 1)) return res.status(400).json({error:'Invalid attempt'});
  if (effectiveOutputFormat !== CANONICAL_OUTPUT_FORMAT && !(composition === 'emp-v1' && ['banner', 'banner-2x'].includes(inputProps.outputVariant) && effectiveOutputFormat === 'png') && !(composition === 'us-dooh-la-test-v1' && ['static', 'static-insitu'].includes(inputProps.outputVariant) && effectiveOutputFormat === 'jpg')) {
    log.error('Rejected: unsupported outputFormat', {outputFormat: effectiveOutputFormat});
    return res.status(422).json({
      error: `Unsupported outputFormat "${effectiveOutputFormat}". Only "${CANONICAL_OUTPUT_FORMAT}" is supported.`,
    });
  }

  if (effectiveCodec !== CANONICAL_CODEC) {
    log.error('Rejected: unsupported codec', {codec: effectiveCodec});
    return res.status(422).json({
      error: `Unsupported codec "${effectiveCodec}". Only "${CANONICAL_CODEC}" is supported.`,
    });
  }

  let receipt;
  try { receipt=enqueueRenderJob({
    jobId,
    composition,
    inputProps,
    outputFormat: effectiveOutputFormat,
    attempt,
    codec: CANONICAL_CODEC,
  });

  } catch(error){log.error('Could not persist render job',error.message);return res.status(error.status||503).json({error:error.message});}
  log.info('Render job durably accepted', receipt);

  return res.status(202).json({
    jobId,
    status: receipt.state,
    duplicate: receipt.duplicate,
    durable: true,
    message: 'Render job accepted — result will be delivered to the callback URL',
  });
});

// ---------------------------------------------------------------------------
// Render still endpoint
// ---------------------------------------------------------------------------

app.post('/render-still', async (req, res) => {
  const requestedAt = new Date().toISOString();
  const {composition, inputProps = {}, jobId: rawJobId} = req.body;
  const jobId = sanitizeJobId(rawJobId);
  const log = makeLog(jobId);

  log.info(`POST /render-still received at ${requestedAt}`, {composition});

  if (!composition) {
    log.error('Rejected: missing required field "composition"');
    return res.status(400).json({error: 'Missing composition'});
  }

  if (!bundleReady || !bundlePath) {
    log.error('Rejected: bundle not ready');
    return res.status(503).json({error: 'Bundle not ready yet'});
  }

  const serveUrl = bundlePath;
  const filename = `${jobId || Date.now()}.png`;
  const outputPath = path.join(OUTPUT_DIR, filename);
  const startedAt = Date.now();

  try {
    log.info('Ensuring browser is available...');
    await ensureBrowser();

    log.info('Selecting composition...');
    const selectedComposition = await selectComposition({
      serveUrl,
      id: composition,
      inputProps,
    });

    log.info('Starting still render...', {outputPath});
    await renderStill({
      serveUrl,
      composition: selectedComposition,
      inputProps,
      output: outputPath,
    });

    const elapsedMs = Date.now() - startedAt;
    log.info(`Still render completed in ${(elapsedMs / 1000).toFixed(1)}s`);

    return res.download(outputPath, 'frame.png', () => {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    });
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    log.error(`Still render failed after ${(elapsedMs / 1000).toFixed(1)}s:`, error?.message || String(error));
    if (error?.stack) log.error('Stack:', error.stack);
    return res.status(500).json({
      error: 'Render still failed',
      message: error?.message || 'Unknown render-still error',
      type: error?.constructor?.name || typeof error,
    });
  }
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  const missingCallbackConfig = [];
  if (!RENDER_CALLBACK_URL) missingCallbackConfig.push('RENDER_CALLBACK_URL');
  if (!RENDER_CALLBACK_SECRET) missingCallbackConfig.push('RENDER_CALLBACK_SECRET');
  if (missingCallbackConfig.length > 0) {
    console.error('[server] FATAL: async callback mode requires callback configuration.', {
      missing: missingCallbackConfig,
    });
    process.exit(1);
  }

  console.log('[server] Remotion render service starting');
  console.log(`[server]   PORT            = ${PORT}`);
  console.log(`[server]   OUTPUT_DIR      = ${OUTPUT_DIR}`);
  console.log(`[server]   SERVER_BASE_URL = ${SERVER_BASE_URL}`);
  console.log(`[server]   OUTPUT_FORMAT   = ${CANONICAL_OUTPUT_FORMAT}`);
  console.log(`[server]   REMOTION_CODEC  = ${CANONICAL_CODEC}`);
  console.log(`[server]   REMOTION_SCALE  = ${RENDER_SCALE}`);
  console.log('[server]   RENDER_PROFILE  =', RENDER_PROFILE);
  console.log(`[server]   LOG_FFMPEG_ARGS = ${LOG_FFMPEG_ARGS}`);
  console.log(`[server] Health check:      ${SERVER_BASE_URL}/health`);
  console.log(`[server] Render endpoint:   ${SERVER_BASE_URL}/render`);

  buildBundle().then(()=>{console.log('[queue] Restored',renderQueue.snapshot());void maybeRunWorker();}).catch((err) => {
    console.error('[bundle] FATAL: Failed to build Remotion bundle:', err);
    process.exit(1);
  });
});
