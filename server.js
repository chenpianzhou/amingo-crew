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
  if (!crew) return res.status(404).json({ error: 'not found' });
  if (!crew.clips.length) return res.status(400).json({ error: 'no clips yet' });

  const W = 1080, H = 1920;

  try {
    // Group by category
    const grouped = {};
    const uncat = [];
    crew.clips.forEach(c => {
      if (c.category) { (grouped[c.category] = grouped[c.category] || []).push(c); }
      else uncat.push(c);
    });

    const segments = [];
    let si = 0;

    // Helper: make a title card (1.5s black screen with emoji + topic name)
    function makeTitleCard(emoji, name, idx) {
      const tf = path.join(UPLOAD_DIR, `${crew.id}_title${idx}.mp4`);
      // Use lavfi to generate a black frame with text (no drawtext filter needed)
      // Simple: generate a 1.5s black video
      ff(`-y -v error -f lavfi -i "color=c=black:s=${W}x${H}:d=1.5:r=30" -vf "format=yuv420p" -an -c:v libx264 -preset fast "${tf}"`);
      return tf;
    }

    for (const [cat, clips] of Object.entries(grouped)) {
      // Title card for this topic
      const emoji = clips[0].emoji || '📷';
      const titleFile = makeTitleCard(emoji, cat, si);
      segments.push(titleFile);

      // Split-screen segment
      const segFile = path.join(UPLOAD_DIR, `${crew.id}_seg${si}.mp4`);
      const n = Math.min(clips.length, Math.min(crew.members.length, 8));
      const inp = clips.slice(0, n).map(c => `"${path.join(UPLOAD_DIR, c.file)}"`);
      
      // Get shortest clip duration to sync
      let minDur = 10;
      clips.slice(0, n).forEach(c => {
        try {
          const d = parseFloat(execSync(`"${ffmpegPath}" -v error -i "${path.join(UPLOAD_DIR, c.file)}" -f null - 2>&1 | grep -o "time=[0-9:.]*" | head -1 | sed "s/time=//"`, {shell:true}).toString().trim());
          if (d > 0 && d < minDur) minDur = d;
        } catch(e) {}
      });
      if (minDur > 6) minDur = 6; // cap at 6s per topic
      if (minDur < 1) minDur = 3;

      // Layout: 1=full, 2=top/bottom, 3=top/mid/bottom, 4=2x2 grid, 5+=stacked
      if (n === 1) {
        ff(`-y -v error -i ${inp[0]} -vf "scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=30,format=yuv420p" -t ${minDur} -an -c:v libx264 -preset fast "${segFile}"`);
      } else if (n === 4) {
        // 4 people: 2x2 grid
        const hw = W / 2, hh = H / 2;
        ff(`-y -v error -i ${inp[0]} -i ${inp[1]} -i ${inp[2]} -i ${inp[3]} -filter_complex "[0:v]scale=${hw}:${hh}:force_original_aspect_ratio=increase,crop=${hw}:${hh},setsar=1,fps=30[a];[1:v]scale=${hw}:${hh}:force_original_aspect_ratio=increase,crop=${hw}:${hh},setsar=1,fps=30[b];[2:v]scale=${hw}:${hh}:force_original_aspect_ratio=increase,crop=${hw}:${hh},setsar=1,fps=30[c];[3:v]scale=${hw}:${hh}:force_original_aspect_ratio=increase,crop=${hw}:${hh},setsar=1,fps=30[d];[a][b]hstack=2[top];[c][d]hstack=2[bot];[top][bot]vstack=2,format=yuv420p[v]" -map "[v]" -t ${minDur} -an -c:v libx264 -preset fast "${segFile}"`);
      } else {
        // 2, 3, 5+ people: vertical stack (top to bottom, equal height each)
        const sliceH = Math.floor(H / n);
        const labels = 'abcdefghij'.split('');
        const inputArgs = inp.join(' -i ');
        const scaleFilters = [];
        const stackParts = [];
        for (let k = 0; k < n; k++) {
          scaleFilters.push(`[${k}:v]scale=${W}:${sliceH}:force_original_aspect_ratio=increase,crop=${W}:${sliceH},setsar=1,fps=30[${labels[k]}]`);
          stackParts.push(`[${labels[k]}]`);
        }
        const fc = scaleFilters.join(';') + ';' + stackParts.join('') + `vstack=${n},format=yuv420p[v]`;
        ff(`-y -v error -i ${inputArgs} -filter_complex "${fc}" -map "[v]" -t ${minDur} -an -c:v libx264 -preset fast "${segFile}"`);
      }
      segments.push(segFile);
      si++;
    }

    // Uncategorized: title "Moments" + each clip full screen
    if (uncat.length) {
      segments.push(makeTitleCard('📷', 'Moments', 99));
      uncat.forEach(c => {
        const sf = path.join(UPLOAD_DIR, `${crew.id}_seg${si}.mp4`);
        ff(`-y -v error -i "${path.join(UPLOAD_DIR, c.file)}" -vf "scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=30,format=yuv420p" -t 4 -an -c:v libx264 -preset fast "${sf}"`);
        segments.push(sf);
        si++;
      });
    }

    if (!segments.length) return res.status(400).json({ error: 'nothing to export' });

    // Concat all
    const outFile = path.join(UPLOAD_DIR, `${crew.id}_export_${Date.now()}.mp4`);
    const listFile = path.join(UPLOAD_DIR, `${crew.id}_list.txt`);
    fs.writeFileSync(listFile, segments.map(s => `file '${s}'`).join('\n'));
    ff(`-y -v error -f concat -safe 0 -i "${listFile}" -c copy "${outFile}"`);

    // Cleanup temp
    segments.forEach(s => { try { fs.unlinkSync(s); } catch(e){} });
    try { fs.unlinkSync(listFile); } catch(e){}

    res.json({ videoUrl: `/uploads/${path.basename(outFile)}` });
  } catch (e) {
    console.error('export error:', e.message);
    res.status(500).json({ error: 'export failed: ' + e.message.slice(0, 200) });
  }
});

app.get('/join/:crewId', (req, res) => res.sendFile(path.join(__dirname,'public','index.html')));

if(!IS_VERCEL) app.listen(PORT, ()=>console.log(`\n🎯 http://localhost:${PORT}\n`));
module.exports = app;
