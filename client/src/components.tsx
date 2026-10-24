import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { api, fmtTime, type Entry, type Report, type Summary, type Team } from './api';

export function TopBar({ title, back, right }: { title: string; back?: boolean; right?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="topbar">
      {back && <button className="back" onClick={() => nav(-1)}>‹</button>}
      <h1>{title}</h1>
      {right}
    </header>
  );
}

export function TabBar() {
  const cls = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : '');
  return (
    <nav className="tabbar">
      <NavLink to="/" end className={cls}><span className="ico">🏠</span>홈</NavLink>
      <NavLink to="/report" className={cls}><span className="ico">📊</span>보고서</NavLink>
      <NavLink to="/me" className={cls}><span className="ico">👤</span>내 정보</NavLink>
    </nav>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

// ---- 하루 요약 카드 ----
export function SummaryCard({ s }: { s: Summary }) {
  const n = s.nutrition;
  const goal = 2000;
  const pct = Math.min(100, Math.round((n.calories / goal) * 100));
  return (
    <div className="card">
      <div className="stat-grid">
        <div className="stat study"><b>{s.studyMinutes}분</b><span>공부 · {s.studyCount}회</span></div>
        <div className="stat meal"><b>{Math.round(n.calories)}</b><span>kcal · {s.mealCount}끼</span></div>
        <div className="stat workout"><b>{s.workoutMinutes}분</b><span>운동 · {s.workoutCount}회</span></div>
      </div>
      <div className="muted small" style={{ marginTop: 10 }}>오늘 섭취 칼로리 {Math.round(n.calories)} / {goal} kcal</div>
      <div className="bar"><i style={{ width: pct + '%', background: 'var(--meal)' }} /></div>
      <div className="nutri">
        <div><b>{Math.round(n.carbs)}g</b>탄수화물</div>
        <div><b>{Math.round(n.protein)}g</b>단백질</div>
        <div><b>{Math.round(n.fat)}g</b>지방</div>
        <div><b>{Math.round(n.sodium)}mg</b>나트륨</div>
        <div><b>{Math.round(n.sugar)}g</b>당</div>
      </div>
    </div>
  );
}

// ---- 항목 하나 ----
export function EntryCard({ e, teams, onDelete }: { e: Entry; teams?: Team[]; onDelete?: (id: string) => void }) {
  const label = { study: '📚 공부', meal: '🍽 식단', workout: '💪 운동' }[e.type];
  const shared = teams?.filter((t) => e.sharedTeams?.includes(t.id)) || [];
  return (
    <div className={`entry ${e.type}`}>
      <div className="meta">
        <span>{label}{e.subject ? ` · ${e.subject}` : ''}{e.mealType ? ` · ${e.mealType}` : ''}{e.title ? ` · ${e.title}` : ''}{e.minutes ? ` · ${e.minutes}분` : ''}</span>
        <span>{fmtTime(e.createdAt)}{onDelete && <button onClick={() => onDelete(e.id)} style={{ border: 0, background: 'none', color: 'var(--danger)', marginLeft: 8, cursor: 'pointer' }}>삭제</button>}</span>
      </div>
      {e.type === 'meal' && e.analysis && (
        <>
          <b>{Math.round(e.analysis.total.calories)} kcal</b>
          <span className="muted small"> · 탄 {Math.round(e.analysis.total.carbs)}g · 단 {Math.round(e.analysis.total.protein)}g · 지 {Math.round(e.analysis.total.fat)}g</span>
          <table className="foods"><tbody>
            {e.analysis.foods.map((f, i) => <tr key={i}><td>{f.name} <span className="muted">{f.amount}</span></td><td>{Math.round(f.calories)} kcal</td></tr>)}
          </tbody></table>
          {e.analysis.comment && <div className="muted small" style={{ marginTop: 4 }}>💬 {e.analysis.comment}</div>}
        </>
      )}
      {e.memo && <pre>{e.memo}</pre>}
      {e.file && e.fileType === 'video' && <video src={e.file} controls playsInline />}
      {e.file && e.fileType !== 'video' && <img src={e.file} alt="" loading="lazy" />}
      {shared.length > 0 && <div style={{ marginTop: 6 }}>{shared.map((t) => <span className="tag" key={t.id}>{t.name}</span>)}</div>}
    </div>
  );
}

// ---- 하루 보고서 전체 ----
export function ReportView({ r, teams, onDelete, showUser }: { r: Report; teams?: Team[]; onDelete?: (id: string) => void; showUser?: boolean }) {
  const by = (t: Entry['type']) => r.entries.filter((e) => e.type === t);
  return (
    <>
      {showUser && <div className="row" style={{ marginBottom: 8 }}><b>{r.user.name}</b><span className="muted">{r.date}</span></div>}
      <SummaryCard s={r.summary} />
      {r.entries.length === 0 && <div className="empty">아직 기록이 없어요</div>}
      {(['study', 'meal', 'workout'] as const).map((t) => by(t).length > 0 && (
        <div className="card" key={t}>
          <h3>{{ study: '📚 공부', meal: '🍽 식단', workout: '💪 운동' }[t]}</h3>
          {by(t).map((e) => <EntryCard key={e.id} e={e} teams={teams} onDelete={onDelete} />)}
        </div>
      ))}
    </>
  );
}

// ---- 팀 선택 체크리스트 (공유 대상) ----
export function TeamPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [teams, setTeams] = useState<Team[]>([]);
  useEffect(() => { api.teams().then(setTeams).catch(() => {}); }, []);
  if (teams.length === 0) return <div className="muted small" style={{ marginBottom: 12 }}>공유할 팀이 없어요. 홈에서 팀을 만들거나 참여해 보세요.</div>;
  return (
    <div className="check-list" style={{ marginBottom: 12 }}>
      <div className="muted small">팀에 공유</div>
      {teams.map((t) => (
        <label key={t.id}>
          <input type="checkbox" checked={value.includes(t.id)} onChange={(e) => onChange(e.target.checked ? [...value, t.id] : value.filter((x) => x !== t.id))} />
          {t.name}
        </label>
      ))}
    </div>
  );
}

export function FilePick({ accept, file, onChange, hint }: { accept: string; file: File | null; onChange: (f: File | null) => void; hint: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { if (!file) return setUrl(null); const u = URL.createObjectURL(file); setUrl(u); return () => URL.revokeObjectURL(u); }, [file]);
  return (
    <label className="file-pick">
      <input type="file" accept={accept} onChange={(e) => onChange(e.target.files?.[0] || null)} />
      {url ? (file!.type.startsWith('video') ? <video src={url} controls playsInline /> : <img src={url} alt="" />) : hint}
    </label>
  );
}
