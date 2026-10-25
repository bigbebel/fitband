import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, colorOf, type Team } from '../api';
import { Sheet, TopBar } from '../components';
import { QrScanner } from './QrScanner';

export default function Home() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [mode, setMode] = useState<null | 'menu' | 'create' | 'join' | 'scan'>(null);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const nav = useNavigate();

  const load = () => api.teams().then(setTeams).catch(() => {});
  useEffect(() => { load(); }, []);

  const create = async () => {
    try { const t = await api.createTeam(name, desc); setMode(null); setName(''); setDesc(''); nav(`/team/${t.id}`); } catch (e: any) { setErr(e.message); }
  };
  const joinByCode = async (c: string) => {
    const m = c.match(/join\/([A-Za-z0-9]+)/);
    const real = (m ? m[1] : c).trim().toUpperCase();
    if (!real) return;
    try { const t = await api.join(real); setMode(null); setCode(''); nav(`/team/${t.id}`); } catch (e: any) { setErr(e.message); }
  };

  return (
    <>
      <TopBar title="FitBand" right={<button className="btn ghost sm" onClick={() => setMode('menu')}>＋ 팀</button>} />
      <div className="page">
        {teams.length === 0 ? (
          <div className="card center" style={{ padding: 30 }}>
            <div style={{ fontSize: 40 }}>👥</div>
            <h3>아직 참여한 팀이 없어요</h3>
            <p className="muted">팀을 만들어 친구를 QR 코드로 초대하거나,<br />친구의 QR 코드를 스캔해 참여해 보세요.</p>
            <button className="btn" onClick={() => setMode('create')}>팀 만들기</button>
            <div style={{ height: 8 }} />
            <button className="btn outline" onClick={() => setMode('scan')}>QR로 참여하기</button>
          </div>
        ) : (
          <div className="card">
            <h3>내 팀</h3>
            {teams.map((t) => (
              <Link to={`/team/${t.id}`} className="team-item" key={t.id}>
                <div className="avatar" style={{ background: colorOf(t.id) }}>{t.name[0]}</div>
                <div className="grow">
                  <b>{t.name}</b>
                  <div className="muted small">{t.desc || '소개 없음'} · 멤버 {t.memberCount}명</div>
                </div>
                {t.todayCount ? <span className="badge">오늘 {t.todayCount}명</span> : null}
              </Link>
            ))}
          </div>
        )}
      </div>
      <button className="fab" onClick={() => setMode('menu')}>＋</button>

      {mode === 'menu' && (
        <Sheet title="팀" onClose={() => setMode(null)}>
          <button className="btn" onClick={() => setMode('create')}>새 팀 만들기</button>
          <div style={{ height: 8 }} />
          <button className="btn outline" onClick={() => setMode('scan')}>📷 QR 코드 스캔으로 참여</button>
          <div style={{ height: 8 }} />
          <button className="btn ghost" onClick={() => setMode('join')}>초대 코드 입력으로 참여</button>
        </Sheet>
      )}
      {mode === 'create' && (
        <Sheet title="새 팀 만들기" onClose={() => setMode(null)}>
          <label className="field"><span>팀 이름</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 아침 6시 스터디" /></label>
          <label className="field"><span>소개 (선택)</span><input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="팀 소개" /></label>
          {err && <p className="err">{err}</p>}
          <button className="btn" disabled={!name.trim()} onClick={create}>만들기</button>
        </Sheet>
      )}
      {mode === 'join' && (
        <Sheet title="초대 코드로 참여" onClose={() => setMode(null)}>
          <label className="field"><span>초대 코드</span><input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="8자리 코드" style={{ textTransform: 'uppercase' }} /></label>
          {err && <p className="err">{err}</p>}
          <button className="btn" onClick={() => joinByCode(code)}>참여하기</button>
        </Sheet>
      )}
      {mode === 'scan' && (
        <Sheet title="QR 코드 스캔" onClose={() => setMode(null)}>
          <QrScanner onResult={joinByCode} />
          {err && <p className="err">{err}</p>}
          <button className="btn ghost" onClick={() => setMode('join')}>코드 직접 입력</button>
        </Sheet>
      )}
    </>
  );
}
