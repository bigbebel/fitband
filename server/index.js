import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import { nanoid, customAlphabet } from 'nanoid';
import { fileURLToPath } from 'url';
import db, { save } from './db.js';
import { analyzeMeal } from './ai.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, nanoid(12) + path.extname(file.originalname || '').toLowerCase()),
  }),
  limits: { fileSize: 200 * 1024 * 1024 }, // 타임랩스 영상 고려
});

const inviteCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8);
const today = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); // KST

// ---- 인증(초안: 헤더의 user id) ----
function auth(req, res, next) {
  const id = req.header('x-user-id');
  const user = db.users.find((u) => u.id === id);
  if (!user) return res.status(401).json({ error: '로그인이 필요합니다' });
  req.user = user;
  next();
}

app.post('/api/login', (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: '이름을 입력하세요' });
  let user = db.users.find((u) => u.name === name);
  if (!user) {
    user = { id: nanoid(10), name, createdAt: Date.now() };
    db.users.push(user); save();
  }
  res.json(user);
});

// ---- 팀 ----
app.get('/api/teams', auth, (req, res) => {
  const mine = db.members.filter((m) => m.userId === req.user.id).map((m) => m.teamId);
  const teams = db.teams.filter((t) => mine.includes(t.id)).map((t) => ({
    ...t,
    memberCount: db.members.filter((m) => m.teamId === t.id).length,
    todayCount: db.entries.filter((e) => e.sharedTeams?.includes(t.id) && e.date === today()).length,
  }));
  res.json(teams);
});

app.post('/api/teams', auth, (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: '팀 이름을 입력하세요' });
  const team = { id: nanoid(10), name, desc: String(req.body.desc || ''), ownerId: req.user.id, inviteCode: inviteCode(), createdAt: Date.now() };
  db.teams.push(team);
  db.members.push({ teamId: team.id, userId: req.user.id, joinedAt: Date.now() });
  save();
  res.json(team);
});

app.get('/api/teams/:id', auth, (req, res) => {
  const team = db.teams.find((t) => t.id === req.params.id);
  if (!team) return res.status(404).json({ error: '팀 없음' });
  const members = db.members.filter((m) => m.teamId === team.id).map((m) => db.users.find((u) => u.id === m.userId)).filter(Boolean);
  const isMember = members.some((u) => u.id === req.user.id);
  res.json({ ...team, members, isMember });
});

app.get('/api/teams/:id/qr', auth, async (req, res) => {
  const team = db.teams.find((t) => t.id === req.params.id);
  if (!team) return res.status(404).json({ error: '팀 없음' });
  const origin = req.query.origin || `${req.protocol}://${req.get('host')}`;
  const url = `${origin}/join/${team.inviteCode}`;
  const dataUrl = await QRCode.toDataURL(url, { width: 320, margin: 1 });
  res.json({ url, dataUrl, inviteCode: team.inviteCode });
});

app.get('/api/invite/:code', auth, (req, res) => {
  const team = db.teams.find((t) => t.inviteCode === req.params.code.toUpperCase());
  if (!team) return res.status(404).json({ error: '유효하지 않은 초대 코드' });
  res.json({ id: team.id, name: team.name, desc: team.desc, memberCount: db.members.filter((m) => m.teamId === team.id).length });
});

app.post('/api/invite/:code/join', auth, (req, res) => {
  const team = db.teams.find((t) => t.inviteCode === req.params.code.toUpperCase());
  if (!team) return res.status(404).json({ error: '유효하지 않은 초대 코드' });
  if (!db.members.some((m) => m.teamId === team.id && m.userId === req.user.id)) {
    db.members.push({ teamId: team.id, userId: req.user.id, joinedAt: Date.now() }); save();
  }
  res.json(team);
});

// 팀 피드: 팀에 공유된 보고서(날짜·사람별 묶음)
app.get('/api/teams/:id/feed', auth, (req, res) => {
  const team = db.teams.find((t) => t.id === req.params.id);
  if (!team) return res.status(404).json({ error: '팀 없음' });
  const entries = db.entries.filter((e) => e.sharedTeams?.includes(team.id)).sort((a, b) => b.createdAt - a.createdAt);
  const groups = {};
  for (const e of entries) {
    const key = `${e.date}|${e.userId}`;
    if (!groups[key]) {
      const u = db.users.find((x) => x.id === e.userId);
      groups[key] = { date: e.date, user: { id: e.userId, name: u?.name || '?' }, entries: [] };
    }
    groups[key].entries.push(e);
  }
  res.json(Object.values(groups).map(withSummary));
});

// ---- 보고서 항목 ----
app.get('/api/entries', auth, (req, res) => {
  const date = req.query.date;
  let list = db.entries.filter((e) => e.userId === req.user.id);
  if (date) list = list.filter((e) => e.date === date);
  res.json(list.sort((a, b) => b.createdAt - a.createdAt));
});

// 날짜별 리포트 (해당 날짜 모든 항목 + 요약)
app.get('/api/report', auth, (req, res) => {
  const date = req.query.date || today();
  const entries = db.entries.filter((e) => e.userId === req.user.id && e.date === date);
  res.json(withSummary({ date, user: { id: req.user.id, name: req.user.name }, entries }));
});

// 달력용: 날짜별 항목 수
app.get('/api/report/calendar', auth, (req, res) => {
  const out = {};
  for (const e of db.entries.filter((e) => e.userId === req.user.id)) {
    out[e.date] = out[e.date] || { study: 0, meal: 0, workout: 0 };
    out[e.date][e.type]++;
  }
  res.json(out);
});

// 공부: 타임랩스(영상/이미지) + 메모
app.post('/api/entries/study', auth, upload.single('file'), (req, res) => {
  const e = {
    id: nanoid(10), userId: req.user.id, type: 'study', date: req.body.date || today(), createdAt: Date.now(),
    memo: String(req.body.memo || ''), subject: String(req.body.subject || ''),
    minutes: Number(req.body.minutes) || 0,
    file: req.file ? `/uploads/${req.file.filename}` : null,
    fileType: req.file ? (req.file.mimetype.startsWith('video') ? 'video' : 'image') : null,
    sharedTeams: parseTeams(req.body.teams),
  };
  db.entries.push(e); save(); res.json(e);
});

// 식단: 사진 → AI 분석
app.post('/api/entries/meal', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '사진이 필요합니다' });
  try {
    const analysis = await analyzeMeal(req.file.path, req.file.mimetype);
    const e = {
      id: nanoid(10), userId: req.user.id, type: 'meal', date: req.body.date || today(), createdAt: Date.now(),
      mealType: String(req.body.mealType || '식사'), memo: String(req.body.memo || ''),
      file: `/uploads/${req.file.filename}`, analysis,
      sharedTeams: parseTeams(req.body.teams),
    };
    db.entries.push(e); save(); res.json(e);
  } catch (err) {
    console.error(err);
    let msg = err.message || String(err);
    if (err.code === 'insufficient_quota' || err.status === 429) msg = 'OpenAI 크레딧이 부족해요. platform.openai.com → Billing 에서 충전해 주세요.';
    else if (err.status === 401) msg = 'OpenAI API 키가 올바르지 않아요.';
    res.status(500).json({ error: 'AI 분석 실패: ' + msg });
  }
});

// 운동: 메모
app.post('/api/entries/workout', auth, (req, res) => {
  const e = {
    id: nanoid(10), userId: req.user.id, type: 'workout', date: req.body.date || today(), createdAt: Date.now(),
    title: String(req.body.title || ''), memo: String(req.body.memo || ''), minutes: Number(req.body.minutes) || 0,
    sharedTeams: parseTeams(req.body.teams),
  };
  db.entries.push(e); save(); res.json(e);
});

// 공유 팀 수정 / 삭제
app.patch('/api/entries/:id', auth, (req, res) => {
  const e = db.entries.find((x) => x.id === req.params.id && x.userId === req.user.id);
  if (!e) return res.status(404).json({ error: '없음' });
  if (req.body.teams !== undefined) e.sharedTeams = parseTeams(req.body.teams);
  if (req.body.memo !== undefined) e.memo = String(req.body.memo);
  save(); res.json(e);
});
app.delete('/api/entries/:id', auth, (req, res) => {
  const i = db.entries.findIndex((x) => x.id === req.params.id && x.userId === req.user.id);
  if (i < 0) return res.status(404).json({ error: '없음' });
  db.entries.splice(i, 1); save(); res.json({ ok: true });
});

// 하루 보고서를 팀에 공유 (해당 날짜의 모든 항목)
app.post('/api/report/share', auth, (req, res) => {
  const { date, teamId } = req.body;
  if (!db.members.some((m) => m.teamId === teamId && m.userId === req.user.id)) return res.status(403).json({ error: '팀 멤버가 아닙니다' });
  for (const e of db.entries.filter((e) => e.userId === req.user.id && e.date === date)) {
    e.sharedTeams = e.sharedTeams || [];
    if (!e.sharedTeams.includes(teamId)) e.sharedTeams.push(teamId);
  }
  save(); res.json({ ok: true });
});

function parseTeams(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return String(v).split(',').filter(Boolean); }
}

function withSummary(group) {
  const es = group.entries;
  const meals = es.filter((e) => e.type === 'meal');
  const nutrition = meals.reduce((a, m) => {
    const t = m.analysis?.total || {};
    for (const k of ['calories', 'carbs', 'protein', 'fat', 'sodium', 'sugar']) a[k] += Number(t[k]) || 0;
    return a;
  }, { calories: 0, carbs: 0, protein: 0, fat: 0, sodium: 0, sugar: 0 });
  return {
    ...group,
    summary: {
      studyMinutes: es.filter((e) => e.type === 'study').reduce((a, e) => a + (e.minutes || 0), 0),
      studyCount: es.filter((e) => e.type === 'study').length,
      mealCount: meals.length,
      workoutCount: es.filter((e) => e.type === 'workout').length,
      workoutMinutes: es.filter((e) => e.type === 'workout').reduce((a, e) => a + (e.minutes || 0), 0),
      nutrition,
    },
  };
}

// ---- 프로덕션: 빌드된 프론트 서빙 ----
const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api|\/uploads).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`FitBand server on http://localhost:${PORT} (OpenAI: ${process.env.OPENAI_API_KEY ? 'on' : 'mock'})`));
