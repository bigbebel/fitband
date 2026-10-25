import React, { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { api, colorOf, fmtTime, sourceLabel, type Entry, type Report, type Summary, type Team } from './api';

export function TeamAvatar({ team, size = 44 }: { team: Pick<Team, 'id' | 'name' | 'emoji' | 'photo' | 'color'>; size?: number }) {
  const style = { width: size, height: size, fontSize: size * 0.42, background: team.color || colorOf(team.id), borderRadius: size * 0.3 };
  if (team.photo) return <img src={team.photo} alt="" className="avatar" style={{ ...style, objectFit: 'cover' }} />;
  if (team.emoji) return <div className="avatar" style={{ ...style, fontSize: size * 0.55 }}>{team.emoji}</div>;
  return <div className="avatar" style={style}>{team.name[0]}</div>;
}

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
      <NavLink to="/report" className={cls}><span className="ico">📝</span>보고서</NavLink>
      <NavLink to="/stats" className={cls}><span className="ico">📈</span>통계</NavLink>
      <NavLink to="/me" className={cls}><span className="ico">👤</span>내 정보</NavLink>
    </nav>
  );
}

export function Sheet({ title, onClose, children, tall }: { title: string; onClose: () => void; children: ReactNode; tall?: boolean }) {
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className={'sheet' + (tall ? ' tall' : '')} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function Ring({ pct, label, value, color = 'var(--meal)' }: { pct: number; label: string; value: string; color?: string }) {
  const r = 38, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, pct));
  return (
    <div className="ring">
      <svg width="92" height="92" viewBox="0 0 92 92">
        <circle cx="46" cy="46" r={r} fill="none" stroke="var(--card2)" strokeWidth="9" />
        <circle cx="46" cy="46" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)} style={{ transition: 'stroke-dashoffset .5s' }} />
      </svg>
      <div className="v">{value}<span>{label}</span></div>
    </div>
  );
}

// ---- 하루 요약 ----
export function SummaryCard({ s, goal = 2000 }: { s: Summary; goal?: number }) {
  const n = s.nutrition;
  const pct = Math.round((n.calories / goal) * 100);
  return (
    <div className="card hero">
      <div className="row" style={{ gap: 16 }}>
        <Ring pct={pct} value={`${pct}%`} label="칼로리" />
        <div className="grow">
          <div className="big">{Math.round(n.calories)}<span className="muted" style={{ fontSize: 14, fontWeight: 600 }}> / {goal} kcal</span></div>
          <div className="muted" style={{ marginTop: 6 }}>{pct < 100 ? `${goal - Math.round(n.calories)} kcal 남음` : `${Math.round(n.calories) - goal} kcal 초과`}</div>
          <div className="nutri" style={{ marginTop: 10, justifyContent: 'flex-start', gap: 14 }}>
            <div><b>{Math.round(n.carbs)}g</b>탄수</div>
            <div><b>{Math.round(n.protein)}g</b>단백질</div>
            <div><b>{Math.round(n.fat)}g</b>지방</div>
          </div>
        </div>
      </div>
      <div className="stat-grid" style={{ marginTop: 14 }}>
        <div className="stat study"><b>{s.studyMinutes}<small style={{ fontSize: 12 }}>분</small></b><span>공부 {s.studyCount}회</span></div>
        <div className="stat meal"><b>{s.mealCount}<small style={{ fontSize: 12 }}>끼</small></b><span>나트륨 {Math.round(n.sodium)}mg</span></div>
        <div className="stat workout"><b>{s.workoutMinutes}<small style={{ fontSize: 12 }}>분</small></b><span>운동 {s.workoutCount}회{s.workoutVolume ? ` · ${fmtVol(s.workoutVolume)}` : ''}</span></div>
      </div>
    </div>
  );
}
export const fmtVol = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}t` : `${Math.round(v)}kg`;

// ---- 항목 하나 ----
export function EntryCard({ e, teams, onDelete }: { e: Entry; teams?: Team[]; onDelete?: (id: string) => void }) {
  const label = { study: '📚 공부', meal: '🍽 식단', workout: '💪 운동' }[e.type];
  const shared = teams?.filter((t) => e.sharedTeams?.includes(t.id)) || [];
  return (
    <div className={`entry ${e.type}`}>
      <div className="meta">
        <span>{label}{e.subject ? ` · ${e.subject}` : ''}{e.mealType ? ` · ${e.mealType}` : ''}{e.minutes ? ` · ${e.minutes}분` : ''} {sourceLabel(e.source)}</span>
        <span>{fmtTime(e.createdAt)}{onDelete && <button onClick={() => onDelete(e.id)} style={{ border: 0, background: 'none', color: 'var(--danger)', marginLeft: 8, cursor: 'pointer' }}>삭제</button>}</span>
      </div>
      {e.type === 'workout' && (
        <>
          <b style={{ fontSize: 15 }}>{e.title}</b>
          <div className="muted small" style={{ marginTop: 2 }}>
            {e.volume ? `볼륨 ${fmtVol(e.volume)} · ` : ''}{e.calories ? `${e.calories} kcal · ` : ''}{e.distanceKm ? `${e.distanceKm} km · ` : ''}{e.exercises?.length ? `${e.exercises.length}종목 ${e.exercises.reduce((a, x) => a + x.sets.length, 0)}세트` : ''}
          </div>
          {e.exercises?.map((x, i) => (
            <div className="set-list" key={i}>
              <div><b>{x.name}</b><span>{x.sets.map((s) => `${s.weight || '-'}×${s.reps}`).join('  ')}</span></div>
            </div>
          ))}
        </>
      )}
      {e.type === 'meal' && e.analysis && (
        <>
          <b style={{ fontSize: 15 }}>{Math.round(e.analysis.total.calories)} kcal</b>
          <span className="muted small"> · 탄 {Math.round(e.analysis.total.carbs)}g · 단 {Math.round(e.analysis.total.protein)}g · 지 {Math.round(e.analysis.total.fat)}g</span>
          <table className="foods"><tbody>
            {e.analysis.foods.map((f, i) => <tr key={i}><td>{f.name} <span className="muted">{f.amount}</span></td><td>{Math.round(f.calories)} kcal</td></tr>)}
          </tbody></table>
          {e.analysis.comment && <div className="muted small" style={{ marginTop: 6 }}>💬 {e.analysis.comment}</div>}
        </>
      )}
      {e.memo && <pre>{e.memo}</pre>}
      {e.file && e.fileType === 'video' && <video src={e.file} controls playsInline preload="metadata" />}
      {e.file && e.fileType !== 'video' && <img src={e.file} alt="" loading="lazy" />}
      {shared.length > 0 && <div style={{ marginTop: 6 }}>{shared.map((t) => <span className="tag" key={t.id}>{t.name}</span>)}</div>}
    </div>
  );
}

export function ReportView({ r, teams, onDelete }: { r: Report; teams?: Team[]; onDelete?: (id: string) => void }) {
  const by = (t: Entry['type']) => r.entries.filter((e) => e.type === t);
  return (
    <>
      <SummaryCard s={r.summary} goal={r.user.calorieGoal || 2000} />
      {r.entries.length === 0 && <div className="empty">아직 기록이 없어요</div>}
      {(['workout', 'meal', 'study'] as const).map((t) => by(t).length > 0 && (
        <div className="card" key={t}>
          <h3>{{ study: '📚 공부', meal: '🍽 식단', workout: '💪 운동' }[t]}</h3>
          {by(t).map((e) => <EntryCard key={e.id} e={e} teams={teams} onDelete={onDelete} />)}
        </div>
      ))}
    </>
  );
}

export function TeamPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [teams, setTeams] = useState<Team[]>([]);
  useEffect(() => { api.teams().then(setTeams).catch(() => {}); }, []);
  if (teams.length === 0) return <div className="muted small" style={{ marginBottom: 12 }}>공유할 팀이 없어요. 홈에서 팀을 만들거나 참여해 보세요.</div>;
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="muted small" style={{ marginBottom: 6 }}>팀에 공유</div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
        {teams.map((t) => {
          const on = value.includes(t.id);
          return <button key={t.id} className={'like-btn' + (on ? ' on' : '')} onClick={() => onChange(on ? value.filter((x) => x !== t.id) : [...value, t.id])}>{on ? '✓ ' : ''}{t.name}</button>;
        })}
      </div>
    </div>
  );
}

// 큰 업로드 영역: 카메라로 찍기 / 앨범에서 선택 두 버튼
export function FilePick({ accept, file, onChange, hint, icon = '📷', color = 'var(--meal)', video }: { accept: string; file: File | null; onChange: (f: File | null) => void; hint: string; icon?: string; color?: string; video?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { if (!file) return setUrl(null); const u = URL.createObjectURL(file); setUrl(u); return () => URL.revokeObjectURL(u); }, [file]);
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => { onChange(e.target.files?.[0] || null); e.target.value = ''; };
  if (url) return (
    <div className="file-big has" style={{ borderColor: color }}>
      {file!.type.startsWith('video') ? <video src={url} controls playsInline /> : <img src={url} alt="" />}
      <button className="btn sm ghost" style={{ position: 'absolute', top: 10, right: 10 }} onClick={() => onChange(null)}>✕ 다시 선택</button>
    </div>
  );
  return (
    <div className="file-big" style={{ borderColor: color }}>
      <div className="file-ico" style={{ background: color }}>{icon}</div>
      <div className="file-hint">{hint}</div>
      <div className="row" style={{ width: '100%', gap: 8 }}>
        <label className="btn" style={{ background: color, color: '#0b0d11' }}>
          <input type="file" accept={accept} capture="environment" onChange={pick} hidden />{video ? '🎥 직접 촬영' : '📷 카메라로 찍기'}
        </label>
        <label className="btn ghost">
          <input type="file" accept={accept} onChange={pick} hidden />🖼 앨범에서 선택
        </label>
      </div>
    </div>
  );
}
