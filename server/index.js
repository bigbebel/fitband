import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import { nanoid, customAlphabet } from 'nanoid';
import { fileURLToPath } from 'url';
import db, { save, load, storeUpload, supabase } from './db.js';
import { analyzeMeal } from './ai.js';
import { parseSamsungCsv, normalizeWorkouts } from './health.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, nanoid(12) + path.extname(file.originalname || '').toLowerCase()),
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const inviteCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8);
const kst = (ts = Date.now()) => new Date(ts + 9 * 3600 * 1000).toISOString().slice(0, 10);
const today = () => kst();
const n = (v) => Number(v) || 0;

// ================= 인증 (Supabase Auth, 이메일/비밀번호) =================
const tokenCache = new Map(); // token -> { uid, exp }
async function userFromToken(token) {
  if (!token) return null;
  const c = tokenCache.get(token);
  if (c && c.exp > Date.now()) return db.users.find((u) => u.id === c.uid) || null;
  if (!supabase) { // 로컬 개발: 토큰 = user id
    return db.users.find((u) => u.id === token) || null;
  }
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  tokenCache.set(token, { uid: data.user.id, exp: Date.now() + 10 * 60 * 1000 });
  let user = db.users.find((u) => u.id === data.user.id);
  if (!user) {
    user = { id: data.user.id, email: data.user.email, name: data.user.user_metadata?.name || data.user.email.split('@')[0], createdAt: Date.now() };
    db.users.push(user); save();
  }
  return user;
}
async function auth(req, res, next) {
  const h = req.header('authorization') || '';
  const user = await userFromToken(h.replace(/^Bearer\s+/i, ''));
  if (!user) return res.status(401).json({ error: '로그인이 필요합니다' });
  req.user = user;
  next();
}
const pub = (u) => ({ id: u.id, name: u.name, email: u.email, calorieGoal: u.calorieGoal || 2000, healthToken: u.healthToken });

app.post('/api/auth/signup', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: '이메일, 비밀번호, 닉네임을 입력하세요' });
  if (password.length < 6) return res.status(400).json({ error: '비밀번호는 6자 이상' });
  if (!supabase) {
    const user = { id: nanoid(10), email, name, createdAt: Date.now() }; db.users.push(user); save();
    return res.json({ token: user.id, user: pub(user) });
  }
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name } });
  if (error) return res.status(400).json({ error: /already/i.test(error.message) ? '이미 가입된 이메일이에요' : error.message });
  const user = { id: data.user.id, email, name, createdAt: Date.now() };
  db.users.push(user); save();
  const { data: s, error: e2 } = await supabase.auth.signInWithPassword({ email, password });
  if (e2) return res.status(400).json({ error: e2.message });
  res.json({ token: s.session.access_token, refresh: s.session.refresh_token, user: pub(user) });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!supabase) {
    const user = db.users.find((u) => u.email === email);
    if (!user) return res.status(400).json({ error: '계정이 없어요' });
    return res.json({ token: user.id, user: pub(user) });
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(400).json({ error: '이메일 또는 비밀번호가 틀렸어요' });
  const user = await userFromToken(data.session.access_token);
  res.json({ token: data.session.access_token, refresh: data.session.refresh_token, user: pub(user) });
});

app.post('/api/auth/refresh', async (req, res) => {
  if (!supabase) return res.status(400).json({ error: 'n/a' });
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: req.body.refresh });
  if (error) return res.status(401).json({ error: '다시 로그인해 주세요' });
  const user = await userFromToken(data.session.access_token);
  res.json({ token: data.session.access_token, refresh: data.session.refresh_token, user: pub(user) });
});

app.get('/api/me', auth, (req, res) => res.json(pub(req.user)));
app.patch('/api/me', auth, (req, res) => {
  if (req.body.name) req.user.name = String(req.body.name).trim();
  if (req.body.calorieGoal !== undefined) req.user.calorieGoal = Math.max(800, Math.min(6000, n(req.body.calorieGoal) || 2000));
  save(); res.json(pub(req.user));
});

// ================= 팀 =================
app.get('/api/teams', auth, (req, res) => {
  const mine = db.members.filter((m) => m.userId === req.user.id).map((m) => m.teamId);
  res.json(db.teams.filter((t) => mine.includes(t.id)).map((t) => ({
    ...t,
    memberCount: db.members.filter((m) => m.teamId === t.id).length,
    todayCount: new Set(db.entries.filter((e) => e.sharedTeams?.includes(t.id) && e.date === today()).map((e) => e.userId)).size,
  })));
});
app.post('/api/teams', auth, (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: '팀 이름을 입력하세요' });
  const team = { id: nanoid(10), name, desc: String(req.body.desc || ''), ownerId: req.user.id, inviteCode: inviteCode(), createdAt: Date.now() };
  db.teams.push(team);
  db.members.push({ teamId: team.id, userId: req.user.id, joinedAt: Date.now() });
  save(); res.json(team);
});
app.get('/api/teams/:id', auth, (req, res) => {
  const team = db.teams.find((t) => t.id === req.params.id);
  if (!team) return res.status(404).json({ error: '팀 없음' });
  const members = db.members.filter((m) => m.teamId === team.id).map((m) => db.users.find((u) => u.id === m.userId)).filter(Boolean).map((u) => ({ id: u.id, name: u.name }));
  res.json({ ...team, members, isMember: members.some((u) => u.id === req.user.id) });
});
app.delete('/api/teams/:id/leave', auth, (req, res) => {
  db.members = db.members.filter((m) => !(m.teamId === req.params.id && m.userId === req.user.id));
  save(); res.json({ ok: true });
});
app.get('/api/teams/:id/qr', auth, async (req, res) => {
  const team = db.teams.find((t) => t.id === req.params.id);
  if (!team) return res.status(404).json({ error: '팀 없음' });
  const origin = req.query.origin || `${req.protocol}://${req.get('host')}`;
  const url = `${origin}/join/${team.inviteCode}`;
  res.json({ url, dataUrl: await QRCode.toDataURL(url, { width: 320, margin: 1, color: { dark: '#0f1115', light: '#ffffff' } }), inviteCode: team.inviteCode });
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

// 팀 피드 (날짜·사람별 보고서 + 좋아요/댓글)
app.get('/api/teams/:id/feed', auth, (req, res) => {
  const team = db.teams.find((t) => t.id === req.params.id);
  if (!team) return res.status(404).json({ error: '팀 없음' });
  const entries = db.entries.filter((e) => e.sharedTeams?.includes(team.id)).sort((a, b) => b.createdAt - a.createdAt);
  const groups = {};
  for (const e of entries) {
    const key = `${e.date}|${e.userId}`;
    if (!groups[key]) {
      const u = db.users.find((x) => x.id === e.userId);
      groups[key] = { key, teamId: team.id, date: e.date, user: { id: e.userId, name: u?.name || '?', calorieGoal: u?.calorieGoal || 2000 }, entries: [] };
    }
    groups[key].entries.push(e);
  }
  res.json(Object.values(groups).sort((a, b) => b.date.localeCompare(a.date)).map((g) => ({
    ...withSummary(g),
    likes: db.likes.filter((l) => l.teamId === team.id && l.date === g.date && l.userId === g.user.id).map((l) => l.authorId),
    liked: db.likes.some((l) => l.teamId === team.id && l.date === g.date && l.userId === g.user.id && l.authorId === req.user.id),
    comments: db.comments.filter((c) => c.teamId === team.id && c.date === g.date && c.userId === g.user.id).map(withAuthor),
  })));
});
function withAuthor(c) { const u = db.users.find((x) => x.id === c.authorId); return { ...c, author: { id: c.authorId, name: u?.name || '?' } }; }
function requireMember(req, res, teamId) {
  if (!db.members.some((m) => m.teamId === teamId && m.userId === req.user.id)) { res.status(403).json({ error: '팀 멤버가 아닙니다' }); return false; }
  return true;
}
app.post('/api/teams/:id/like', auth, (req, res) => {
  const { date, userId } = req.body;
  if (!requireMember(req, res, req.params.id)) return;
  const i = db.likes.findIndex((l) => l.teamId === req.params.id && l.date === date && l.userId === userId && l.authorId === req.user.id);
  if (i >= 0) db.likes.splice(i, 1); else db.likes.push({ teamId: req.params.id, date, userId, authorId: req.user.id, createdAt: Date.now() });
  save(); res.json({ liked: i < 0 });
});
app.post('/api/teams/:id/comments', auth, (req, res) => {
  const { date, userId, text } = req.body;
  if (!requireMember(req, res, req.params.id)) return;
  if (!String(text || '').trim()) return res.status(400).json({ error: '내용을 입력하세요' });
  const c = { id: nanoid(10), teamId: req.params.id, date, userId, authorId: req.user.id, text: String(text).trim(), createdAt: Date.now() };
  db.comments.push(c); save(); res.json(withAuthor(c));
});
app.delete('/api/comments/:id', auth, (req, res) => {
  const i = db.comments.findIndex((c) => c.id === req.params.id && c.authorId === req.user.id);
  if (i < 0) return res.status(404).json({ error: '없음' });
  db.comments.splice(i, 1); save(); res.json({ ok: true });
});

// ================= 보고서 =================
app.get('/api/report', auth, (req, res) => {
  const date = req.query.date || today();
  res.json(withSummary({ date, user: { id: req.user.id, name: req.user.name, calorieGoal: req.user.calorieGoal || 2000 }, entries: db.entries.filter((e) => e.userId === req.user.id && e.date === date).sort((a, b) => b.createdAt - a.createdAt) }));
});
app.get('/api/report/calendar', auth, (req, res) => {
  const out = {};
  for (const e of db.entries.filter((e) => e.userId === req.user.id)) {
    out[e.date] = out[e.date] || { study: 0, meal: 0, workout: 0 };
    out[e.date][e.type]++;
  }
  res.json(out);
});
// 통계: 최근 N일 일별 요약
app.get('/api/stats', auth, (req, res) => {
  const days = Math.min(90, n(req.query.days) || 7);
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = kst(Date.now() - i * 86400000);
    const es = db.entries.filter((e) => e.userId === req.user.id && e.date === date);
    out.push({ date, ...withSummary({ entries: es }).summary });
  }
  res.json({ days: out, calorieGoal: req.user.calorieGoal || 2000 });
});

app.post('/api/entries/study', auth, upload.single('file'), async (req, res) => {
  let fileUrl = null;
  if (req.file) {
    try { fileUrl = await storeUpload(req.file.path, req.file.filename, req.file.mimetype); }
    catch (err) { return res.status(500).json({ error: '파일 업로드 실패: ' + err.message }); }
  }
  const e = {
    id: nanoid(10), userId: req.user.id, type: 'study', date: req.body.date || today(), createdAt: Date.now(),
    memo: String(req.body.memo || ''), subject: String(req.body.subject || ''), minutes: n(req.body.minutes),
    file: fileUrl, fileType: req.file ? (req.file.mimetype.startsWith('video') ? 'video' : 'image') : null,
    sharedTeams: parseTeams(req.body.teams),
  };
  db.entries.push(e); save(); res.json(e);
});

app.post('/api/entries/meal', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '사진이 필요합니다' });
  try {
    const analysis = await analyzeMeal(req.file.path, req.file.mimetype);
    const fileUrl = await storeUpload(req.file.path, req.file.filename, req.file.mimetype);
    const e = {
      id: nanoid(10), userId: req.user.id, type: 'meal', date: req.body.date || today(), createdAt: Date.now(),
      mealType: String(req.body.mealType || '식사'), memo: String(req.body.memo || ''), file: fileUrl, analysis,
      sharedTeams: parseTeams(req.body.teams),
    };
    db.entries.push(e); save(); res.json(e);
  } catch (err) {
    console.error(err);
    let msg = err.message || String(err);
    if (err.code === 'insufficient_quota' || err.status === 429) msg = 'OpenAI 크레딧이 부족해요.';
    else if (err.status === 401) msg = 'OpenAI API 키가 올바르지 않아요.';
    res.status(500).json({ error: 'AI 분석 실패: ' + msg });
  }
});

// 운동: 라이즈 스타일 세트 기록 (exercises: [{name, sets:[{weight, reps}]}]) + 메모
app.post('/api/entries/workout', auth, (req, res) => {
  const exercises = (Array.isArray(req.body.exercises) ? req.body.exercises : []).map((x) => ({
    name: String(x.name || '').trim(),
    sets: (Array.isArray(x.sets) ? x.sets : []).map((s) => ({ weight: n(s.weight), reps: n(s.reps) })).filter((s) => s.reps > 0 || s.weight > 0),
  })).filter((x) => x.name);
  const volume = exercises.reduce((a, x) => a + x.sets.reduce((b, s) => b + s.weight * s.reps, 0), 0);
  const e = {
    id: nanoid(10), userId: req.user.id, type: 'workout', date: req.body.date || today(), createdAt: Date.now(),
    title: String(req.body.title || '').trim() || (exercises[0]?.name ? exercises.map((x) => x.name).join(', ') : '운동'),
    memo: String(req.body.memo || ''), minutes: n(req.body.minutes), calories: n(req.body.calories),
    exercises, volume, source: 'manual',
    sharedTeams: parseTeams(req.body.teams),
  };
  db.entries.push(e); save(); res.json(e);
});

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
app.post('/api/report/share', auth, (req, res) => {
  const { date, teamId } = req.body;
  if (!requireMember(req, res, teamId)) return;
  for (const e of db.entries.filter((e) => e.userId === req.user.id && e.date === date)) {
    e.sharedTeams = e.sharedTeams || [];
    if (!e.sharedTeams.includes(teamId)) e.sharedTeams.push(teamId);
  }
  save(); res.json({ ok: true });
});

// ================= 건강 앱 연동 =================
// 개인 토큰 발급 (아이폰 단축어가 이 토큰으로 전송)
app.post('/api/health/token', auth, (req, res) => {
  req.user.healthToken = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 24)();
  save(); res.json({ healthToken: req.user.healthToken });
});
// 단축어/외부에서 운동 전송: POST /api/health/import/:token  body: { workouts: [...] } 또는 단축어 텍스트
app.post('/api/health/import/:token', express.text({ type: '*/*', limit: '5mb' }), (req, res) => {
  const user = db.users.find((u) => u.healthToken && u.healthToken === req.params.token);
  if (!user) return res.status(401).json({ error: '잘못된 토큰' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = { text: body }; } }
  const workouts = normalizeWorkouts(body, 'apple');
  const added = importWorkouts(user, workouts);
  res.json({ ok: true, added, message: `${added}개 운동을 가져왔어요` });
});
// 삼성 헬스 CSV 업로드
app.post('/api/health/samsung', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'CSV 파일이 필요합니다' });
  const text = fs.readFileSync(req.file.path, 'utf8'); fs.unlink(req.file.path, () => {});
  const workouts = parseSamsungCsv(text);
  const added = importWorkouts(req.user, workouts);
  res.json({ ok: true, added, parsed: workouts.length });
});
function importWorkouts(user, workouts) {
  let added = 0;
  for (const w of workouts) {
    const key = `${w.source}:${w.externalId || w.start}`;
    if (db.entries.some((e) => e.userId === user.id && e.externalKey === key)) continue;
    db.entries.push({
      id: nanoid(10), userId: user.id, type: 'workout', date: w.date, createdAt: w.start || Date.now(),
      title: w.name, memo: '', minutes: w.minutes, calories: w.calories, distanceKm: w.distanceKm,
      exercises: [], volume: 0, source: w.source, externalKey: key, sharedTeams: [],
    });
    added++;
  }
  if (added) save();
  return added;
}

// ================= 유틸 =================
function parseTeams(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return String(v).split(',').filter(Boolean); }
}
function withSummary(group) {
  const es = group.entries;
  const meals = es.filter((e) => e.type === 'meal');
  const ws = es.filter((e) => e.type === 'workout');
  const nutrition = meals.reduce((a, m) => {
    const t = m.analysis?.total || {};
    for (const k of ['calories', 'carbs', 'protein', 'fat', 'sodium', 'sugar']) a[k] += n(t[k]);
    return a;
  }, { calories: 0, carbs: 0, protein: 0, fat: 0, sodium: 0, sugar: 0 });
  return {
    ...group,
    summary: {
      studyMinutes: es.filter((e) => e.type === 'study').reduce((a, e) => a + n(e.minutes), 0),
      studyCount: es.filter((e) => e.type === 'study').length,
      mealCount: meals.length,
      workoutCount: ws.length,
      workoutMinutes: ws.reduce((a, e) => a + n(e.minutes), 0),
      workoutVolume: ws.reduce((a, e) => a + n(e.volume), 0),
      workoutCalories: ws.reduce((a, e) => a + n(e.calories), 0),
      nutrition,
    },
  };
}

const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api|\/uploads).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const PORT = process.env.PORT || 3000;
await load();
app.listen(PORT, () => console.log(`FitBand server on http://localhost:${PORT} (OpenAI: ${process.env.OPENAI_API_KEY ? 'on' : 'mock'})`));
