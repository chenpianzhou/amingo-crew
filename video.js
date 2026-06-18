// ffmpeg 视频流水线：转码、分屏拼接、标题叠加（spawn 异步 + 串行锁 + 产物清理）
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { UPLOAD_DIR, newId } = require('./store');

let ffmpegPath;
try { ffmpegPath = require('ffmpeg-static'); } catch (e) { ffmpegPath = 'ffmpeg'; }

const W = 1080, H = 1920, SEG = 2; // 输出尺寸 + 每段固定 2s
const CLIP_CAP = 8;                // 单主题最多并排 8 格

// 字体探测：Docker(dejavu) → mac fallback。drawtext 必须有字体文件
const FONT = [
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
  '/System/Library/Fonts/Helvetica.ttc',
].find(f => { try { return fs.existsSync(f); } catch (e) { return false; } }) || '';

// spawn 封装：args 数组传参（避免 shell 转义），60s 超时
function run(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath, args);
    let err = '';
    const timer = setTimeout(() => { try { p.kill('SIGKILL'); } catch (e) {} reject(new Error('ffmpeg timeout')); }, 60000);
    p.stderr.on('data', d => { err += d; });
    p.on('error', e => { clearTimeout(timer); reject(e); });
    p.on('close', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(err.slice(-400) || 'ffmpeg exit ' + code)); });
  });
}

// 标题文本消毒：仅字母数字空格，限长（drawtext 安全）
function safeTitle(s) { return (s || '').replace(/[^A-Za-z0-9 ]/g, '').trim().slice(0, 24) || 'Topic'; }

function drawtextChain(inLabel, title, outLabel) {
  if (!FONT) return `[${inLabel}]copy[${outLabel}]`; // 无字体则不叠标题，不报错
  const t = safeTitle(title).replace(/ /g, '\\ ');
  return `[${inLabel}]drawtext=fontfile='${FONT}':text='${t}':fontcolor=white:fontsize=46:box=1:boxcolor=black@0.55:boxborderw=18:x=(w-text_w)/2:y=h-120[${outLabel}]`;
}

function scaleTo(idx, w, h, label) {
  return `[${idx}:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,fps=30[${label}]`;
}

// ── 转码：任意输入 → H.264 mp4(yuv420p + faststart)，保证 iOS 可播 ──
// 失败时 reject 并清掉产物，不留坏文件；输入已是 .mp4 则原样保留
function transcode(rawPath) {
  return new Promise((resolve, reject) => {
    if (rawPath.endsWith('.mp4')) return resolve(path.basename(rawPath));
    const mp4 = rawPath.replace(/\.\w+$/, '.mp4');
    run(['-y', '-v', 'error', '-i', rawPath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart', mp4])
      .then(() => {
        if (!fs.existsSync(mp4)) return reject(new Error('transcode produced no file'));
        try { fs.unlinkSync(rawPath); } catch (e) {}
        resolve(path.basename(mp4));
      })
      .catch(err => {
        try { fs.unlinkSync(mp4); } catch (e) {}
        reject(err);
      });
  });
}

// 一个主题段：n 路分屏 + 标题，输出到 segFile
async function buildSegment(clips, title, segFile) {
  const picked = clips.slice(0, CLIP_CAP);
  const n = picked.length;
  const inputs = [];
  picked.forEach(c => { inputs.push('-t', String(SEG), '-i', path.join(UPLOAD_DIR, c.file)); });

  let fc;
  if (n === 1) {
    fc = scaleTo(0, W, H, 's0') + ';' + drawtextChain('s0', title, 'v');
  } else if (n === 4) {
    const hw = W / 2, hh = H / 2;
    fc = [scaleTo(0, hw, hh, 'a'), scaleTo(1, hw, hh, 'b'), scaleTo(2, hw, hh, 'c'), scaleTo(3, hw, hh, 'd')].join(';')
      + ';[a][b]hstack=2[top];[c][d]hstack=2[bot];[top][bot]vstack=2[base];' + drawtextChain('base', title, 'v');
  } else {
    const sliceH = Math.floor(H / n);
    const labels = 'abcdefghij'.split('');
    const scales = [], parts = [];
    for (let k = 0; k < n; k++) { scales.push(scaleTo(k, W, sliceH, labels[k])); parts.push(`[${labels[k]}]`); }
    fc = scales.join(';') + ';' + parts.join('') + `vstack=inputs=${n}[base];` + drawtextChain('base', title, 'v');
  }
  await run(['-y', '-v', 'error', ...inputs, '-filter_complex', fc, '-map', '[v]', '-t', String(SEG),
    '-an', '-c:v', 'libx264', '-preset', 'fast', '-pix_fmt', 'yuv420p', segFile]);
}

// 单条全屏段（Moments，无标题）
async function buildFullScreen(clip, segFile) {
  await run(['-y', '-v', 'error', '-t', String(SEG), '-i', path.join(UPLOAD_DIR, clip.file),
    '-vf', `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=30,format=yuv420p`,
    '-an', '-c:v', 'libx264', '-preset', 'fast', '-pix_fmt', 'yuv420p', '-t', String(SEG), segFile]);
}

// 删除该 crew 的旧 export 产物，只留最近 1 个
function cleanupExports(crewId, keepFile) {
  try {
    for (const f of fs.readdirSync(UPLOAD_DIR)) {
      if (f.startsWith(`${crewId}_export_`) && f !== keepFile) {
        try { fs.unlinkSync(path.join(UPLOAD_DIR, f)); } catch (e) {}
      }
    }
  } catch (e) {}
}

// 实际合成逻辑（被串行锁包裹）
async function _doExport(crew, targetCategory) {
  const grouped = {}, moments = [];
  crew.clips.forEach(c => {
    if (c.category) (grouped[c.category] = grouped[c.category] || []).push(c);
    else moments.push(c);
  });

  if (targetCategory) {
    if (!grouped[targetCategory] || !grouped[targetCategory].length) throw new Error('no clips for this topic');
    for (const k of Object.keys(grouped)) if (k !== targetCategory) delete grouped[k];
  } else {
    for (const [cat, clips] of Object.entries(grouped)) {
      if (new Set(clips.map(c => c.memberId)).size < 2) delete grouped[cat];
    }
    if (!Object.keys(grouped).length && !moments.length) throw new Error('no topics with 2+ people yet');
  }

  const segments = [];
  const tag = newId(4); // 唯一前缀防并发覆盖
  try {
    let i = 0;
    for (const [cat, clips] of Object.entries(grouped)) {
      const seg = path.join(UPLOAD_DIR, `${crew.id}_seg_${tag}_${i++}.mp4`);
      await buildSegment(clips, cat, seg);
      segments.push(seg);
    }
    if (!targetCategory) {
      for (const c of moments) {
        const seg = path.join(UPLOAD_DIR, `${crew.id}_seg_${tag}_${i++}.mp4`);
        try { await buildFullScreen(c, seg); segments.push(seg); } catch (e) { console.error('[video] moments seg:', e.message); }
      }
    }
    if (!segments.length) throw new Error('nothing to export');

    const outFile = path.join(UPLOAD_DIR, `${crew.id}_export_${Date.now()}.mp4`);
    if (segments.length === 1) {
      fs.renameSync(segments[0], outFile);
      segments.length = 0;
    } else {
      const listFile = path.join(UPLOAD_DIR, `${crew.id}_list_${tag}.txt`);
      fs.writeFileSync(listFile, segments.map(s => `file '${s}'`).join('\n'));
      // concat 阶段重编码，保证参数一致防错乱
      await run(['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', listFile,
        '-c:v', 'libx264', '-preset', 'fast', '-pix_fmt', 'yuv420p', '-an', outFile]);
      try { fs.unlinkSync(listFile); } catch (e) {}
    }
    const base = path.basename(outFile);
    cleanupExports(crew.id, base);
    return base;
  } finally {
    segments.forEach(s => { try { fs.unlinkSync(s); } catch (e) {} });
  }
}

// ── 串行锁：同时只跑一个 export，其余排队 ──
let queue = Promise.resolve();
function exportCrew(crew, targetCategory) {
  const job = queue.then(() => _doExport(crew, targetCategory || null));
  queue = job.catch(() => {}); // 不让失败阻断队列
  return job;
}

module.exports = { transcode, exportCrew, FONT };
