import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, colorOf, fmtDate, type Report, type Team as TeamT } from '../api';
import { ReportView, Sheet, TopBar } from '../components';

export default function Team() {
  const { id = '' } = useParams();
  const [team, setTeam] = useState<TeamT | null>(null);
  const [feed, setFeed] = useState<Report[]>([]);
  const [qr, setQr] = useState<{ url: string; dataUrl: string; inviteCode: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    api.team(id).then(setTeam).catch(() => nav('/'));
    api.feed(id).then(setFeed).catch(() => {});
  }, [id]);

  const showQr = async () => setQr(await api.teamQr(id));
  const share = async () => {
    if (!qr) return;
    if (navigator.share) await navigator.share({ title: `${team?.name} 초대`, text: `FitBand 팀 "${team?.name}"에 초대합니다. 코드: ${qr.inviteCode}`, url: qr.url }).catch(() => {});
    else { await navigator.clipboard.writeText(qr.url); alert('초대 링크를 복사했어요'); }
  };

  if (!team) return null;
  return (
    <>
      <TopBar title={team.name} back right={<button className="btn ghost sm" onClick={showQr}>QR 초대</button>} />
      <div className="page">
        <div className="card">
          <div className="row">
            <div className="avatar" style={{ background: colorOf(team.id) }}>{team.name[0]}</div>
            <div className="grow"><b>{team.name}</b><div className="muted small">{team.desc || '소개 없음'}</div></div>
          </div>
          <div style={{ marginTop: 10 }}>
            <span className="muted small">멤버 {team.members?.length}명 · </span>
            {team.members?.map((m) => <span className="tag" key={m.id}>{m.name}</span>)}
          </div>
        </div>

        <button className="btn" onClick={() => nav('/report?share=' + id)} style={{ marginBottom: 12 }}>📤 내 보고서 올리기</button>

        <h3 style={{ margin: '8px 4px' }}>팀 보고서</h3>
        {feed.length === 0 && <div className="empty">아직 올라온 보고서가 없어요.<br />보고서 탭에서 기록하고 이 팀에 공유해 보세요.</div>}
        {feed.map((r) => {
          const key = r.date + r.user.id;
          const isOpen = open === key;
          const s = r.summary;
          return (
            <div className="card" key={key}>
              <div className="row" onClick={() => setOpen(isOpen ? null : key)} style={{ cursor: 'pointer' }}>
                <div className="avatar" style={{ background: colorOf(r.user.id), width: 38, height: 38, fontSize: 15 }}>{r.user.name[0]}</div>
                <div className="grow">
                  <b>{r.user.name}</b> <span className="muted small">{fmtDate(r.date)}</span>
                  <div className="muted small">📚 {s.studyMinutes}분 · 🍽 {Math.round(s.nutrition.calories)}kcal ({s.mealCount}끼) · 💪 {s.workoutCount}회</div>
                </div>
                <span className="muted">{isOpen ? '▲' : '▼'}</span>
              </div>
              {isOpen && <div style={{ marginTop: 12 }}><ReportView r={r} /></div>}
            </div>
          );
        })}
      </div>

      {qr && (
        <Sheet title="QR 코드로 초대" onClose={() => setQr(null)}>
          <div className="center">
            <img src={qr.dataUrl} alt="QR" style={{ width: 240, height: 240, borderRadius: 12 }} />
            <p>초대 코드 <b style={{ fontSize: 20, letterSpacing: 2 }}>{qr.inviteCode}</b></p>
            <p className="muted small">친구가 홈에서 "QR 코드 스캔" 또는 코드 입력으로 참여할 수 있어요.</p>
          </div>
          <button className="btn" onClick={share}>링크 공유 / 복사</button>
        </Sheet>
      )}
    </>
  );
}
