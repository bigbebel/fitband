import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, fmtDate, shiftDate, todayStr, type Entry, type Report as ReportT, type Team } from '../api';
import { EntryCard, FilePick, ReportView, Sheet, SummaryCard, TeamPicker, TopBar } from '../components';

type Tab = 'all' | 'study' | 'meal' | 'workout';

export default function Report() {
  const [params, setParams] = useSearchParams();
  const [date, setDate] = useState(todayStr());
  const [tab, setTab] = useState<Tab>('all');
  const [report, setReport] = useState<ReportT | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [adding, setAdding] = useState(false);
  const [sharing, setSharing] = useState(!!params.get('share'));

  const load = () => api.report(date).then(setReport).catch(() => {});
  useEffect(() => { load(); }, [date]);
  useEffect(() => { api.teams().then(setTeams).catch(() => {}); }, []);

  const del = async (id: string) => { if (confirm('삭제할까요?')) { await api.deleteEntry(id); load(); } };
  const shareDay = async (teamId: string) => { await api.shareReport(date, teamId); setSharing(false); params.delete('share'); setParams(params); load(); alert('팀에 공유했어요'); };

  const tabEntries = report?.entries.filter((e) => e.type === tab) || [];

  return (
    <>
      <TopBar title="보고서" right={<button className="btn ghost sm" onClick={() => setSharing(true)}>📤 팀 공유</button>} />
      <div className="page">
        <div className="date-nav">
          <button onClick={() => setDate(shiftDate(date, -1))}>‹</button>
          <b onClick={() => setDate(todayStr())}>{date === todayStr() ? '오늘 · ' : ''}{fmtDate(date)}</b>
          <button onClick={() => setDate(shiftDate(date, 1))} disabled={date >= todayStr()}>›</button>
        </div>

        <div className="subtabs">
          <button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>리포트</button>
          <button className={'study' + (tab === 'study' ? ' active' : '')} onClick={() => setTab('study')}>공부</button>
          <button className={'meal' + (tab === 'meal' ? ' active' : '')} onClick={() => setTab('meal')}>식단</button>
          <button className={'workout' + (tab === 'workout' ? ' active' : '')} onClick={() => setTab('workout')}>운동</button>
        </div>

        {report && tab === 'all' && <ReportView r={report} teams={teams} onDelete={del} />}
        {report && tab !== 'all' && (
          <>
            {tab === 'meal' && <SummaryCard s={report.summary} />}
            {tab === 'study' && <div className="card"><h3>📚 오늘 공부 {report.summary.studyMinutes}분</h3><div className="muted small">타임랩스 영상이나 사진을 올리고 메모를 남겨보세요.</div></div>}
            {tab === 'workout' && <div className="card"><h3>💪 오늘 운동 {report.summary.workoutCount}회 · {report.summary.workoutMinutes}분</h3><div className="muted small">오늘 한 운동을 메모로 남겨보세요.</div></div>}
            {tabEntries.length === 0 ? <div className="empty">기록이 없어요. ＋ 버튼으로 추가하세요.</div> : tabEntries.map((e) => <EntryCard key={e.id} e={e} teams={teams} onDelete={del} />)}
          </>
        )}
      </div>

      <button className="fab" onClick={() => setAdding(true)}>＋</button>

      {adding && <AddSheet date={date} initial={tab === 'all' ? 'study' : tab} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}

      {sharing && (
        <Sheet title={`${fmtDate(date)} 보고서를 팀에 올리기`} onClose={() => setSharing(false)}>
          <p className="muted small">이 날짜의 공부·식단·운동 기록 전체가 선택한 팀에 공유됩니다.</p>
          {teams.length === 0 && <div className="empty">참여한 팀이 없어요</div>}
          {teams.map((t) => <button key={t.id} className="btn outline" style={{ marginBottom: 8 }} onClick={() => shareDay(t.id)}>{t.name}</button>)}
        </Sheet>
      )}
    </>
  );
}

function AddSheet({ date, initial, onClose, onSaved }: { date: string; initial: Entry['type']; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<Entry['type']>(initial);
  const [file, setFile] = useState<File | null>(null);
  const [memo, setMemo] = useState('');
  const [subject, setSubject] = useState('');
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState('');
  const [mealType, setMealType] = useState('아침');
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setBusy(true); setErr('');
    try {
      if (type === 'workout') {
        await api.addWorkout({ date, title, memo, minutes: Number(minutes) || 0, teams: teamIds });
      } else {
        const fd = new FormData();
        fd.append('date', date); fd.append('memo', memo); fd.append('teams', JSON.stringify(teamIds));
        if (file) fd.append('file', file);
        if (type === 'study') { fd.append('subject', subject); fd.append('minutes', minutes); await api.addStudy(fd); }
        else { fd.append('mealType', mealType); await api.addMeal(fd); }
      }
      onSaved();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <Sheet title="기록 추가" onClose={onClose}>
      <div className="subtabs">
        <button className={'study' + (type === 'study' ? ' active' : '')} onClick={() => setType('study')}>📚 공부</button>
        <button className={'meal' + (type === 'meal' ? ' active' : '')} onClick={() => setType('meal')}>🍽 식단</button>
        <button className={'workout' + (type === 'workout' ? ' active' : '')} onClick={() => setType('workout')}>💪 운동</button>
      </div>

      {type === 'study' && (
        <>
          <FilePick accept="video/*,image/*" file={file} onChange={setFile} hint="📹 타임랩스 영상 / 사진 올리기 (선택)" />
          <div className="row" style={{ marginBottom: 12 }}>
            <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="과목 (예: 영어)" />
            <input className="input" type="number" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="분" style={{ width: 90 }} />
          </div>
          <textarea className="input" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="오늘 공부 메모" style={{ marginBottom: 12 }} />
        </>
      )}
      {type === 'meal' && (
        <>
          <FilePick accept="image/*" file={file} onChange={setFile} hint="📷 음식 사진 찍기 / 올리기 — AI가 칼로리·영양소를 분석해요" />
          <div className="subtabs" style={{ background: 'var(--bg)' }}>
            {['아침', '점심', '저녁', '간식'].map((m) => <button key={m} className={'meal' + (mealType === m ? ' active' : '')} onClick={() => setMealType(m)}>{m}</button>)}
          </div>
          <textarea className="input" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="메모 (선택)" style={{ marginBottom: 12, minHeight: 60 }} />
        </>
      )}
      {type === 'workout' && (
        <>
          <div className="row" style={{ marginBottom: 12 }}>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="운동 이름 (예: 러닝, 헬스)" />
            <input className="input" type="number" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="분" style={{ width: 90 }} />
          </div>
          <textarea className="input" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder={'운동 메모\n예) 스쿼트 60kg 5x5, 러닝 5km 28분'} style={{ marginBottom: 12 }} />
        </>
      )}

      <TeamPicker value={teamIds} onChange={setTeamIds} />
      {err && <p className="small" style={{ color: 'var(--danger)' }}>{err}</p>}
      <button className="btn" disabled={busy || (type === 'meal' && !file)} onClick={submit}>
        {busy ? <><span className="spinner" /> {type === 'meal' ? 'AI 분석 중…' : '저장 중…'}</> : '저장'}
      </button>
    </Sheet>
  );
}
