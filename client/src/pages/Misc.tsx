import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, getSession, getUser, setSession, type Team, type User } from '../api';
import { Sheet, TopBar } from '../components';

export function Login({ onLogin }: { onLogin: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true); setErr('');
    try { setSession(mode === 'login' ? await api.login(email.trim(), pw) : await api.signup(email.trim(), pw, name.trim())); onLogin(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100dvh' }}>
      <div className="center" style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 52 }}>💪</div>
        <h1 style={{ margin: '8px 0 4px', fontSize: 30, fontWeight: 900, letterSpacing: -1 }}>Fit<span className="accent">Band</span></h1>
        <p className="muted">팀과 함께하는 운동 · 식단 · 공부 기록</p>
      </div>
      <div className="card">
        <div className="subtabs">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>로그인</button>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>회원가입</button>
        </div>
        {mode === 'signup' && <label className="field"><span>닉네임</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="팀원에게 보이는 이름" /></label>}
        <label className="field"><span>이메일</span><input className="input" type="email" inputMode="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>
        <label className="field"><span>비밀번호</span><input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} placeholder="6자 이상" /></label>
        {err && <p className="err">{err}</p>}
        <button className="btn" disabled={busy || !email || pw.length < 6 || (mode === 'signup' && !name.trim())} onClick={go}>{busy ? '…' : mode === 'login' ? '로그인' : '가입하고 시작하기'}</button>
      </div>
      <p className="muted small center">이메일 계정으로 어느 기기에서나 같은 기록을 볼 수 있어요.</p>
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
  const [u, setU] = useState<User | null>(getUser());
  const [cal, setCal] = useState<Record<string, { study: number; meal: number; workout: number }>>({});
  const [goal, setGoal] = useState(String(u?.calorieGoal || 2000));
  const [name, setName] = useState(u?.name || '');
  const [health, setHealth] = useState<null | 'apple' | 'samsung'>(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { api.me().then((m) => { setU(m); setGoal(String(m.calorieGoal || 2000)); setName(m.name); const s = getSession(); if (s) setSession({ ...s, user: m }); }); api.calendar().then(setCal).catch(() => {}); }, []);

  const saveProfile = async () => { const m = await api.updateMe({ name, calorieGoal: Number(goal) }); setU(m); const s = getSession(); if (s) setSession({ ...s, user: m }); setMsg('저장했어요'); setTimeout(() => setMsg(''), 1500); };
  const days = Object.keys(cal).sort().reverse();
  const total = days.reduce((a, d) => ({ study: a.study + cal[d].study, meal: a.meal + cal[d].meal, workout: a.workout + cal[d].workout }), { study: 0, meal: 0, workout: 0 });

  return (
    <>
      <TopBar title="내 정보" />
      <div className="page">
        <div className="card row">
          <div className="avatar" style={{ background: 'var(--primary)' }}>{u?.name?.[0]}</div>
          <div className="grow"><b>{u?.name}</b><div className="muted small">{u?.email} · 기록한 날 {days.length}일</div></div>
          <button className="btn sm ghost" onClick={() => { setSession(null); onLogout(); }}>로그아웃</button>
        </div>

        <div className="card">
          <h3>🎯 목표 설정</h3>
          <label className="field"><span>닉네임</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="field"><span>하루 칼로리 목표 (kcal)</span><input className="input" type="number" inputMode="numeric" value={goal} onChange={(e) => setGoal(e.target.value)} /></label>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {[1500, 1800, 2000, 2200, 2500, 3000].map((g) => <button key={g} className={'like-btn' + (goal === String(g) ? ' on' : '')} onClick={() => setGoal(String(g))}>{g}</button>)}
          </div>
          <button className="btn" onClick={saveProfile}>{msg || '저장'}</button>
        </div>

        <div className="card">
          <h3>⌚ 건강 앱 연동</h3>
          <p className="muted small" style={{ marginTop: 0 }}>웹앱은 건강 앱을 직접 읽을 수 없어서, 아이폰은 단축어로 보내고 갤럭시는 삼성 헬스 내보내기 파일을 올리는 방식이에요.</p>
          <div className="row">
            <button className="btn ghost" onClick={() => setHealth('apple')}>🍎 아이폰 건강</button>
            <button className="btn ghost" onClick={() => setHealth('samsung')}>💠 삼성 헬스</button>
          </div>
        </div>

        <div className="card">
          <h3>누적 기록</h3>
          <div className="stat-grid">
            <div className="stat workout"><b>{total.workout}</b><span>운동</span></div>
            <div className="stat meal"><b>{total.meal}</b><span>식단</span></div>
            <div className="stat study"><b>{total.study}</b><span>공부</span></div>
          </div>
        </div>
      </div>
      {health === 'apple' && <AppleSheet onClose={() => setHealth(null)} user={u} onUser={setU} />}
      {health === 'samsung' && <SamsungSheet onClose={() => setHealth(null)} />}
    </>
  );
}

function AppleSheet({ onClose, user, onUser }: { onClose: () => void; user: User | null; onUser: (u: User) => void }) {
  const [busy, setBusy] = useState(false);
  const token = user?.healthToken;
  const url = token ? `${location.origin}/api/health/import/${token}` : '';
  const issue = async () => { setBusy(true); const r = await api.healthToken(); onUser({ ...user!, healthToken: r.healthToken }); setBusy(false); };
  const copy = (t: string) => navigator.clipboard.writeText(t).then(() => alert('복사했어요'));
  return (
    <Sheet title="🍎 아이폰 건강 연동 (단축어)" onClose={onClose}>
      {!token ? <button className="btn" disabled={busy} onClick={issue}>1단계: 내 전송 주소 만들기</button> : (
        <>
          <div className="muted small">내 전송 주소 (단축어에 붙여넣기)</div>
          <div className="row" style={{ margin: '6px 0 12px' }}><code className="pill grow">{url}</code><button className="btn sm" onClick={() => copy(url)}>복사</button></div>
          <button className="btn sm ghost" style={{ marginBottom: 12 }} onClick={issue}>주소 재발급</button>
        </>
      )}
      <p className="muted small" style={{ marginTop: 0 }}>아이폰 정책상 웹앱은 건강 앱을 직접 읽을 수 없어요. 대신 기본 앱 <b>단축어</b>에 동작 3개만 넣으면, 한 번 탭으로 오늘 운동이 전부 들어와요. (처음 실행 때 건강 접근 허용 창이 나오면 허용)</p>
      <ol className="steps">
        <li><b>단축어</b> 앱 → 오른쪽 위 <b>＋</b></li>
        <li>동작 검색 <b>"건강 샘플 찾기"</b> 추가 → 유형을 <b>운동</b>으로, 필터 추가: <b>시작 날짜 · 오늘</b></li>
        <li>동작 검색 <b>"각 항목 반복"</b> 추가 (자동으로 위 결과를 반복)</li>
        <li>반복 안에 <b>"URL 콘텐츠 가져오기"</b> 추가 → URL에 위 전송 주소 붙여넣기 → <b>방식 POST</b> → 요청 본문 <b>JSON</b> → 필드 4개 추가 (값은 "반복 항목" 변수를 넣고 각각 운동 유형 / 시작 날짜 / 종료 날짜 / 활동 에너지 선택):
          <div style={{ marginTop: 4 }}><code className="pill">유형</code> <code className="pill">시작</code> <code className="pill">종료</code> <code className="pill">칼로리</code></div></li>
        <li>오른쪽 위 <b>완료</b> → 실행 ▶︎ → 건강 접근 <b>허용</b>. 보고서 탭에 운동이 들어오면 성공!</li>
      </ol>
      <p className="muted small">날짜 형식은 서버가 알아서 처리해요. 단축어 앱의 <b>자동화</b> 탭에서 "매일 오후 10:00 → 이 단축어 실행"을 만들면 손 대지 않아도 매일 들어와요. 이미 가져온 운동은 중복되지 않습니다.</p>
    </Sheet>
  );
}

function SamsungSheet({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState('');
  const up = async (f: File | null) => {
    if (!f) return; setBusy(true); setRes('');
    try { const fd = new FormData(); fd.append('file', f); const r = await api.samsungCsv(fd); setRes(`${r.parsed}개 중 ${r.added}개 운동을 새로 가져왔어요`); }
    catch (e: any) { setRes(e.message); } finally { setBusy(false); }
  };
  return (
    <Sheet title="💠 삼성 헬스 연동 (내보내기)" onClose={onClose}>
      <ol className="steps">
        <li><b>삼성 헬스</b> 앱 → 우상단 ⋮ 또는 프로필 → <b>설정</b></li>
        <li><b>개인 데이터 다운로드</b> (Download personal data) → 받기</li>
        <li>내 파일 → Samsung Health 폴더 → zip 압축 해제 → <code className="pill">com.samsung.shealth.exercise.*.csv</code> 파일 선택</li>
      </ol>
      <label className="file-pick">
        <input type="file" accept=".csv,text/csv" onChange={(e) => up(e.target.files?.[0] || null)} />
        {busy ? '가져오는 중…' : '📄 exercise CSV 파일 선택'}
      </label>
      {res && <p className="accent small center">{res}</p>}
      <p className="muted small">이미 가져온 운동은 중복으로 들어가지 않아요. 주기적으로 내보내기 → 업로드하면 됩니다.</p>
    </Sheet>
  );
}
