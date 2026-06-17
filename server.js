const express = require('express');
const multer = require('multer');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let ffmpegPath;
try { ffmpegPath = require('ffmpeg-static'); } catch(e) { ffmpegPath = 'ffmpeg'; }

const app = express();
const PORT = process.env.PORT || 3456;
const IS_VERCEL = !!process.env.VERCEL;
const UPLOAD_DIR = IS_VERCEL ? '/tmp/uploads' : path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));
app.use('/uploads', express.static(UPLOAD_DIR));

const crews = {};
function newId(n=5){ return crypto.randomBytes(n).toString('hex'); }
function ff(args){ return execSync(`"${ffmpegPath}" ${args}`, { timeout:60000, maxBuffer:50*1024*1024 }); }

app.post('/api/crew', (req, res) => {
  const id = newId(4);
  const memberId = newId(3);
  crews[id] = { id, members:[{id:memberId,name:req.body.name||'me'}], clips:[], nudges:[] };
  res.json({ crewId:id, memberId, joinUrl:`/join/${id}` });
});

app.post('/api/crew/:id/join', (req, res) => {
  const crew = crews[req.params.id];
  if(!crew) return res.status(404).json({error:'crew not found'});
  let member = crew.members.find(m=>m.name===req.body.name);
  if(!member){ member={id:newId(3),name:req.body.name||'friend'}; crew.members.push(member); }
  res.json({ crewId:crew.id, memberId:member.id, members:crew.members });
});

app.get('/api/crew/:id', (req, res) => {
  const crew = crews[req.params.id];
  if(!crew) return res.status(404).json({error:'not found'});
  res.json({
    id:crew.id, members:crew.members,
    clips:crew.clips.map(c=>({id:c.id,memberId:c.memberId,memberName:c.memberName,thumb:c.thumb,category:c.category,emoji:c.emoji,ts:c.ts,videoUrl:`/uploads/${c.file}`})),
    nudges:crew.nudges.slice(-20),
  });
});

const upload = multer({
  storage:multer.diskStorage({
    destination:UPLOAD_DIR,
    filename:(req,file,cb)=>cb(null,`${req.params.crewId}_${newId(4)}${path.extname(file.originalname)||'.webm'}`),
  }),
  limits:{fileSize:100*1024*1024},
});

app.post('/api/crew/:crewId/clip', upload.single('clip'), (req, res) => {
  const crew = crews[req.params.crewId];
  if(!crew) return res.status(404).json({error:'crew not found'});
  const member = crew.members.find(m=>m.id===req.body.memberId);
  if(!member) return res.status(400).json({error:'not a member'});
  const raw = req.file.path;
  let finalFile = path.basename(raw);
  if(!raw.endsWith('.mp4')){
    const mp4 = raw.replace(/\.\w+$/,'.mp4');
    try{ ff(`-y -v error -i "${raw}" -c:v libx264 -pix_fmt yuv420p -c:a aac -movflags +faststart "${mp4}"`);
      if(fs.existsSync(mp4)){fs.unlinkSync(raw);finalFile=path.basename(mp4);}
    }catch(e){console.error('convert:',e.message);}
  }
  const clip = {id:newId(3),memberId:member.id,memberName:member.name,file:finalFile,thumb:req.body.thumb||null,category:req.body.category||null,emoji:req.body.emoji||null,ts:Date.now()};
  crew.clips.push(clip);
  res.json({ok:true,clip:{...clip,videoUrl:`/uploads/${clip.file}`}});
});

app.get('/api/crew/:crewId/download/:clipId', (req, res) => {
  const crew = crews[req.params.crewId];
  if(!crew) return res.status(404).json({error:'not found'});
  const clip = crew.clips.find(c=>c.id===req.params.clipId);
  if(!clip) return res.status(404).json({error:'clip not found'});
  const fp = path.join(UPLOAD_DIR,clip.file);
  if(!fs.existsSync(fp)) return res.status(404).json({error:'file missing'});
  res.download(fp, `amingo_${clip.memberName}_${clip.id}.mp4`);
});

app.post('/api/crew/:crewId/nudge', (req, res) => {
  const crew = crews[req.params.crewId];
  if(!crew) return res.status(404).json({error:'not found'});
  const member = crew.members.find(m=>m.id===req.body.memberId);
  crew.nudges.push({from:member?member.name:'someone',category:req.body.category||'something',emoji:req.body.emoji||'📷',ts:Date.now()});
  res.json({ok:true});
});

app.get('/api/crew/:crewId/nudges', (req, res) => {
  const crew = crews[req.params.crewId];
  if(!crew) return res.json({nudges:[]});
  const since = parseInt(req.query.since)||0;
  res.json({nudges:crew.nudges.filter(n=>n.ts>since)});
});

app.post('/api/crew/:crewId/export', (req, res) => {
  const crew = crews[req.params.crewId];
  if(!crew) return res.status(404).json({error:'not found'});
  if(!crew.clips.length) return res.status(400).json({error:'no clips yet'});
  const W=1080,H=1920,mc=Math.min(crew.members.length,4);
  try{
    const grouped={};const uncat=[];
    crew.clips.forEach(c=>{if(c.category)(grouped[c.category]=grouped[c.category]||[]).push(c);else uncat.push(c);});
    const segs=[];let si=0;
    for(const[cat,clips]of Object.entries(grouped)){
      const sf=path.join(UPLOAD_DIR,`${crew.id}_s${si}.mp4`);
      const n=Math.min(clips.length,mc);const inp=clips.slice(0,n).map(c=>`"${path.join(UPLOAD_DIR,c.file)}"`);
      if(n===1) ff(`-y -v error -i ${inp[0]} -vf "scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=30,format=yuv420p" -t 4 -an -c:v libx264 -preset fast "${sf}"`);
      else if(n===2) ff(`-y -v error -i ${inp[0]} -i ${inp[1]} -filter_complex "[0:v]scale=${W/2}:${H}:force_original_aspect_ratio=increase,crop=${W/2}:${H},setsar=1,fps=30[l];[1:v]scale=${W/2}:${H}:force_original_aspect_ratio=increase,crop=${W/2}:${H},setsar=1,fps=30[r];[l][r]hstack=2,drawbox=x=${W/2-2}:y=0:w=4:h=${H}:color=black:t=fill,format=yuv420p[v]" -map "[v]" -t 4 -an -c:v libx264 -preset fast "${sf}"`);
      else if(n===3){const th=H/2|0;ff(`-y -v error -i ${inp[0]} -i ${inp[1]} -i ${inp[2]} -filter_complex "[0:v]scale=${W/2}:${th}:force_original_aspect_ratio=increase,crop=${W/2}:${th},setsar=1,fps=30[tl];[1:v]scale=${W/2}:${th}:force_original_aspect_ratio=increase,crop=${W/2}:${th},setsar=1,fps=30[tr];[tl][tr]hstack=2[top];[2:v]scale=${W}:${H-th}:force_original_aspect_ratio=increase,crop=${W}:${H-th},setsar=1,fps=30[bot];[top][bot]vstack=2,format=yuv420p[v]" -map "[v]" -t 4 -an -c:v libx264 -preset fast "${sf}"`);}
      else{const hw=W/2,hh=H/2;ff(`-y -v error -i ${inp[0]} -i ${inp[1]} -i ${inp[2]} -i ${inp[3]} -filter_complex "[0:v]scale=${hw}:${hh}:force_original_aspect_ratio=increase,crop=${hw}:${hh},setsar=1,fps=30[a];[1:v]scale=${hw}:${hh}:force_original_aspect_ratio=increase,crop=${hw}:${hh},setsar=1,fps=30[b];[2:v]scale=${hw}:${hh}:force_original_aspect_ratio=increase,crop=${hw}:${hh},setsar=1,fps=30[c];[3:v]scale=${hw}:${hh}:force_original_aspect_ratio=increase,crop=${hw}:${hh},setsar=1,fps=30[d];[a][b]hstack=2[top];[c][d]hstack=2[bot];[top][bot]vstack=2,format=yuv420p[v]" -map "[v]" -t 4 -an -c:v libx264 -preset fast "${sf}"`);}
      segs.push(sf);si++;
    }
    uncat.forEach(c=>{const sf=path.join(UPLOAD_DIR,`${crew.id}_s${si}.mp4`);ff(`-y -v error -i "${path.join(UPLOAD_DIR,c.file)}" -vf "scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=30,format=yuv420p" -t 3 -an -c:v libx264 -preset fast "${sf}"`);segs.push(sf);si++;});
    if(!segs.length) return res.status(400).json({error:'nothing to export'});
    const out=path.join(UPLOAD_DIR,`${crew.id}_export.mp4`);
    const lf=path.join(UPLOAD_DIR,`${crew.id}_list.txt`);
    fs.writeFileSync(lf,segs.map(s=>`file '${s}'`).join('\n'));
    ff(`-y -v error -f concat -safe 0 -i "${lf}" -c copy "${out}"`);
    segs.forEach(s=>{try{fs.unlinkSync(s);}catch(e){}});try{fs.unlinkSync(lf);}catch(e){}
    res.json({videoUrl:`/uploads/${path.basename(out)}`});
  }catch(e){console.error('export:',e.message);res.status(500).json({error:'export failed'});}
});

app.get('/join/:crewId', (req, res) => res.sendFile(path.join(__dirname,'public','index.html')));

if(!IS_VERCEL) app.listen(PORT, ()=>console.log(`\n🎯 http://localhost:${PORT}\n`));
module.exports = app;
