const express = require('express');
const multer = require('multer');
const path = require('path');
const store = require('./store');
const vision = require('./vision');
const video = require('./video');

const app = express();
const PORT = process.env.PORT || 3456;

app.use(express.json({ limit: '15mb' }));
app.use((req, res, next) => { if (req.body == null) req.body = {}; next(); }); // express5: 无 body 兜底为 {}，避免解构崩溃
app.use(express.static('public', { etag: false, maxAge: 0 }));
// 视频/缩略图文件名唯一不可变(新内容=新文件名)，可长缓存 → 切卡/回看不再重下，减少黑屏卡顿
app.use('/uploads', express.static(store.UPLOAD_DIR, { maxAge: '30d', immutable: true }));
app.use('/thumbs', express.static(store.THUMB_DIR, { maxAge: '30d', immutable: true }));
app.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

const upload = multer({
  storage: multer.diskStorage({
    destination: store.UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, `${req.params.crewId}_${store.newId(4)}${path.extname(file.originalname) || '.webm'}`),
  }),
  limits: { fileSize: 100 * 1024 * 1024, fieldSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // 收视频：优先按 mimetype；浏览器对 blob 不带类型时 busboy 默认 text/plain，
    // 这种情况按扩展名兜底（前端固定上传 .webm/.mp4），避免误杀真实视频
    const okMime = /^video\//.test(file.mimetype);
    const okExt = /\.(webm|mp4|mov|m4v)$/i.test(file.originalname || '') && /^(application\/octet-stream|text\/plain)$/.test(file.mimetype);
    if (okMime || okExt) cb(null, true);
    else cb(new Error('only video files allowed'));
  },
});

const clipView = c => ({
  id: c.id, memberId: c.memberId, memberName: c.memberName,
  category: c.category, ts: c.ts,
  videoUrl: `/uploads/${c.file}`,
  thumbUrl: c.thumb ? `/thumbs/${c.thumb}` : null,
});

app.post('/api/crew', (req, res) => {
  const { crew, memberId } = store.createCrew(req.body.name);
  res.json({ crewId: crew.id, memberId, joinUrl: `/join/${crew.id}` });
});

app.post('/api/crew/:id/join', (req, res) => {
  const r = store.joinCrew(req.params.id, req.body.name);
  if (!r) return res.status(404).json({ error: 'crew not found' });
  res.json({ crewId: r.crew.id, memberId: r.memberId, members: r.crew.members });
});

app.get('/api/crew/:id', (req, res) => {
  const crew = store.getCrew(req.params.id);
  if (!crew) return res.status(404).json({ error: 'not found' });
  const stitches = Object.fromEntries(Object.entries(crew.stitches || {}).map(([k, f]) => [k, `/uploads/${f}`]));
  res.json({ id: crew.id, members: crew.members, clips: crew.clips.map(clipView), stitches, nudges: crew.nudges.slice(-20) });
});

// 同一成员同一主题：最多保留最新 3 条，超出删最旧；≥2 条则用 ffmpeg 横向并排拼接成一条
async function rebuildStitch(crew, memberId, category) {
  crew.stitches = crew.stitches || {};
  const key = `${memberId}|${store.catKey(category)}`;
  let mine = crew.clips.filter(c => c.memberId === memberId && c.category && c.category.toLowerCase() === category.toLowerCase())
    .sort((a, b) => a.ts - b.ts);
  while (mine.length > video.STITCH_CAP) { store.removeClip(crew, mine[0].id); mine = mine.slice(1); } // 删最旧
  const old = crew.stitches[key];
  if (mine.length >= 2) {
    const out = `${crew.id}_stitch_${memberId}_${store.catKey(category)}_${store.newId(3)}.mp4`;
    try {
      await video.stitchHorizontal(mine.map(c => c.file), require('path').join(store.UPLOAD_DIR, out));
      crew.stitches[key] = out;
      if (old && old !== out) { try { require('fs').unlinkSync(require('path').join(store.UPLOAD_DIR, old)); } catch (e) {} }
    } catch (e) { console.error('[stitch] failed:', e.message); }
  } else { // 只剩 1 条 → 不需要拼接，清掉旧 stitch
    if (old) { try { require('fs').unlinkSync(require('path').join(store.UPLOAD_DIR, old)); } catch (e) {} delete crew.stitches[key]; }
  }
  store.save();
}

app.post('/api/crew/:crewId/clip', upload.single('clip'), async (req, res) => {
  const rmUpload = () => { try { if (req.file) require('fs').unlinkSync(req.file.path); } catch (e) {} }; // multer 先落盘，校验失败要清掉孤儿文件
  const crew = store.getCrew(req.params.crewId);
  if (!crew) { rmUpload(); return res.status(404).json({ error: 'crew not found' }); }
  const member = crew.members.find(m => m.id === req.body.memberId);
  if (!member) { rmUpload(); return res.status(400).json({ error: 'not a member' }); }
  if (!req.file) return res.status(400).json({ error: 'no clip' });
  try {
    const file = await video.transcode(req.file.path); // 转码失败 → throw，不留坏 clip
    const thumb = store.saveThumb(crew.id, req.body.thumb);
    // 主题名消毒 + 大小写归一：命中已有同名(忽略大小写)主题则复用其原始写法，避免 Food/food 拆成两个
    let category = req.body.category ? store.clean(req.body.category, null) : null;
    if (category) {
      const existing = crew.clips.find(c => c.category && c.category.toLowerCase() === category.toLowerCase());
      if (existing) category = existing.category; // 复用已有主题的大小写写法
    }
    const clip = store.addClip(crew, {
      id: store.newId(3), memberId: member.id, memberName: member.name,
      file, thumb, category, ts: Date.now(),
    });
    if (category) await rebuildStitch(crew, member.id, category); // 同人同主题：限 3 条 + 重建并排拼接
    res.json({ ok: true, clip: clipView(clip) });
  } catch (e) {
    console.error('[clip] failed:', e.message);
    try { require('fs').unlinkSync(req.file.path); } catch (e2) {}
    res.status(500).json({ error: 'video processing failed' });
  }
});

app.get('/api/crew/:crewId/download/:clipId', (req, res) => {
  const crew = store.getCrew(req.params.crewId);
  if (!crew) return res.status(404).json({ error: 'not found' });
  const clip = crew.clips.find(c => c.id === req.params.clipId);
  if (!clip) return res.status(404).json({ error: 'clip not found' });
  const fp = path.join(store.UPLOAD_DIR, clip.file);
  if (!require('fs').existsSync(fp)) return res.status(404).json({ error: 'file missing' });
  res.download(fp, `amingo_${clip.memberName}_${clip.id}.mp4`);
});

app.post('/api/vision', async (req, res) => {
  const label = await vision.classify(req.body.image);
  res.json({ label });
});

app.post('/api/crew/:crewId/nudge', (req, res) => {
  const crew = store.getCrew(req.params.crewId);
  if (!crew) return res.status(404).json({ error: 'not found' });
  const member = crew.members.find(m => m.id === req.body.memberId);
  store.addNudge(crew, { fromId: member ? member.id : null, fromName: member ? member.name : 'someone', category: req.body.category || 'something', ts: Date.now() });
  res.json({ ok: true });
});

app.get('/api/crew/:crewId/nudges', (req, res) => {
  const crew = store.getCrew(req.params.crewId);
  if (!crew) return res.json({ nudges: [] });
  const since = parseInt(req.query.since) || 0;
  res.json({ nudges: crew.nudges.filter(n => n.ts > since) });
});

app.post('/api/crew/:crewId/export', async (req, res) => {
  const crew = store.getCrew(req.params.crewId);
  if (!crew) return res.status(404).json({ error: 'not found' });
  if (!crew.clips.length) return res.status(400).json({ error: 'no clips yet' });
  try {
    const file = await video.exportCrew(crew, req.body.category);
    res.json({ videoUrl: `/uploads/${file}` });
  } catch (e) {
    console.error('[export] failed:', e.message);
    res.status(500).json({ error: e.message.slice(0, 120) });
  }
});

app.get('/api/admin/crews', (req, res) => {
  res.json(Object.values(store.allCrews()).map(c => ({
    id: c.id, members: c.members.map(m => m.name), clipCount: c.clips.length,
    categories: [...new Set(c.clips.map(x => x.category).filter(Boolean))],
  })));
});

app.get('/join/:crewId', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// 全局错误处理：兜住 multer 校验失败 / 未捕获异常，返回干净 JSON，不泄漏堆栈
app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  res.status(err.status || 400).json({ error: err.message || 'bad request' });
});

app.listen(PORT, '0.0.0.0', () => console.log(`\n🎯 amingo on 0.0.0.0:${PORT}  (data: ${store.DATA_DIR}, font: ${video.FONT || 'NONE'})\n`));
module.exports = app;
