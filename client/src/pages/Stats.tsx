import { useEffect, useState } from 'react';
import { api, todayStr, type DayStat } from '../api';
import { TopBar, fmtVol } from '../components';

type Metric = { key: string; label: string; color: string; unit: string; get: (d: DayStat) => number; fmt?: (v: number) => string };
const METRICS: Metric[] = [
  { key: 'cal', label: '섭취 칼로리', color: 'var(--meal)', unit: 'kcal', get: (d) => Math.round(d.nutrition.calories) },
  { key: 'protein', label: '단백질', color: 'var(--meal)', unit: 'g', get: (d) => Math.round(d.nutrition.protein) },
  { key: 'vol', label: '운동 볼륨', color: 'var(--workout)', unit: 'kg', get: (d) => d.workoutVolume, fmt: fmtVol },
  { key: 'wmin', label: '운동 시간', color: 'var(--workout)', unit: '분', get: (d) => d.workoutMinutes },
  { key: 'study', label: '공부 시간', color: 'var(--study)', unit: '분', get: (d) => d.studyMinutes },
];

export default function Stats() {
  const [range, setRange] = useState<7 | 30>(7);
  const [data, setData] = useState<{ days: DayStat[]; calorieGoal: number } | null>(null);
  const [metric, setMetric] = useState(METRICS[0]);
  useEffect(() => { api.stats(range).then(setData).catch(() => {}); }, [range]);

  if (!data) return <><TopBar title="통계" /><div className="page"><div className="empty">불러오는 중…</div></div></>;
  const days = data.days;
  const vals = days.map(metric.get);
  const max = Math.max(1, ...vals, metric.key === 'cal' ? data.calorieGoal : 0);
  const sum = vals.reduce((a, b) => a + b, 0);
  const active = vals.filter((v) => v > 0).length;
  const avg = active ? Math.round(sum / active) : 0;
  const f = metric.fmt || ((v: number) => `${v}${metric.unit}`);
  const goalDays = days.filter((d) => d.mealCount > 0 && d.nutrition.calories <= data.calorieGoal).length;
  const mealDays = days.filter((d) => d.mealCount > 0).length;
  const wk = (s: string) => '일월화수목금토'[new Date(s + 'T00:00:00').getDay()];

  return (
    <>
      <TopBar title="통계" right={
        <div className="subtabs" style={{ margin: 0, padding: 3 }}>
          <button className={range === 7 ? 'active' : ''} onClick={() => setRange(7)} style={{ padding: '6px 12px' }}>주간</button>
          <button className={range === 30 ? 'active' : ''} onClick={() => setRange(30)} style={{ padding: '6px 12px' }}>월간</button>
        </div>} />
      <div className="page">
        <div className="card hero">
          <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {METRICS.map((m) => <button key={m.key} className={'like-btn' + (metric.key === m.key ? ' on' : '')} onClick={() => setMetric(m)}>{m.label}</button>)}
          </div>
          <div className="row">
            <div className="grow"><div className="muted small">{range}일 합계</div><div className="big" style={{ color: metric.color }}>{f(sum)}</div></div>
            <div className="stat"><b>{f(avg)}</b><span>활동일 평균</span></div>
            <div className="stat"><b>{active}<small style={{ fontSize: 11 }}>일</small></b><span>기록한 날</span></div>
          </div>
          <div className="chart">
            {days.map((d, i) => (
              <div className={'col' + (d.date === todayStr() ? ' today' : '')} key={d.date} title={`${d.date}: ${f(vals[i])}`}>
                <i style={{ height: `${(vals[i] / max) * 100}%`, background: vals[i] ? metric.color : undefined, opacity: metric.key === 'cal' && vals[i] > data.calorieGoal ? .55 : 1 }} />
                <span>{range === 7 ? wk(d.date) : (i % 5 === 0 ? d.date.slice(8) : '')}</span>
              </div>
            ))}
          </div>
          {metric.key === 'cal' && <div className="muted small" style={{ marginTop: 8 }}>목표 {data.calorieGoal} kcal · 식단 기록한 {mealDays}일 중 <b className="accent">{goalDays}일</b> 목표 달성 {mealDays ? `(${Math.round((goalDays / mealDays) * 100)}%)` : ''}</div>}
        </div>

        <div className="card">
          <h3>기간 요약</h3>
          <div className="stat-grid">
            <div className="stat workout"><b>{fmtVol(days.reduce((a, d) => a + d.workoutVolume, 0))}</b><span>총 볼륨</span></div>
            <div className="stat workout"><b>{days.reduce((a, d) => a + d.workoutCount, 0)}<small style={{ fontSize: 11 }}>회</small></b><span>운동 횟수</span></div>
            <div className="stat workout"><b>{days.reduce((a, d) => a + d.workoutMinutes, 0)}<small style={{ fontSize: 11 }}>분</small></b><span>운동 시간</span></div>
            <div className="stat meal"><b>{Math.round(days.reduce((a, d) => a + d.nutrition.calories, 0) / Math.max(1, mealDays))}</b><span>일평균 kcal</span></div>
            <div className="stat meal"><b>{Math.round(days.reduce((a, d) => a + d.nutrition.protein, 0) / Math.max(1, mealDays))}<small style={{ fontSize: 11 }}>g</small></b><span>일평균 단백질</span></div>
            <div className="stat study"><b>{Math.round(days.reduce((a, d) => a + d.studyMinutes, 0) / 60 * 10) / 10}<small style={{ fontSize: 11 }}>h</small></b><span>공부 시간</span></div>
          </div>
        </div>

        <div className="card">
          <h3>일별</h3>
          {[...days].reverse().filter((d) => d.studyCount + d.mealCount + d.workoutCount > 0).map((d) => (
            <div className="row" key={d.date} style={{ padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span style={{ width: 70 }}>{d.date.slice(5)} ({wk(d.date)})</span>
              <span className="grow muted">💪 {d.workoutVolume ? fmtVol(d.workoutVolume) : `${d.workoutMinutes}분`} · 🍽 {Math.round(d.nutrition.calories)} · 📚 {d.studyMinutes}분</span>
            </div>
          ))}
          {days.every((d) => d.studyCount + d.mealCount + d.workoutCount === 0) && <div className="empty">이 기간 기록이 없어요</div>}
        </div>
      </div>
    </>
  );
}
