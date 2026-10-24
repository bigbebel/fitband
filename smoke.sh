#!/bin/sh
set -e
B=http://localhost:3000
J='content-type: application/json'
A=$(curl -s -XPOST $B/api/login -H "$J" -d '{"name":"민수"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).id')
U=$(curl -s -XPOST $B/api/login -H "$J" -d '{"name":"지영"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).id')
T=$(curl -s -XPOST $B/api/teams -H "$J" -H "x-user-id: $A" -d '{"name":"새벽 스터디","desc":"매일 6시"}')
echo "team: $T"
TID=$(echo "$T" | node -pe 'JSON.parse(require("fs").readFileSync(0)).id')
CODE=$(echo "$T" | node -pe 'JSON.parse(require("fs").readFileSync(0)).inviteCode')
curl -s "$B/api/teams/$TID/qr" -H "x-user-id: $A" | node -pe 'const q=JSON.parse(require("fs").readFileSync(0)); "qr: "+q.url+" "+q.dataUrl.slice(0,30)'
curl -s -XPOST "$B/api/invite/$CODE/join" -H "x-user-id: $U" >/dev/null && echo "joined"
# 1x1 png
printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82' > /tmp/t.png
curl -s -XPOST $B/api/entries/meal -H "x-user-id: $U" -F file=@/tmp/t.png -F mealType=점심 -F "teams=[\"$TID\"]" | head -c 200; echo
curl -s -XPOST $B/api/entries/study -H "x-user-id: $U" -F subject=영어 -F minutes=50 -F memo="단어 100개" -F "teams=[\"$TID\"]" | head -c 150; echo
curl -s -XPOST $B/api/entries/workout -H "$J" -H "x-user-id: $U" -d "{\"title\":\"러닝\",\"minutes\":30,\"memo\":\"5km\",\"teams\":[\"$TID\"]}" | head -c 150; echo
echo "--- report"; curl -s "$B/api/report" -H "x-user-id: $U" | node -pe 'JSON.stringify(JSON.parse(require("fs").readFileSync(0)).summary)'
echo "--- feed"; curl -s "$B/api/teams/$TID/feed" -H "x-user-id: $A" | node -pe 'const f=JSON.parse(require("fs").readFileSync(0)); f.map(g=>g.user.name+" "+g.date+" entries="+g.entries.length).join("\n")'
