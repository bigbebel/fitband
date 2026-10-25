// 건강 앱 데이터 → 운동 기록 변환
//  - 아이폰: 단축어(Shortcuts)가 보내는 JSON 또는 텍스트 줄
//  - 갤럭시: 삼성 헬스 "개인 데이터 다운로드" 의 exercise CSV

const KST = 9 * 3600 * 1000;
const dateOf = (ts) => new Date(ts + KST).toISOString().slice(0, 10);
const num = (v) => { const m = String(v ?? '').replace(/,/g, '').match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : 0; };

// "2026-10-25 19:30", "2026-10-25T10:30:00Z", 숫자(ms) 등
function parseTime(v) {
  if (!v) return null;
  if (typeof v === 'number') return v > 1e12 ? v : v * 1000;
  const s = String(v).trim();
  if (/^\d{13}$/.test(s)) return Number(s);
  if (/^\d{10}$/.test(s)) return Number(s) * 1000;
  // 'yyyy-MM-dd HH:mm' 처럼 타임존 없는 경우 KST 로 간주
  const m = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(\.\d+)?$/);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) - KST;
  // 단축어 기본 한국어 포맷: "2026. 10. 25. 오전 7:10" / "2026년 10월 25일 오후 7:10:30"
  const k = s.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})\D+?(오전|오후|AM|PM)?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(오전|오후|AM|PM)?/i);
  if (k) {
    const ap = (k[4] || k[8] || '').toUpperCase();
    let h = +k[5];
    if (ap === '오후' || ap === 'PM') { if (h < 12) h += 12; } else if (ap === '오전' || ap === 'AM') { if (h === 12) h = 0; }
    return Date.UTC(+k[1], +k[2] - 1, +k[3], h, +k[6], +(k[7] || 0)) - KST;
  }
  const d = Date.parse(s);
  return Number.isNaN(d) ? null : d;
}
// "45분", "0:45:12", "2700" (초), "45 min"
function parseMinutes(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v > 10000 ? Math.round(v / 60000) : v > 600 ? Math.round(v / 60) : Math.round(v); // ms / sec / min
  const s = String(v).trim();
  const hms = s.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (hms) return hms[3] ? +hms[1] * 60 + +hms[2] : +hms[1];
  let min = 0;
  const h = s.match(/(\d+(?:\.\d+)?)\s*(시간|h)/i); if (h) min += +h[1] * 60;
  const mm = s.match(/(\d+(?:\.\d+)?)\s*(분|m)/i); if (mm) min += +mm[1];
  const sec = s.match(/(\d+(?:\.\d+)?)\s*(초|s)\b/i); if (sec) min += +sec[1] / 60;
  if (!h && !mm && !sec) { const x = num(s); min = x > 600 ? x / 60 : x; }
  return Math.round(min);
}

const APPLE_NAMES = {
  running: '러닝', walking: '걷기', cycling: '사이클', swimming: '수영', hiking: '하이킹', yoga: '요가', 'traditional strength training': '근력 운동',
  'functional strength training': '기능성 근력', 'high intensity interval training': 'HIIT', 'core training': '코어', elliptical: '일립티컬', rowing: '로잉',
  'stair climbing': '계단 오르기', 'mixed cardio': '유산소', pilates: '필라테스', 'cooldown': '쿨다운', 'jump rope': '줄넘기', soccer: '축구', basketball: '농구',
  tennis: '테니스', badminton: '배드민턴', golf: '골프', 'table tennis': '탁구', dance: '댄스', boxing: '복싱', climbing: '클라이밍', 'cross training': '크로스 트레이닝',
};
const nameOf = (s) => { const k = String(s || '').trim(); return APPLE_NAMES[k.toLowerCase()] || k || '운동'; };

// 단축어 입력 → 운동 배열
export function normalizeWorkouts(body, source) {
  let list = [];
  if (Array.isArray(body)) list = body;
  else if (body && Array.isArray(body.workouts)) list = body.workouts;
  else if (body && (body.name || body.type || body.start || body.유형 || body.시작)) list = [body];
  else if (body && typeof body.text === 'string') {
    // 한 줄에 하나: 종류|시작|종료|시간|칼로리|거리
    list = body.text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
      const [type, start, end, duration, calories, distance] = l.split('|').map((x) => x.trim());
      return { type, start, end, duration, calories, distance };
    });
  }
  return list.map((w) => {
    const start = parseTime(w.start || w.startDate || w.start_time || w.시작 || w['시작 날짜']) || Date.now();
    const end = parseTime(w.end || w.endDate || w.end_time || w.종료 || w['종료 날짜']);
    let minutes = parseMinutes(w.duration ?? w.minutes ?? w.기간);
    if (!minutes && end) minutes = Math.round((end - start) / 60000);
    return {
      source, externalId: w.id || w.uuid || null, start, date: dateOf(start),
      name: nameOf(w.name || w.type || w.activity || w.유형 || w['운동 유형']), minutes,
      calories: Math.round(num(w.calories ?? w.energy ?? w.activeEnergy ?? w.칼로리 ?? w['활동 에너지'])),
      distanceKm: distKm(w.distance ?? w.거리),
    };
  }).filter((w) => w.minutes > 0 || w.calories > 0);
}

function distKm(v) {
  const s = String(v ?? ''); const x = num(s);
  if (!x) return 0;
  const meters = /\bm\b/i.test(s) && !/km/i.test(s);
  return Math.round((meters ? x / 1000 : x > 500 ? x / 1000 : x) * 100) / 100; // 단위 없는 큰 수는 m 로 간주
}

const SAMSUNG_TYPES = {
  1001: '걷기', 1002: '러닝', 11007: '사이클', 14001: '수영', 13001: '하이킹', 9002: '요가', 10007: '근력 운동', 10004: '웨이트',
  15006: '일립티컬', 15005: '로잉', 15003: '러닝머신', 15004: '계단 오르기', 9001: '필라테스', 6003: '축구', 6002: '농구', 6005: '배드민턴',
  6004: '테니스', 10005: '서킷 트레이닝', 10002: '스트레칭', 12001: '줄넘기', 0: '운동',
};

// 삼성 헬스 CSV (첫 줄: 메타, 둘째 줄: 컬럼명, 이후 데이터)
export function parseSamsungCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  let hi = lines.findIndex((l) => /start_time/.test(l) && /duration/.test(l));
  if (hi < 0) return [];
  const headers = splitCsv(lines[hi]).map((h) => h.trim().replace(/^com\.samsung\.(health|shealth)\.exercise\./, ''));
  const idx = (name) => headers.findIndex((h) => h === name || h.endsWith('.' + name));
  const iStart = idx('start_time'), iDur = idx('duration'), iCal = idx('calorie'), iDist = idx('distance'), iType = idx('exercise_type'), iId = idx('datauuid'), iOff = idx('time_offset');
  const out = [];
  for (const line of lines.slice(hi + 1)) {
    const c = splitCsv(line);
    if (c.length < headers.length - 5) continue;
    // start_time 은 UTC 기준("2026-10-25 10:30:00.000"), time_offset 예: "UTC+0900"
    let start = parseTime(c[iStart]); if (start == null) continue;
    start += KST; // parseTime 이 KST 로 간주해 뺀 것을 되돌림(UTC) 
    const off = (c[iOff] || '').match(/UTC([+-])(\d{2})(\d{2})/);
    const offMs = off ? (off[1] === '-' ? -1 : 1) * (+off[2] * 60 + +off[3]) * 60000 : KST;
    const localDate = new Date(start + offMs).toISOString().slice(0, 10);
    out.push({
      source: 'samsung', externalId: c[iId] || null, start, date: localDate,
      name: SAMSUNG_TYPES[num(c[iType])] || '운동',
      minutes: Math.round(num(c[iDur]) / 60000),
      calories: Math.round(num(c[iCal])),
      distanceKm: Math.round(num(c[iDist]) / 10) / 100,
    });
  }
  return out.filter((w) => w.minutes > 0 || w.calories > 0);
}
function splitCsv(line) {
  const out = []; let cur = '', q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur); return out;
}
