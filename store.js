// 数据与文件存储：crews.json 读写 + 视频/缩略图落盘
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const IS_RAILWAY = fs.existsSync('/data');
const DATA_DIR = IS_RAILWAY ? '/data' : __dirname;
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');   // 视频
const THUMB_DIR = path.join(DATA_DIR, 'thumbs');     // 缩略图(poster)
const DB_FILE = path.join(DATA_DIR, 'crews.json');

for (const d of [UPLOAD_DIR, THUMB_DIR]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

let crews = {};
try {
  if (fs.existsSync(DB_FILE)) crews = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
} catch (e) { console.error('[store] load:', e.message); }

function save() {
  try { fs.writeFileSync(DB_FILE, JSON.stringify(crews, null, 2)); }
  catch (e) { console.error('[store] save:', e.message); }
}

function newId(n = 5) { return crypto.randomBytes(n).toString('hex'); }

// 名字/主题名消毒：去掉 HTML 危险字符，限长（从源头杜绝 XSS / onclick 注入）
function clean(s, fallback) {
  const v = String(s || '').replace(/[<>"'&]/g, '').trim().slice(0, 20);
  return v || fallback;
}

// 主题名 → 稳定 key（大小写无关、去非字母数字），用于「同一成员同一主题」分组 / stitch 索引
function catKey(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

function getCrew(id) { return crews[id]; }

function createCrew(name) {
  const id = newId(4);
  const memberId = newId(3);
  crews[id] = { id, members: [{ id: memberId, name: clean(name, 'me') }], clips: [], nudges: [], stitches: {} };
  save();
  return { crew: crews[id], memberId };
}

function joinCrew(id, name) {
  const crew = crews[id];
  if (!crew) return null;
  const nm = clean(name, 'friend');
  let member = crew.members.find(m => m.name === nm);
  if (!member) { member = { id: newId(3), name: nm }; crew.members.push(member); }
  save();
  return { crew, memberId: member.id };
}

function addClip(crew, clip) { crew.clips.push(clip); save(); return clip; }

// 删除一条 clip（连同视频文件 + 缩略图），用于「一人一主题一条」覆盖
function removeClip(crew, clipId) {
  const idx = crew.clips.findIndex(c => c.id === clipId);
  if (idx < 0) return;
  const [c] = crew.clips.splice(idx, 1);
  try { if (c.file) fs.unlinkSync(path.join(UPLOAD_DIR, c.file)); } catch (e) {}
  try { if (c.thumb) fs.unlinkSync(path.join(THUMB_DIR, c.thumb)); } catch (e) {}
  save();
}

function addNudge(crew, nudge) { crew.nudges.push(nudge); save(); return nudge; }

// 前端抓首帧的 base64 jpeg → 落盘 thumbs/，返回文件名（失败返回 null）
function saveThumb(crewId, dataUrl) {
  if (!dataUrl) return null;
  try {
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    const file = `${crewId}_${newId(4)}.jpg`;
    fs.writeFileSync(path.join(THUMB_DIR, file), Buffer.from(base64, 'base64'));
    return file;
  } catch (e) { console.error('[store] saveThumb:', e.message); return null; }
}

module.exports = {
  DATA_DIR, UPLOAD_DIR, THUMB_DIR, DB_FILE, IS_RAILWAY,
  newId, clean, catKey, save, getCrew, createCrew, joinCrew, addClip, removeClip, addNudge, saveThumb,
  allCrews: () => crews,
};
