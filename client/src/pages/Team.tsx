import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, colorOf, fmtDate, fmtTime, getUser, shiftDate, todayStr, type Comment, type DayFeed, type Post, type Report, type Team as TeamT, type TeamCalendar, type TeamStats } from '../api';
import { FilePick, ReportView, Sheet, TeamAvatar, TopBar, fmtVol } from '../components';

const EMOJIS = ['💪', '🏃', '🧘', '🏋️', '🚴', '🏊', '⚽', '🏀', '🥊', '🧗', '📚', '✏️', '🎓', '💻', '🧠', '🍎', '🥗', '🍗', '🥛', '☕', '🔥', '⚡', '🌟', '🎯', '🏆', '🚀', '🌱', '🌅', '🌙', '🐻', '🐱', '🐶', '🦁', '🦄', '🐥', '🐸', '🐧', '🦊', '🐯', '🐼'];
const COLORS = ['#c6ff3d', '#5aa9ff', '#ffb547', '#ff5a6a', '#b388ff', '#4dd0e1', '#ff8a65', '#81c784', '#f06292', '#ffd54f'];
type Tab = 'feed' | 'calendar' | 'stats';
const wk = (s: string) => '일월화수목금토'[new Date(s + 'T00:00:00').getDay()];

export default function Team() {
  const { id = '' } = useParams();
  const [team, setTeam] = useState<TeamT | null>(null);
  const [tab, setTab] = useState<Tab>('feed');
  const [qr, setQr] = useState<{ url: string; dataUrl: string; inviteCode: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const nav = useNavigate();

  useEffect(() => { api.team(id).then(setTeam).catch(() => nav('/')); }, [id]);
  const showQr = async () => setQr(await api.teamQr(id));
  const share = async () => {
    if (!qr) return;
    if (navigator.share) await navigator.share({ title: `${team?.name} 초대`, text: `FitBand 팀 "${team?.name}"에 초대합니다. 코드: ${qr.inviteCode}`, url: qr.url }).catch(() => {});
    else { await navigator.clipboard.writeText(qr.url); alert('초대 링크를 복사했어요'); }
  };
  const leave = async () => { if (confirm('팀에서 나갈까요?')) { await api.leaveTeam(id); nav('/'); } };

  if (!team) return null;
  return (
    <>
      <TopBar title={team.name} back right={<button className="btn sm" onClick={showQr}>QR 초대</button>} />
      <div className="page">
        <div className="card" style={{ padding: 12 }}>
          <div className="row">
            <div onClick={() => setEditing(true)} style={{ cursor: 'pointer' }}><TeamAvatar team={team} size={48} /></div>
            <div className="grow"><b>{team.name}</b><div className="muted small">{team.desc || '소개 없음'} · 멤버 {team.members?.length}명</div></div>
            <button className="icon-btn" onClick={() => setEditing(true)}>✏️</button>
            <button className="icon-btn" onClick={leave}>🚪</button>
          </div>
        </div>
        <div className="subtabs">
          <button className={tab === 'feed' ? 'active' : ''} onClick={() => setTab('feed')}>📝 보고서</button>
          <button className={tab === 'calendar' ? 'active' : ''} onClick={() => setTab('calendar')}>📅 달력</button>
          <button className={tab === 'stats' ? 'active' : ''} onClick={() => setTab('stats')}>📈 통계</button>
        </div>
        {tab === 'feed' && <FeedTab team={team} />}
        {tab === 'calendar' && <CalendarTab team={team} />}
        {tab === 'stats' && <StatsTab team={team} />}
      </div>
      {editing && <EditTeamSheet team={team} onClose={() => setEditing(false)} onSaved={(t) => { setTeam({ ...team, ...t }); setEditing(false); }} />}
      {qr && (
        <Sheet title="QR 코드로 초대" onClose={() => setQr(null)}>
          <div className="center">
            <img src={qr.dataUrl} alt="QR" style={{ width: 240, height: 240, borderRadius: 16, background: '#fff', padding: 8 }} />
            <p>초대 코드 <b className="accent" style={{ fontSize: 22, letterSpacing: 3 }}>{qr.inviteCode}</b></p>
          </div>
          <button className="btn" onClick={share}>링크 공유 / 복사</button>
        </Sheet>
      )}
    </>
  );
}

// ---------- 공통: 좋아요 + 댓글 ----------
function Social({ teamId, target, likes, liked, comments, onChange }: { teamId: string; target: { date: string; userId: string } | { postId: string }; likes: string[]; liked: boolean; comments: Comment[]; onChange: (p: { likes: string[]; liked: boolean; comments: Comment[] }) => void }) {
  const me = getUser()!;
  const [text, setText] = useState('');
  const like = async () => {
    onChange({ liked: !liked, likes: liked ? likes.filter((u) => u !== me.id) : [...likes, me.id], comments });
    await api.like(teamId, target).catch(() => {});
  };
  const send = async () => { const t = text.trim(); if (!t) return; const c = await api.comment(teamId, target, t); onChange({ likes, liked, comments: [...comments, c] }); setText(''); };
  const del = async (cid: string) => { await api.deleteComment(cid); onChange({ likes, liked, comments: comments.filter((c) => c.id !== cid) }); };
  return (
    <>
      <div className="row" style={{ marginTop: 10 }}>
        <button className={'like-btn' + (liked ? ' on' : '')} onClick={like}>{liked ? '❤️' : '🤍'} {likes.length}</button>
        <span className="muted small">💬 {comments.length}</span>
      </div>
      {comments.map((c) => (
        <div className="comment" key={c.id}>
          <b>{c.author.name}</b><span className="grow">{c.text}</span>
          <span className="t">{fmtTime(c.createdAt)}{c.author.id === me.id && <button onClick={() => del(c.id)} style={{ background: 'none', border: 0, color: 'var(--danger)', marginLeft: 6, cursor: 'pointer' }}>×</button>}</span>
        </div>
      ))}
      <div className="row" style={{ marginTop: 6 }}>
        <input className="input" style={{ padding: '9px 12px' }} placeholder="댓글 남기기" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
        <button className="btn sm" onClick={send}>등록</button>
      </div>
    </>
  );
}

// ---------- 탭 1: 보고서 + 게시글 ----------
function FeedTab({ team }: { team: TeamT }) {
  const [date, setDate] = useState(todayStr());
  const [feed, setFeed] = useState<DayFeed | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const nav = useNavigate();
  const me = getUser()!;
  useEffect(() => { api.feed(team.id, date).then(setFeed).catch(() => {}); }, [team.id, date]);
  useEffect(() => { api.posts(team.id).then(setPosts).catch(() => {}); }, [team.id]);
  const patchReport = (r: Report, p: Partial<Report>) => setFeed((f) => f && { ...f, reports: f.reports.map((x) => (x.key === r.key ? { ...x, ...p } : x)) });
  const patchPost = (p: Post, u: Partial<Post>) => setPosts((ps) => ps.map((x) => (x.id === p.id ? { ...x, ...u } : x)));
  const delPost = async (p: Post) => { if (confirm('게시글을 삭제할까요?')) { await api.deletePost(p.id); setPosts((ps) => ps.filter((x) => x.id !== p.id)); } };

  return (
    <>
      <div className="date-nav">
        <button onClick={() => setDate(shiftDate(date, -1))}>‹</button>
        <b onClick={() => setDate(todayStr())}>{date === todayStr() ? '오늘 · ' : ''}{fmtDate(date)}</b>
        <button onClick={() => setDate(shiftDate(date, 1))} disabled={date >= todayStr()}>›</button>
      </div>

      {feed && (
        <div className="card" style={{ padding: 12 }}>
          <div className="row" style={{ marginBottom: 6 }}>
            <b className="grow">제출 현황</b>
            <span className="badge">{feed.submitted.length} / {feed.submitted.length + feed.missing.length}명</span>
          </div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {feed.submitted.map((u) => <span className="tag" key={u.id}>✓ {u.name}</span>)}
            {feed.missing.map((u) => <span className="tag gray" key={u.id} style={{ textDecoration: 'line-through', opacity: .8 }}>{u.name}</span>)}
          </div>
          {feed.missing.some((u) => u.id === me.id) && <button className="btn" style={{ marginTop: 10 }} onClick={() => nav('/report?share=' + team.id)}>📤 내 보고서 올리기</button>}
        </div>
      )}

      {feed?.reports.length === 0 && <div className="empty">이 날 올라온 보고서가 없어요</div>}
      {feed?.reports.map((r) => {
        const isOpen = open === r.key;
        const s = r.summary;
        return (
          <div className="card" key={r.key}>
            <div className="row" onClick={() => setOpen(isOpen ? null : r.key!)} style={{ cursor: 'pointer' }}>
              <div className="avatar" style={{ background: colorOf(r.user.id), width: 38, height: 38, fontSize: 15 }}>{r.user.name[0]}</div>
              <div className="grow">
                <b>{r.user.name}</b>
                <div className="muted small">💪 {s.workoutVolume ? fmtVol(s.workoutVolume) : `${s.workoutMinutes}분`} · 🍽 {Math.round(s.nutrition.calories)}kcal · 📚 {s.studyMinutes}분</div>
              </div>
              <span className="muted">{isOpen ? '▲' : '▼'}</span>
            </div>
            {isOpen && <div style={{ marginTop: 12 }}><ReportView r={r} /></div>}
            <Social teamId={team.id} target={{ date: r.date, userId: r.user.id }} likes={r.likes || []} liked={!!r.liked} comments={r.comments || []} onChange={(p) => patchReport(r, p)} />
          </div>
        );
      })}

      <div className="row" style={{ margin: '18px 4px 8px' }}>
        <h3 className="grow" style={{ margin: 0 }}>💬 팀 게시판</h3>
        <button className="btn sm" onClick={() => setWriting(true)}>＋ 글쓰기</button>
      </div>
      {posts.length === 0 && <div className="empty">첫 글을 남겨보세요! 오늘의 수다, 운동 셀카, 식단 자랑 뭐든 좋아요.</div>}
      {posts.map((p) => (
        <div className="card" key={p.id}>
          <div className="row">
            <div className="avatar" style={{ background: colorOf(p.author.id), width: 34, height: 34, fontSize: 14 }}>{p.author.name[0]}</div>
            <div className="grow"><b>{p.author.name}</b><div className="muted small">{fmtDate(p.date)} {fmtTime(p.createdAt)}</div></div>
            {p.author.id === me.id && <button className="icon-btn" onClick={() => delPost(p)}>🗑</button>}
          </div>
          {p.photo && <img src={p.photo} alt="" style={{ width: '100%', borderRadius: 12, marginTop: 10, maxHeight: 420, objectFit: 'cover' }} loading="lazy" />}
          {p.text && <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: '10px 0 0', fontSize: 15 }}>{p.text}</pre>}
          <Social teamId={team.id} target={{ postId: p.id }} likes={p.likes} liked={p.liked} comments={p.comments} onChange={(u) => patchPost(p, u)} />
        </div>
      ))}
      {writing && <PostSheet teamId={team.id} onClose={() => setWriting(false)} onPosted={(p) => { setPosts((ps) => [p, ...ps]); setWriting(false); }} />}
    </>
  );
}

function PostSheet({ teamId, onClose, onPosted }: { teamId: string; onClose: () => void; onPosted: (p: Post) => void }) {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async () => {
    setBusy(true); setErr('');
    try { const fd = new FormData(); fd.append('text', text); if (file) fd.append('file', file); onPosted(await api.createPost(teamId, fd)); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Sheet title="팀 게시글 쓰기" onClose={onClose} tall>
      <FilePick accept="image/*" file={file} onChange={setFile} icon="📸" color="var(--primary)" hint="사진 올리기 (선택)" />
      <textarea className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="오늘 어땠어요? 팀원들과 수다 떨어요 :)" style={{ marginBottom: 12, minHeight: 110 }} />
      {err && <p className="err">{err}</p>}
      <button className="btn" disabled={busy || (!text.trim() && !file)} onClick={submit}>{busy ? '올리는 중…' : '게시'}</button>
    </Sheet>
  );
}

// ---------- 탭 2: 달력 (일간/주간/월간) ----------
function CalendarTab({ team }: { team: TeamT }) {
  const [view, setView] = useState<'day' | 'week' | 'month'>('month');
  const [cursor, setCursor] = useState(todayStr());
  const [cal, setCal] = useState<TeamCalendar | null>(null);
  const today = todayStr();
  const ym = cursor.slice(0, 7);
  const monthStart = ym + '-01';
  const d0 = new Date(monthStart + 'T00:00:00');
  const daysInMonth = new Date(d0.getFullYear(), d0.getMonth() + 1, 0).getDate();
  const monthEnd = `${ym}-${String(daysInMonth).padStart(2, '0')}`;
  const weekStart = shiftDate(cursor, -new Date(cursor + 'T00:00:00').getDay());
  const weekDates = Array.from({ length: 7 }, (_, i) => shiftDate(weekStart, i));

  useEffect(() => {
    const from = view === 'month' ? monthStart : view === 'week' ? weekStart : cursor;
    const to = view === 'month' ? monthEnd : view === 'week' ? weekDates[6] : cursor;
    api.teamCalendar(team.id, from, to).then(setCal).catch(() => {});
  }, [team.id, view, cursor]);

  const members = cal?.members || [];
  const info = (d: string) => cal?.days[d];
  const count = (d: string) => info(d)?.submitted.length || 0;
  const move = (n: number) => {
    if (view === 'month') { const x = new Date(d0); x.setMonth(x.getMonth() + n); setCursor(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-01`); }
    else setCursor(shiftDate(cursor, view === 'week' ? 7 * n : n));
  };
  const title = view === 'month' ? `${d0.getFullYear()}년 ${d0.getMonth() + 1}월` : view === 'week' ? `${weekDates[0].slice(5).replace('-', '/')} ~ ${weekDates[6].slice(5).replace('-', '/')}` : fmtDate(cursor);
  const rate = (n: number) => members.length ? n / members.length : 0;
  const cellBg = (d: string) => { const r = rate(count(d)); return r === 0 ? 'var(--bg2)' : r < 0.5 ? 'rgba(198,255,61,.25)' : r < 1 ? 'rgba(198,255,61,.55)' : 'var(--primary)'; };

  return (
    <>
      <div className="subtabs">
        {(['day', 'week', 'month'] as const).map((v) => <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>{{ day: '일간', week: '주간', month: '월간' }[v]}</button>)}
      </div>
      <div className="date-nav">
        <button onClick={() => move(-1)}>‹</button>
        <b onClick={() => setCursor(today)}>{title}</b>
        <button onClick={() => move(1)} disabled={cursor >= today && view !== 'month' ? true : view === 'month' && ym >= today.slice(0, 7)}>›</button>
      </div>

      {view === 'month' && (
        <div className="card">
          <div className="cal-grid">
            {'일월화수목금토'.split('').map((w, i) => <div key={w} className="cal-w" style={{ color: i === 0 ? 'var(--danger)' : i === 6 ? 'var(--study)' : undefined }}>{w}</div>)}
            {Array.from({ length: d0.getDay() }).map((_, i) => <div key={'e' + i} />)}
            {Array.from({ length: daysInMonth }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`).map((d) => (
              <div key={d} className={'cal-cell' + (d === today ? ' today' : '') + (d > today ? ' future' : '')} style={{ background: d <= today ? cellBg(d) : undefined, color: rate(count(d)) >= 0.5 ? '#0b0d11' : undefined }} onClick={() => { setCursor(d); setView('day'); }}>
                <span>{+d.slice(8)}</span>
                {d <= today && <small>{count(d)}/{members.length}</small>}
              </div>
            ))}
          </div>
          <div className="muted small" style={{ marginTop: 10 }}>색이 진할수록 제출 인원이 많아요 · 날짜를 누르면 일간 보기</div>
        </div>
      )}

      {view === 'week' && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="wk-table">
            <thead><tr><th /> {weekDates.map((d) => <th key={d} className={d === today ? 'today' : ''}>{wk(d)}<br /><small>{+d.slice(8)}</small></th>)}</tr></thead>
            <tbody>
              {members.map((u) => (
                <tr key={u.id}><td className="nm">{u.name}</td>{weekDates.map((d) => <td key={d}>{d > today ? '' : info(d)?.submitted.includes(u.id) ? <span className="ok">✓</span> : <span className="no">·</span>}</td>)}</tr>
              ))}
              <tr className="sum"><td className="nm">합계</td>{weekDates.map((d) => <td key={d}>{d > today ? '' : `${count(d)}/${members.length}`}</td>)}</tr>
            </tbody>
          </table>
        </div>
      )}

      {view === 'day' && (
        <div className="card">
          <div className="row" style={{ marginBottom: 10 }}><b className="grow">제출 현황</b><span className="badge">{count(cursor)} / {members.length}명</span></div>
          {members.map((u) => {
            const ok = info(cursor)?.submitted.includes(u.id);
            return <div key={u.id} className="row" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}><div className="avatar" style={{ background: colorOf(u.id), width: 32, height: 32, fontSize: 13 }}>{u.name[0]}</div><span className="grow">{u.name}</span>{ok ? <span className="tag">✓ 제출</span> : <span className="tag gray">미제출</span>}</div>;
          })}
          {info(cursor) && <div className="muted small" style={{ marginTop: 10 }}>💪 운동 {info(cursor)!.workout} · 🍽 식단 {info(cursor)!.meal} · 📚 공부 {info(cursor)!.study} 건</div>}
        </div>
      )}
    </>
  );
}

// ---------- 탭 3: 통계 (주간/월간, 팀원별) ----------
function StatsTab({ team }: { team: TeamT }) {
  const [range, setRange] = useState<7 | 30>(7);
  const [metric, setMetric] = useState<'submit' | 'vol' | 'wmin' | 'cal' | 'study'>('submit');
  const [st, setSt] = useState<TeamStats | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => { api.teamStats(team.id, range).then(setSt).catch(() => {}); }, [team.id, range]);
  if (!st) return <div className="empty">불러오는 중…</div>;
  const M = {
    submit: { label: '제출 일수', color: 'var(--primary)', get: (m: TeamStats['members'][0]) => m.total.submittedDays, fmt: (v: number) => `${v}일` },
    vol: { label: '운동 볼륨', color: 'var(--workout)', get: (m: TeamStats['members'][0]) => m.total.workoutVolume, fmt: fmtVol },
    wmin: { label: '운동 시간', color: 'var(--workout)', get: (m: TeamStats['members'][0]) => m.total.workoutMinutes, fmt: (v: number) => `${v}분` },
    cal: { label: '평균 칼로리', color: 'var(--meal)', get: (m: TeamStats['members'][0]) => m.total.avgCalories, fmt: (v: number) => `${v}kcal` },
    study: { label: '공부 시간', color: 'var(--study)', get: (m: TeamStats['members'][0]) => m.total.studyMinutes, fmt: (v: number) => `${v}분` },
  }[metric];
  const ranked = [...st.members].sort((a, b) => M.get(b) - M.get(a));
  const max = Math.max(1, ...ranked.map(M.get));
  const perDayVal = (d: TeamStats['members'][0]['perDay'][0]) => metric === 'submit' ? (d.submitted ? 1 : 0) : metric === 'vol' ? d.workoutVolume : metric === 'wmin' ? d.workoutMinutes : metric === 'cal' ? d.nutrition.calories : d.studyMinutes;
  const selM = st.members.find((m) => m.user.id === sel) || ranked[0];
  const dmax = selM ? Math.max(1, ...selM.perDay.map((d) => perDayVal(d))) : 1;

  return (
    <>
      <div className="row" style={{ marginBottom: 10 }}>
        <div className="subtabs grow" style={{ margin: 0 }}>
          <button className={range === 7 ? 'active' : ''} onClick={() => setRange(7)}>주간</button>
          <button className={range === 30 ? 'active' : ''} onClick={() => setRange(30)}>월간</button>
        </div>
      </div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {(Object.keys({ submit: 1, vol: 1, wmin: 1, cal: 1, study: 1 }) as (typeof metric)[]).map((k) => <button key={k} className={'like-btn' + (metric === k ? ' on' : '')} onClick={() => setMetric(k)}>{{ submit: '제출 일수', vol: '운동 볼륨', wmin: '운동 시간', cal: '평균 칼로리', study: '공부 시간' }[k]}</button>)}
      </div>

      <div className="card">
        <h3>🏆 팀원 순위 · 최근 {range}일 {M.label}</h3>
        {ranked.map((m, i) => (
          <div key={m.user.id} className="rank-row" onClick={() => setSel(m.user.id)} style={{ cursor: 'pointer', opacity: selM?.user.id === m.user.id ? 1 : .8 }}>
            <span className="rk">{['🥇', '🥈', '🥉'][i] || `${i + 1}`}</span>
            <span className="nm">{m.user.name}</span>
            <div className="grow"><div className="bar" style={{ marginTop: 0, height: 12 }}><i style={{ width: `${(M.get(m) / max) * 100}%`, background: M.color }} /></div></div>
            <b style={{ minWidth: 60, textAlign: 'right' }}>{M.fmt(M.get(m))}</b>
          </div>
        ))}
        {ranked.length === 0 && <div className="empty">팀원이 없어요</div>}
      </div>

      {selM && (
        <div className="card">
          <h3>{selM.user.name} · 일별 {M.label}</h3>
          <div className="chart">
            {selM.perDay.map((d, i) => {
              const v = perDayVal(d);
              return (
                <div className={'col' + (d.date === todayStr() ? ' today' : '')} key={d.date} title={`${d.date}: ${v}`}>
                  <i style={{ height: `${(v / dmax) * 100}%`, background: v ? M.color : undefined }} />
                  <span>{range === 7 ? wk(d.date) : i % 5 === 0 ? d.date.slice(8) : ''}</span>
                </div>
              );
            })}
          </div>
          <div className="stat-grid" style={{ marginTop: 12 }}>
            <div className="stat"><b>{selM.total.submittedDays}<small style={{ fontSize: 11 }}>/{range}일</small></b><span>제출</span></div>
            <div className="stat workout"><b>{fmtVol(selM.total.workoutVolume)}</b><span>볼륨 · {selM.total.workoutCount}회</span></div>
            <div className="stat meal"><b>{selM.total.avgCalories}</b><span>일평균 kcal</span></div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------- 팀 프로필 편집 ----------
function EditTeamSheet({ team, onClose, onSaved }: { team: TeamT; onClose: () => void; onSaved: (t: TeamT) => void }) {
  const [name, setName] = useState(team.name);
  const [desc, setDesc] = useState(team.desc || '');
  const [emoji, setEmoji] = useState(team.emoji || '');
  const [color, setColor] = useState(team.color || '');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(team.photo || null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pickPhoto = (f: File | null) => { setPhoto(f); setEmoji(''); if (f) setPreview(URL.createObjectURL(f)); };
  const save = async () => {
    setBusy(true); setErr('');
    try {
      let t = await api.updateTeam(team.id, { name, desc, emoji, color });
      if (photo) { const fd = new FormData(); fd.append('file', photo); t = await api.teamPhoto(team.id, fd); }
      onSaved(t);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const previewTeam = { id: team.id, name: name || team.name, emoji, color, photo: emoji ? null : preview };
  return (
    <Sheet title="팀 프로필 꾸미기" onClose={onClose} tall>
      <div className="center" style={{ marginBottom: 14 }}>
        <div style={{ display: 'inline-block' }}><TeamAvatar team={previewTeam} size={96} /></div>
        <div className="row" style={{ justifyContent: 'center', marginTop: 10, gap: 8 }}>
          <label className="btn sm ghost"><input type="file" accept="image/*" hidden onChange={(e) => pickPhoto(e.target.files?.[0] || null)} />🖼 사진 올리기</label>
          {(preview || emoji) && <button className="btn sm ghost" onClick={() => { setPhoto(null); setPreview(null); setEmoji(''); }}>초기화</button>}
        </div>
      </div>
      <div className="muted small" style={{ marginBottom: 6 }}>이모티콘</div>
      <div className="emoji-grid">{EMOJIS.map((e) => <button key={e} className={emoji === e ? 'on' : ''} onClick={() => { setEmoji(e); setPhoto(null); setPreview(null); }}>{e}</button>)}</div>
      <div className="muted small" style={{ marginBottom: 6 }}>배경색</div>
      <div className="color-row">{COLORS.map((c) => <button key={c} className={color === c ? 'on' : ''} style={{ background: c }} onClick={() => setColor(c)} />)}</div>
      <label className="field"><span>팀 이름</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="field"><span>소개</span><input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="팀 소개" /></label>
      {err && <p className="err">{err}</p>}
      <button className="btn" disabled={busy || !name.trim()} onClick={save}>{busy ? '저장 중…' : '저장'}</button>
    </Sheet>
  );
}
