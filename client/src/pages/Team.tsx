import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, colorOf, fmtDate, fmtTime, getUser, type Report, type Team as TeamT } from '../api';
import { ReportView, Sheet, TopBar, fmtVol } from '../components';

export default function Team() {
  const { id = '' } = useParams();
  const [team, setTeam] = useState<TeamT | null>(null);
  const [feed, setFeed] = useState<Report[]>([]);
  const [qr, setQr] = useState<{ url: string; dataUrl: string; inviteCode: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [text, setText] = useState<Record<string, string>>({});
  const nav = useNavigate();
  const me = getUser();

  const loadFeed = () => api.feed(id).then(setFeed).catch(() => {});
  useEffect(() => { api.team(id).then(setTeam).catch(() => nav('/')); loadFeed(); }, [id]);

  const showQr = async () => setQr(await api.teamQr(id));
  const share = async () => {
    if (!qr) return;
    if (navigator.share) await navigator.share({ title: `${team?.name} 초대`, text: `FitBand 팀 "${team?.name}"에 초대합니다. 코드: ${qr.inviteCode}`, url: qr.url }).catch(() => {});
    else { await navigator.clipboard.writeText(qr.url); alert('초대 링크를 복사했어요'); }
  };
  const like = async (r: Report) => {
    setFeed((f) => f.map((x) => x.key === r.key ? { ...x, liked: !x.liked, likes: x.liked ? x.likes!.filter((u) => u !== me!.id) : [...x.likes!, me!.id] } : x));
    await api.like(id, r.date, r.user.id).catch(loadFeed);
  };
  const comment = async (r: Report) => {
    const t = (text[r.key!] || '').trim(); if (!t) return;
    const c = await api.comment(id, r.date, r.user.id, t);
    setFeed((f) => f.map((x) => x.key === r.key ? { ...x, comments: [...(x.comments || []), c] } : x));
    setText((s) => ({ ...s, [r.key!]: '' }));
  };
  const delComment = async (r: Report, cid: string) => {
    await api.deleteComment(cid);
    setFeed((f) => f.map((x) => x.key === r.key ? { ...x, comments: x.comments!.filter((c) => c.id !== cid) } : x));
  };
  const leave = async () => { if (confirm('팀에서 나갈까요?')) { await api.leaveTeam(id); nav('/'); } };

  if (!team) return null;
  return (
    <>
      <TopBar title={team.name} back right={<button className="btn sm" onClick={showQr}>QR 초대</button>} />
      <div className="page">
        <div className="card">
          <div className="row">
            <div className="avatar" style={{ background: colorOf(team.id) }}>{team.name[0]}</div>
            <div className="grow"><b>{team.name}</b><div className="muted small">{team.desc || '소개 없음'}</div></div>
            <button className="icon-btn" onClick={leave} title="나가기">🚪</button>
          </div>
          <div style={{ marginTop: 10 }}>
            <span className="muted small">멤버 {team.members?.length}명 · </span>
            {team.members?.map((m) => <span className="tag gray" key={m.id}>{m.name}</span>)}
          </div>
        </div>

        <button className="btn" onClick={() => nav('/report?share=' + id)} style={{ marginBottom: 16 }}>📤 내 보고서 올리기</button>

        <h3 style={{ margin: '8px 4px' }}>팀 보고서</h3>
        {feed.length === 0 && <div className="empty">아직 올라온 보고서가 없어요.<br />보고서 탭에서 기록하고 이 팀에 공유해 보세요.</div>}
        {feed.map((r) => {
          const isOpen = open === r.key;
          const s = r.summary;
          return (
            <div className="card" key={r.key}>
              <div className="row" onClick={() => setOpen(isOpen ? null : r.key!)} style={{ cursor: 'pointer' }}>
                <div className="avatar" style={{ background: colorOf(r.user.id), width: 38, height: 38, fontSize: 15 }}>{r.user.name[0]}</div>
                <div className="grow">
                  <b>{r.user.name}</b> <span className="muted small">{fmtDate(r.date)}</span>
                  <div className="muted small">📚 {s.studyMinutes}분 · 🍽 {Math.round(s.nutrition.calories)}kcal · 💪 {s.workoutMinutes}분{s.workoutVolume ? ` ${fmtVol(s.workoutVolume)}` : ''}</div>
                </div>
                <span className="muted">{isOpen ? '▲' : '▼'}</span>
              </div>
              {isOpen && <div style={{ marginTop: 12 }}><ReportView r={r} /></div>}
              <div className="row" style={{ marginTop: 10 }}>
                <button className={'like-btn' + (r.liked ? ' on' : '')} onClick={() => like(r)}>{r.liked ? '❤️' : '🤍'} {r.likes?.length || 0}</button>
                <span className="muted small">💬 {r.comments?.length || 0}</span>
              </div>
              {(r.comments || []).map((c) => (
                <div className="comment" key={c.id}>
                  <b>{c.author.name}</b><span className="grow">{c.text}</span>
                  <span className="t">{fmtTime(c.createdAt)}{c.author.id === me?.id && <button onClick={() => delComment(r, c.id)} style={{ background: 'none', border: 0, color: 'var(--danger)', marginLeft: 6, cursor: 'pointer' }}>×</button>}</span>
                </div>
              ))}
              <div className="row" style={{ marginTop: 6 }}>
                <input className="input" style={{ padding: '9px 12px' }} placeholder="응원 댓글 남기기" value={text[r.key!] || ''} onChange={(e) => setText((s) => ({ ...s, [r.key!]: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && comment(r)} />
                <button className="btn sm" onClick={() => comment(r)}>등록</button>
              </div>
            </div>
          );
        })}
      </div>

      {qr && (
        <Sheet title="QR 코드로 초대" onClose={() => setQr(null)}>
          <div className="center">
            <img src={qr.dataUrl} alt="QR" style={{ width: 240, height: 240, borderRadius: 16, background: '#fff', padding: 8 }} />
            <p>초대 코드 <b className="accent" style={{ fontSize: 22, letterSpacing: 3 }}>{qr.inviteCode}</b></p>
            <p className="muted small">친구가 홈에서 "QR 코드 스캔" 또는 코드 입력으로 참여할 수 있어요.</p>
          </div>
          <button className="btn" onClick={share}>링크 공유 / 복사</button>
        </Sheet>
      )}
    </>
  );
}
