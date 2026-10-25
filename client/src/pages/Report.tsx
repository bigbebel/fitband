import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, fmtDate, shiftDate, todayStr, type Entry, type Exercise, type Report as ReportT, type Team } from '../api';
import { EntryCard, FilePick, ReportView, Sheet, SummaryCard, TeamPicker, TopBar, fmtVol } from '../components';

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
  const s = report?.summary;

  return (
    <>
      <TopBar title="보고서" right={<button className="btn sm ghost" onClick={() => setSharing(true)}>📤 팀 공유</button>} />
      <div className="page">
        <div className="date-nav">
          <button onClick={() => setDate(shiftDate(date, -1))}>‹</button>
          <b onClick={() => setDate(todayStr())}>{date === todayStr() ? '오늘 · ' : ''}{fmtDate(date)}</b>
          <button onClick={() => setDate(shiftDate(date, 1))} disabled={date >= todayStr()}>›</button>
        </div>

        <div className="subtabs">
          <button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>리포트</button>
          <button className={'workout' + (tab === 'workout' ? ' active' : '')} onClick={() => setTab('workout')}>운동</button>
          <button className={'meal' + (tab === 'meal' ? ' active' : '')} onClick={() => setTab('meal')}>식단</button>
          <button className={'study' + (tab === 'study' ? ' active' : '')} onClick={() => setTab('study')}>공부</button>
        </div>

        {report && tab === 'all' && <ReportView r={report} teams={teams} onDelete={del} />}
        {report && s && tab !== 'all' && (
          <>
            {tab === 'meal' && <SummaryCard s={s} goal={report.user.calorieGoal || 2000} />}
            {tab === 'study' && <div className="card hero"><div className="big" style={{ color: 'var(--study)' }}>{s.studyMinutes}<small style={{ fontSize: 14 }}>분</small></div><div className="muted" style={{ marginTop: 6 }}>오늘 공부 {s.studyCount}회 · 타임랩스/사진과 메모를 남겨보세요</div></div>}
            {tab === 'workout' && (
              <div className="card hero">
                <div className="row">
                  <div className="grow"><div className="big" style={{ color: 'var(--workout)' }}>{s.workoutVolume ? fmtVol(s.workoutVolume) : `${s.workoutMinutes}분`}</div><div className="muted" style={{ marginTop: 6 }}>{s.workoutVolume ? '총 볼륨' : '운동 시간'} · {s.workoutCount}회{s.workoutCalories ? ` · ${s.workoutCalories} kcal` : ''}</div></div>
                  <div className="stat workout" style={{ minWidth: 80 }}><b>{s.workoutMinutes}</b><span>분</span></div>
                </div>
              </div>
            )}
            {tabEntries.length === 0 ? <div className="empty">기록이 없어요. ＋ 버튼으로 추가하세요.</div> : tabEntries.map((e) => <EntryCard key={e.id} e={e} teams={teams} onDelete={del} />)}
          </>
        )}
      </div>

      <button className="fab" onClick={() => setAdding(true)}>＋</button>
      {adding && <AddSheet date={date} initial={tab === 'all' ? 'workout' : tab} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
      {sharing && (
        <Sheet title={`${fmtDate(date)} 보고서를 팀에 올리기`} onClose={() => setSharing(false)}>
          <p className="muted small">이 날짜의 운동·식단·공부 기록 전체가 선택한 팀에 공유됩니다.</p>
          {teams.length === 0 && <div className="empty">참여한 팀이 없어요</div>}
          {teams.map((t) => <button key={t.id} className="btn outline" style={{ marginBottom: 8 }} onClick={() => shareDay(t.id)}>{t.name}</button>)}
        </Sheet>
      )}
    </>
  );
}

const QUICK = ['스쿼트', '벤치프레스', '데드리프트', '오버헤드프레스', '바벨로우', '풀업', '런지', '레그프레스', '러닝', '사이클'];

function AddSheet({ date, initial, onClose, onSaved }: { date: string; initial: Entry['type']; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<Entry['type']>(initial);
  const [file, setFile] = useState<File | null>(null);
  const [memo, setMemo] = useState('');
  const [subject, setSubject] = useState('');
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState('');
  const [calories, setCalories] = useState('');
  const [mealType, setMealType] = useState('아침');
  const [exercises, setExercises] = useState<Exercise[]>([{ name: '', sets: [{ weight: 0, reps: 0 }] }]);
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const volume = exercises.reduce((a, x) => a + x.sets.reduce((b, s) => b + s.weight * s.reps, 0), 0);
  const upd = (i: number, f: (x: Exercise) => Exercise) => setExercises((xs) => xs.map((x, j) => (j === i ? f(x) : x)));

  const submit = async () => {
    setBusy(true); setErr('');
    try {
      if (type === 'workout') {
        const ex = exercises.filter((x) => x.name.trim());
        if (!ex.length && !title.trim() && !memo.trim()) throw new Error('운동 종목이나 메모를 입력하세요');
        await api.addWorkout({ date, title, memo, minutes: Number(minutes) || 0, calories: Number(calories) || 0, exercises: ex, teams: teamIds });
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
    <Sheet title="기록 추가" onClose={onClose} tall>
      <div className="subtabs">
        <button className={'workout' + (type === 'workout' ? ' active' : '')} onClick={() => setType('workout')}>💪 운동</button>
        <button className={'meal' + (type === 'meal' ? ' active' : '')} onClick={() => setType('meal')}>🍽 식단</button>
        <button className={'study' + (type === 'study' ? ' active' : '')} onClick={() => setType('study')}>📚 공부</button>
      </div>

      {type === 'workout' && (
        <>
          <div className="row" style={{ marginBottom: 10 }}>
            <div className="grow"><div className="muted small">총 볼륨</div><b className="accent" style={{ fontSize: 22 }}>{fmtVol(volume)}</b></div>
            <input className="input" type="number" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="시간(분)" style={{ width: 92 }} />
            <input className="input" type="number" inputMode="numeric" value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="kcal" style={{ width: 80 }} />
          </div>
          {exercises.map((x, i) => (
            <div className="ex" key={i}>
              <div className="ex-head">
                <input value={x.name} onChange={(e) => upd(i, (y) => ({ ...y, name: e.target.value }))} placeholder="운동 이름 (예: 스쿼트)" list="quick-ex" />
                <button className="set-row x" onClick={() => setExercises((xs) => xs.filter((_, j) => j !== i))}>✕</button>
              </div>
              <div className="set-row head"><span className="n">세트</span><span className="n">무게(kg)</span><span className="n">횟수</span><span /></div>
              {x.sets.map((st, k) => (
                <div className="set-row" key={k}>
                  <span className="n">{k + 1}</span>
                  <input type="number" inputMode="decimal" value={st.weight || ''} placeholder="0" onChange={(e) => upd(i, (y) => ({ ...y, sets: y.sets.map((z, m) => (m === k ? { ...z, weight: Number(e.target.value) } : z)) }))} />
                  <input type="number" inputMode="numeric" value={st.reps || ''} placeholder="0" onChange={(e) => upd(i, (y) => ({ ...y, sets: y.sets.map((z, m) => (m === k ? { ...z, reps: Number(e.target.value) } : z)) }))} />
                  <button className="x" onClick={() => upd(i, (y) => ({ ...y, sets: y.sets.filter((_, m) => m !== k) }))}>−</button>
                </div>
              ))}
              <button className="btn sm ghost" style={{ width: '100%' }} onClick={() => upd(i, (y) => ({ ...y, sets: [...y.sets, { ...(y.sets[y.sets.length - 1] || { weight: 0, reps: 0 }) }] }))}>＋ 세트 추가</button>
            </div>
          ))}
          <datalist id="quick-ex">{QUICK.map((q) => <option key={q} value={q} />)}</datalist>
          <button className="btn outline" style={{ marginBottom: 12 }} onClick={() => setExercises((xs) => [...xs, { name: '', sets: [{ weight: 0, reps: 0 }] }])}>＋ 운동 추가</button>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="루틴 이름 (선택, 예: 하체 데이)" style={{ marginBottom: 10 }} />
          <textarea className="input" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="메모 (컨디션, 느낀 점…)" style={{ marginBottom: 12, minHeight: 60 }} />
        </>
      )}
      {type === 'meal' && (
        <>
          <FilePick accept="image/*" file={file} onChange={setFile} icon="🍽" color="var(--meal)" hint="음식 사진을 올리면 AI가 칼로리·영양소를 분석해요" />
          <div className="subtabs">
            {['아침', '점심', '저녁', '간식'].map((m) => <button key={m} className={'meal' + (mealType === m ? ' active' : '')} onClick={() => setMealType(m)}>{m}</button>)}
          </div>
          <textarea className="input" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="메모 (선택)" style={{ marginBottom: 12, minHeight: 60 }} />
        </>
      )}
      {type === 'study' && (
        <>
          <FilePick accept="video/*,image/*" video file={file} onChange={setFile} icon="📹" color="var(--study)" hint="타임랩스 영상이나 공부 사진 (선택, 50MB 이하)" />
          <div className="row" style={{ marginBottom: 12 }}>
            <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="과목 (예: 영어)" />
            <input className="input" type="number" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="분" style={{ width: 90 }} />
          </div>
          <textarea className="input" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="오늘 공부 메모" style={{ marginBottom: 12 }} />
        </>
      )}

      <TeamPicker value={teamIds} onChange={setTeamIds} />
      {err && <p className="err">{err}</p>}
      <button className="btn" disabled={busy || (type === 'meal' && !file)} onClick={submit}>
        {busy ? <><span className="spinner" /> {type === 'meal' ? 'AI 분석 중…' : '저장 중…'}</> : '저장'}
      </button>
    </Sheet>
  );
}
