#!/bin/sh
set -e
B=http://localhost:3000
J='content-type: application/json'
jq() { node -pe "const r=JSON.parse(require('fs').readFileSync(0)); $1"; }
S1=$(curl -s -XPOST $B/api/auth/signup -H "$J" -d '{"email":"a@fitband.test","password":"test1234","name":"민수"}')
T1=$(echo "$S1" | jq 'r.token'); echo "signup A: $(echo "$S1" | jq 'r.user.name+" "+(r.error||"")')"
S2=$(curl -s -XPOST $B/api/auth/signup -H "$J" -d '{"email":"b@fitband.test","password":"test1234","name":"지영"}')
T2=$(echo "$S2" | jq 'r.token')
echo "login A again: $(curl -s -XPOST $B/api/auth/login -H "$J" -d '{"email":"a@fitband.test","password":"test1234"}' | jq 'r.user.name')"
echo "wrong pw: $(curl -s -XPOST $B/api/auth/login -H "$J" -d '{"email":"a@fitband.test","password":"xxxxxx"}' | jq 'r.error')"
TEAM=$(curl -s -XPOST $B/api/teams -H "$J" -H "authorization: Bearer $T1" -d '{"name":"새벽팀"}')
TID=$(echo "$TEAM" | jq 'r.id'); CODE=$(echo "$TEAM" | jq 'r.inviteCode')
curl -s -XPOST $B/api/invite/$CODE/join -H "authorization: Bearer $T2" >/dev/null; echo "B joined"
curl -s -XPATCH $B/api/me -H "$J" -H "authorization: Bearer $T2" -d '{"calorieGoal":1800}' | jq '"goal: "+r.calorieGoal'
W=$(curl -s -XPOST $B/api/entries/workout -H "$J" -H "authorization: Bearer $T2" -d "{\"title\":\"하체\",\"minutes\":60,\"exercises\":[{\"name\":\"스쿼트\",\"sets\":[{\"weight\":80,\"reps\":5},{\"weight\":80,\"reps\":5}]},{\"name\":\"런지\",\"sets\":[{\"weight\":20,\"reps\":12}]}],\"teams\":[\"$TID\"]}")
echo "workout: $(echo "$W" | jq '"volume="+r.volume+" title="+r.title')"
curl -s -XPOST $B/api/teams/$TID/like -H "$J" -H "authorization: Bearer $T1" -d "{\"date\":\"$(date +%F)\",\"userId\":$(echo "$S2" | jq 'JSON.stringify(r.user.id)')}" | jq '"like: "+r.liked'
curl -s -XPOST $B/api/teams/$TID/comments -H "$J" -H "authorization: Bearer $T1" -d "{\"date\":\"$(date +%F)\",\"userId\":$(echo "$S2" | jq 'JSON.stringify(r.user.id)'),\"text\":\"화이팅!\"}" | jq '"comment by "+r.author.name'
curl -s $B/api/teams/$TID/feed -H "authorization: Bearer $T1" | jq 'r.map(g=>g.user.name+" likes="+g.likes.length+" comments="+g.comments.length+" vol="+g.summary.workoutVolume).join("; ")'
HT=$(curl -s -XPOST $B/api/health/token -H "authorization: Bearer $T2" | jq 'r.healthToken')
curl -s -XPOST $B/api/health/import/$HT -H 'content-type: text/plain' --data-binary "Running|$(date +%F) 07:10|$(date +%F) 07:52|42분|380 kcal|5.3 km" | jq '"apple import: "+r.message'
curl -s -XPOST $B/api/health/import/$HT -H 'content-type: text/plain' --data-binary "Running|$(date +%F) 07:10|$(date +%F) 07:52|42분|380 kcal|5.3 km" | jq '"apple import again (dedupe): "+r.added'
curl -s "$B/api/stats?days=7" -H "authorization: Bearer $T2" | jq '"stats today: "+JSON.stringify(r.days[6])'
