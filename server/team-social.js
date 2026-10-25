// 팀 소셜 기능: 날짜별 보고서 피드 + 제출 현황, 게시글, 좋아요/댓글(공통 target), 달력, 팀원별 통계
import { nanoid } from 'nanoid';
import db, { save, storeUpload } from './db.js';

const kst = (ts = Date.now()) => new Date(ts + 9 * 3600 * 1000).toISOString().slice(0, 10);
const n = (v) => Number(v) || 0;
export const reportTarget = (date, userId) => `r:${date}:${userId}`;
export const postTarget = (postId) => `p:${postId}`;

// 예전 데이터(date/userId 기반) → target 필드로 마이그레이션
export function migrateSocial() {
  let changed = false;
  for (const l of db.likes) if (!l.target && l.date && l.userId) { l.target = reportTarget(l.date, l.userId); changed = true; }
  for (const c of db.comments) if (!c.target && c.date && c.userId) { c.target = reportTarget(c.date, c.userId); changed = true; }
  if (changed) save();
}

export function userBrief(id) { const u = db.users.find((x) => x.id === id); return { id, name: u?.name || '?', calorieGoal: u?.calorieGoal || 2000 }; }
const withAuthor = (c) => ({ ...c, author: userBrief(c.authorId) });
export function social(teamId, target, me) {
  return {
    likes: db.likes.filter((l) => l.teamId === teamId && l.target === target).map((l) => l.authorId),
    liked: db.likes.some((l) => l.teamId === teamId && l.target === target && l.authorId === me),
    comments: db.comments.filter((c) => c.teamId === teamId && c.target === target).map(withAuthor),
  };
}
export function toggleLike(teamId, target, me) {
  const i = db.likes.findIndex((l) => l.teamId === teamId && l.target === target && l.authorId === me);
  if (i >= 0) db.likes.splice(i, 1); else db.likes.push({ teamId, target, authorId: me, createdAt: Date.now() });
  save(); return i < 0;
}
export function addComment(teamId, target, me, text) {
  const c = { id: nanoid(10), teamId, target, authorId: me, text: String(text).trim(), createdAt: Date.now() };
  db.comments.push(c); save(); return withAuthor(c);
}
export function targetOf(body) {
  if (body.postId) return postTarget(body.postId);
  if (body.date && body.userId) return reportTarget(body.date, body.userId);
  return null;
}

export function teamMembers(teamId) {
  return db.members.filter((m) => m.teamId === teamId).map((m) => userBrief(m.userId));
}

// 특정 날짜의 팀 보고서 + 제출/미제출
export function dayFeed(team, date, me, withSummary) {
  const members = teamMembers(team.id);
  const reports = members.map((u) => {
    const entries = db.entries.filter((e) => e.userId === u.id && e.date === date && e.sharedTeams?.includes(team.id)).sort((a, b) => b.createdAt - a.createdAt);
    if (!entries.length) return null;
    const g = withSummary({ key: `${date}|${u.id}`, teamId: team.id, date, user: u, entries });
    return { ...g, ...social(team.id, reportTarget(date, u.id), me) };
  }).filter(Boolean);
  const submittedIds = new Set(reports.map((r) => r.user.id));
  return { date, reports, submitted: members.filter((u) => submittedIds.has(u.id)), missing: members.filter((u) => !submittedIds.has(u.id)) };
}

// 달력: from~to 날짜별 제출자 목록
export function calendar(team, from, to) {
  const members = teamMembers(team.id);
  const out = {};
  for (const e of db.entries) {
    if (!e.sharedTeams?.includes(team.id) || e.date < from || e.date > to) continue;
    const d = (out[e.date] ||= { users: {}, study: 0, meal: 0, workout: 0 });
    d.users[e.userId] = true; d[e.type]++;
  }
  const days = {};
  for (const [date, d] of Object.entries(out)) days[date] = { submitted: Object.keys(d.users), study: d.study, meal: d.meal, workout: d.workout };
  return { members, days };
}

// 팀원별 통계 (최근 N일)
export function teamStats(team, days, withSummary) {
  const dates = []; for (let i = days - 1; i >= 0; i--) dates.push(kst(Date.now() - i * 86400000));
  const members = teamMembers(team.id).map((u) => {
    const perDay = dates.map((date) => {
      const es = db.entries.filter((e) => e.userId === u.id && e.date === date && e.sharedTeams?.includes(team.id));
      return { date, submitted: es.length > 0, ...withSummary({ entries: es }).summary };
    });
    const total = perDay.reduce((a, d) => ({
      submittedDays: a.submittedDays + (d.submitted ? 1 : 0), studyMinutes: a.studyMinutes + d.studyMinutes, workoutMinutes: a.workoutMinutes + d.workoutMinutes,
      workoutVolume: a.workoutVolume + d.workoutVolume, workoutCount: a.workoutCount + d.workoutCount, calories: a.calories + d.nutrition.calories, mealDays: a.mealDays + (d.mealCount ? 1 : 0),
    }), { submittedDays: 0, studyMinutes: 0, workoutMinutes: 0, workoutVolume: 0, workoutCount: 0, calories: 0, mealDays: 0 });
    return { user: u, perDay, total: { ...total, avgCalories: total.mealDays ? Math.round(total.calories / total.mealDays) : 0 } };
  });
  return { dates, members };
}

// 게시글
export function listPosts(team, me, limit = 50, before) {
  let posts = db.posts.filter((p) => p.teamId === team.id);
  if (before) posts = posts.filter((p) => p.createdAt < n(before));
  return posts.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit).map((p) => ({ ...p, author: userBrief(p.authorId), ...social(team.id, postTarget(p.id), me) }));
}
export async function createPost(team, me, text, file) {
  let photo = null;
  if (file) photo = await storeUpload(file.path, 'post-' + file.filename, file.mimetype);
  const p = { id: nanoid(10), teamId: team.id, authorId: me, text: String(text || '').trim(), photo, createdAt: Date.now(), date: kst() };
  db.posts.push(p); save();
  return { ...p, author: userBrief(me), likes: [], liked: false, comments: [] };
}
export function deletePost(id, me) {
  const i = db.posts.findIndex((p) => p.id === id && p.authorId === me);
  if (i < 0) return false;
  db.posts.splice(i, 1);
  const t = postTarget(id);
  db.likes = db.likes.filter((l) => l.target !== t); db.comments = db.comments.filter((c) => c.target !== t);
  save(); return true;
}
