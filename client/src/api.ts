export type User = { id: string; name: string; email?: string; calorieGoal?: number; healthToken?: string };
export type Team = { id: string; name: string; desc: string; emoji?: string; photo?: string | null; color?: string; ownerId: string; inviteCode: string; memberCount?: number; todayCount?: number; members?: User[]; isMember?: boolean };
export type Nutrition = { calories: number; carbs: number; protein: number; fat: number; sodium: number; sugar: number };
export type Food = Nutrition & { name: string; amount: string };
export type SetRow = { weight: number; reps: number };
export type Exercise = { name: string; sets: SetRow[] };
export type Entry = {
  id: string; userId: string; type: 'study' | 'meal' | 'workout'; date: string; createdAt: number;
  memo?: string; subject?: string; minutes?: number; file?: string | null; fileType?: 'video' | 'image' | null;
  mealType?: string; analysis?: { foods: Food[]; total: Nutrition; comment: string };
  title?: string; exercises?: Exercise[]; volume?: number; calories?: number; distanceKm?: number; source?: 'manual' | 'apple' | 'samsung';
  sharedTeams: string[];
};
export type Summary = { studyMinutes: number; studyCount: number; mealCount: number; workoutCount: number; workoutMinutes: number; workoutVolume: number; workoutCalories: number; nutrition: Nutrition };
export type Comment = { id: string; text: string; createdAt: number; author: { id: string; name: string } };
export type Report = { date: string; user: User; entries: Entry[]; summary: Summary; key?: string; teamId?: string; likes?: string[]; liked?: boolean; comments?: Comment[] };
export type DayStat = Summary & { date: string };
export type DayFeed = { date: string; reports: Report[]; submitted: User[]; missing: User[] };
export type Post = { id: string; teamId: string; text: string; photo: string | null; createdAt: number; date: string; author: User; likes: string[]; liked: boolean; comments: Comment[] };
export type TeamCalendar = { members: User[]; days: Record<string, { submitted: string[]; study: number; meal: number; workout: number }> };
export type MemberStat = { user: User; perDay: (DayStat & { submitted: boolean })[]; total: { submittedDays: number; studyMinutes: number; workoutMinutes: number; workoutVolume: number; workoutCount: number; calories: number; mealDays: number; avgCalories: number } };
export type TeamStats = { dates: string[]; members: MemberStat[] };

const KEY = 'fitband.session';
type Session = { token: string; refresh?: string; user: User };
export const getSession = (): Session | null => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
export const setSession = (s: Session | null) => s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY);
export const getUser = () => getSession()?.user || null;

let refreshing: Promise<boolean> | null = null;
async function tryRefresh(): Promise<boolean> {
  const s = getSession();
  if (!s?.refresh) return false;
  refreshing ||= fetch('/api/auth/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refresh: s.refresh }) })
    .then(async (r) => { if (!r.ok) return false; setSession(await r.json()); return true; }).catch(() => false).finally(() => { refreshing = null; });
  return refreshing;
}

async function req<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as any) };
  const s = getSession();
  if (s) headers['authorization'] = `Bearer ${s.token}`;
  if (init.body && !(init.body instanceof FormData)) headers['content-type'] = 'application/json';
  const res = await fetch(path, { ...init, headers });
  if (res.status === 401 && s) {
    if (retry && await tryRefresh()) return req(path, init, false);
    setSession(null); location.reload();
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `오류 (${res.status})`);
  return data;
}

export const api = {
  signup: (email: string, password: string, name: string) => req<Session>('/api/auth/signup', { method: 'POST', body: JSON.stringify({ email, password, name }) }),
  login: (email: string, password: string) => req<Session>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => req<User>('/api/me'),
  updateMe: (body: Partial<User>) => req<User>('/api/me', { method: 'PATCH', body: JSON.stringify(body) }),
  teams: () => req<Team[]>('/api/teams'),
  createTeam: (name: string, desc: string) => req<Team>('/api/teams', { method: 'POST', body: JSON.stringify({ name, desc }) }),
  team: (id: string) => req<Team>(`/api/teams/${id}`),
  updateTeam: (id: string, body: Partial<Team>) => req<Team>(`/api/teams/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  teamPhoto: (id: string, fd: FormData) => req<Team>(`/api/teams/${id}/photo`, { method: 'POST', body: fd }),
  leaveTeam: (id: string) => req(`/api/teams/${id}/leave`, { method: 'DELETE' }),
  teamQr: (id: string) => req<{ url: string; dataUrl: string; inviteCode: string }>(`/api/teams/${id}/qr?origin=${encodeURIComponent(location.origin)}`),
  invite: (code: string) => req<Team>(`/api/invite/${code}`),
  join: (code: string) => req<Team>(`/api/invite/${code}/join`, { method: 'POST' }),
  feed: (id: string, date: string) => req<DayFeed>(`/api/teams/${id}/feed?date=${date}`),
  teamCalendar: (id: string, from: string, to: string) => req<TeamCalendar>(`/api/teams/${id}/calendar?from=${from}&to=${to}`),
  teamStats: (id: string, days: number) => req<TeamStats>(`/api/teams/${id}/stats?days=${days}`),
  like: (teamId: string, target: { date: string; userId: string } | { postId: string }) => req<{ liked: boolean }>(`/api/teams/${teamId}/like`, { method: 'POST', body: JSON.stringify(target) }),
  comment: (teamId: string, target: { date: string; userId: string } | { postId: string }, text: string) => req<Comment>(`/api/teams/${teamId}/comments`, { method: 'POST', body: JSON.stringify({ ...target, text }) }),
  posts: (id: string) => req<Post[]>(`/api/teams/${id}/posts`),
  createPost: (id: string, fd: FormData) => req<Post>(`/api/teams/${id}/posts`, { method: 'POST', body: fd }),
  deletePost: (id: string) => req(`/api/posts/${id}`, { method: 'DELETE' }),
  deleteComment: (id: string) => req(`/api/comments/${id}`, { method: 'DELETE' }),
  report: (date: string) => req<Report>(`/api/report?date=${date}`),
  calendar: () => req<Record<string, { study: number; meal: number; workout: number }>>('/api/report/calendar'),
  stats: (days: number) => req<{ days: DayStat[]; calorieGoal: number }>(`/api/stats?days=${days}`),
  addStudy: (fd: FormData) => req<Entry>('/api/entries/study', { method: 'POST', body: fd }),
  addMeal: (fd: FormData) => req<Entry>('/api/entries/meal', { method: 'POST', body: fd }),
  addWorkout: (body: object) => req<Entry>('/api/entries/workout', { method: 'POST', body: JSON.stringify(body) }),
  deleteEntry: (id: string) => req(`/api/entries/${id}`, { method: 'DELETE' }),
  shareReport: (date: string, teamId: string) => req('/api/report/share', { method: 'POST', body: JSON.stringify({ date, teamId }) }),
  healthToken: () => req<{ healthToken: string }>('/api/health/token', { method: 'POST' }),
  samsungCsv: (fd: FormData) => req<{ added: number; parsed: number }>('/api/health/samsung', { method: 'POST', body: fd }),
};

const pad = (n: number) => String(n).padStart(2, '0');
export const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const shiftDate = (s: string, n: number) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const fmtDate = (s: string) => { const d = new Date(s + 'T00:00:00'); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${'일월화수목금토'[d.getDay()]})`; };
export const fmtTime = (t: number) => new Date(t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
export const colorOf = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h} 70% 65%)`; };
export const sourceLabel = (s?: string) => s === 'apple' ? '🍎 건강' : s === 'samsung' ? '💠 삼성헬스' : '';
