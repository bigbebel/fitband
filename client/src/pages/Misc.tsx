import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, getUser, setUser, type Team } from '../api';
import { TopBar } from '../components';

export function Login({ onLogin }: { onLogin: () => void }) {
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const go = async () => { try { setUser(await api.login(name)); onLogin(); } catch (e: any) { setErr(e.message); } };
  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100dvh' }}>
      <div className="center" style={{ marginBottom: 30 }}>
        <div style={{ fontSize: 56 }}>📊</div>
        <h1 style={{ margin: '8px 0 4px' }}>FitBand</h1>
        <p className="muted">팀과 함께하는 공부 · 식단 · 운동 보고서</p>
      </div>
      <div className="card">
        <label className="field"><span>닉네임</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} placeholder="닉네임으로 시작하기" /></label>
        {err && <p className="small" style={{ color: 'var(--danger)' }}>{err}</p>}
        <button className="btn" disabled={!name.trim()} onClick={go}>시작하기</button>
      </div>
      <p className="muted small center">초안 버전: 닉네임만으로 로그인됩니다. (추후 소셜 로그인 교체 예정)</p>
    </div>
  );
}

export function Join({ onDone }: { onDone: () => void }) {
  const { code = '' } = useParams();
  const [team, setTeam] = useState<Team | null>(null);
  const [err, setErr] = useState('');
  const nav = useNavigate();
  useEffect(() => { api.invite(code).then(setTeam).catch((e) => setErr(e.message)); }, [code]);
  const join = async () => { const t = await api.join(code); onDone(); nav(`/team/${t.id}`, { replace: true }); };
  return (
    <>
      <TopBar title="팀 초대" />
      <div className="page">
        {err && <div className="empty">{err}</div>}
        {team && (
          <div className="card center" style={{ padding: 30 }}>
            <div style={{ fontSize: 40 }}>👥</div>
            <h2 style={{ margin: '8px 0 4px' }}>{team.name}</h2>
            <p className="muted">{team.desc || '소개 없음'} · 멤버 {team.memberCount}명</p>
            <button className="btn" onClick={join}>이 팀에 참여하기</button>
          </div>
        )}
      </div>
    </>
  );
}

export function Me({ onLogout }: { onLogout: () => void }) {
  const u = getUser();
  const [cal, setCal] = useState<Record<string, { study: number; meal: number; workout: number }>>({});
  useEffect(() => { api.calendar().then(setCal).catch(() => {}); }, []);
  const days = Object.keys(cal).sort().reverse();
  const total = days.reduce((a, d) => ({ study: a.study + cal[d].study, meal: a.meal + cal[d].meal, workout: a.workout + cal[d].workout }), { study: 0, meal: 0, workout: 0 });
  return (
    <>
      <TopBar title="내 정보" />
      <div className="page">
        <div className="card row">
          <div className="avatar" style={{ background: 'var(--primary)' }}>{u?.name[0]}</div>
          <div className="grow"><b>{u?.name}</b><div className="muted small">기록한 날 {days.length}일</div></div>
          <button className="btn outline sm" onClick={() => { setUser(null); onLogout(); }}>로그아웃</button>
        </div>
        <div className="card">
          <h3>누적 기록</h3>
          <div className="stat-grid">
            <div className="stat study"><b>{total.study}</b><span>공부</span></div>
            <div className="stat meal"><b>{total.meal}</b><span>식단</span></div>
            <div className="stat workout"><b>{total.workout}</b><span>운동</span></div>
          </div>
        </div>
        <div className="card">
          <h3>기록 히스토리</h3>
          {days.length === 0 && <div className="empty">아직 기록이 없어요</div>}
          {days.map((d) => <div key={d} className="row" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}><span className="grow">{d}</span><span className="muted small">📚{cal[d].study} 🍽{cal[d].meal} 💪{cal[d].workout}</span></div>)}
        </div>
      </div>
    </>
  );
}
