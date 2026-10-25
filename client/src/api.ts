export type User = { id: string; name: string };
export type Team = { id: string; name: string; desc: string; ownerId: string; inviteCode: string; memberCount?: number; todayCount?: number; members?: User[]; isMember?: boolean };
export type Nutrition = { calories: number; carbs: number; protein: number; fat: number; sodium: number; sugar: number };
export type Food = Nutrition & { name: string; amount: string };
export type Entry = {
  id: string; userId: string; type: 'study' | 'meal' | 'workout'; date: string; createdAt: number;
  memo?: string; subject?: string; minutes?: number; file?: string | null; fileType?: 'video' | 'image' | null;
  mealType?: string; analysis?: { foods: Food[]; total: Nutrition; comment: string };
  title?: string; sharedTeams: string[];
};
export type Summary = { studyMinutes: number; studyCount: number; mealCount: number; workoutCount: number; workoutMinutes: number; nutrition: Nutrition };
export type Report = { date: string; user: User; entries: Entry[]; summary: Summary };

const KEY = 'fitband.user';
export const getUser = (): User | null => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
export const setUser = (u: User | null) => u ? localStorage.setItem(KEY, JSON.stringify(u)) : localStorage.removeItem(KEY);

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as any) };
  const u = getUser();
  if (u) headers['x-user-id'] = u.id;
  if (init.body && !(init.body instanceof FormData)) headers['content-type'] = 'application/json';
  const res = await fetch(path, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && u) { setUser(null); location.reload(); }
  if (!res.ok) throw new Error(data.error || `오류 (${res.status})`);
  return data;
}

export const api = {
  login: (name: string) => req<User>('/api/login', { method: 'POST', body: JSON.stringify({ name }) }),
  teams: () => req<Team[]>('/api/teams'),
  createTeam: (name: string, desc: string) => req<Team>('/api/teams', { method: 'POST', body: JSON.stringify({ name, desc }) }),
  team: (id: string) => req<Team>(`/api/teams/${id}`),
  teamQr: (id: string) => req<{ url: string; dataUrl: string; inviteCode: string }>(`/api/teams/${id}/qr?origin=${encodeURIComponent(location.origin)}`),
  invite: (code: string) => req<Team>(`/api/invite/${code}`),
  join: (code: string) => req<Team>(`/api/invite/${code}/join`, { method: 'POST' }),
  feed: (id: string) => req<Report[]>(`/api/teams/${id}/feed`),
  report: (date: string) => req<Report>(`/api/report?date=${date}`),
  calendar: () => req<Record<string, { study: number; meal: number; workout: number }>>('/api/report/calendar'),
  addStudy: (fd: FormData) => req<Entry>('/api/entries/study', { method: 'POST', body: fd }),
  addMeal: (fd: FormData) => req<Entry>('/api/entries/meal', { method: 'POST', body: fd }),
  addWorkout: (body: object) => req<Entry>('/api/entries/workout', { method: 'POST', body: JSON.stringify(body) }),
  deleteEntry: (id: string) => req(`/api/entries/${id}`, { method: 'DELETE' }),
  shareReport: (date: string, teamId: string) => req('/api/report/share', { method: 'POST', body: JSON.stringify({ date, teamId }) }),
};

export const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const shiftDate = (s: string, n: number) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const fmtDate = (s: string) => { const d = new Date(s + 'T00:00:00'); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${'일월화수목금토'[d.getDay()]})`; };
export const fmtTime = (t: number) => new Date(t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
export const colorOf = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h} 60% 55%)`; };
