# FitBand — 공부·식단·운동 팀 보고서 (모바일 웹앱 / PWA)

네이버 밴드처럼 팀을 만들고 QR로 초대하며, 각자의 하루 보고서(공부·식단·운동)를 팀에 올리는 앱.

## 구조
```
fitband/
├── client/   React + Vite + PWA (모바일 UI)
│   └── src/pages/  Home(팀 목록·생성·QR참여) / Team(팀 피드·QR초대) / Report(리포트+공부·식단·운동 탭) / Misc(로그인·초대·내정보)
└── server/   Express API + JSON DB + 업로드 + OpenAI 식단 분석
    ├── index.js  API 라우트
    ├── ai.js     GPT-4o Vision 칼로리·영양 분석 (키 없으면 목업)
    └── db.js     data/db.json 파일 DB
```

## 실행
```bash
npm i                 # concurrently
npm run install:all
export OPENAI_API_KEY=sk-...   # 없으면 식단 분석은 목업 결과
npm run dev           # 서버 :3000, 클라이언트 :5173 (폰에서는 PC IP:5173)
```
프로덕션: `npm run build && npm start` → http://localhost:3000 에서 프론트+API 함께 서빙.

> 카메라(QR 스캔·사진 촬영)는 HTTPS 또는 localhost 에서만 동작합니다. 폰 테스트 시 `npx localtunnel --port 5173` 같은 터널이나 ngrok 을 쓰세요.

## 주요 API
| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | /api/login | 닉네임 로그인 (헤더 `x-user-id` 로 인증) |
| GET/POST | /api/teams | 내 팀 목록 / 팀 생성 |
| GET | /api/teams/:id/qr | 초대 QR(dataURL) + 링크 `/join/CODE` |
| GET/POST | /api/invite/:code(/join) | 초대 미리보기 / 참여 |
| GET | /api/teams/:id/feed | 팀에 공유된 보고서 (날짜·사람별) |
| GET | /api/report?date= | 내 하루 리포트 + 요약(공부분·칼로리·영양·운동) |
| POST | /api/entries/study | 타임랩스(영상/사진) + 메모 (multipart) |
| POST | /api/entries/meal | 사진 → AI 분석 (multipart) |
| POST | /api/entries/workout | 운동 메모 (json) |
| POST | /api/report/share | 하루 보고서를 팀에 공유 |

## v2 추가 기능
- 이메일 계정(Supabase Auth): 어느 기기에서나 같은 기록
- 라이즈 스타일 다크 UI, 운동은 종목·세트(무게×횟수)·볼륨 기록
- 칼로리 목표 설정 + 달성률 링, 주간/월간 통계 그래프
- 팀 보고서 댓글·좋아요
- 건강 앱 연동: 아이폰 단축어 → `POST /api/health/import/:token`, 삼성 헬스 CSV 업로드 → `POST /api/health/samsung`

## 다음 단계 아이디어
- 닉네임 로그인 → 소셜 로그인 / JWT
- JSON DB → SQLite/Postgres, 업로드 → S3
- 댓글·좋아요, 팀 주간 랭킹, 칼로리 목표 설정
