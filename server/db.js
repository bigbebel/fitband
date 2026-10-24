// 간단한 JSON 파일 DB (초안용). 나중에 SQLite/Postgres로 교체 가능.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, 'data', 'db.json');

const empty = { users: [], teams: [], members: [], entries: [] };
// users:   { id, name, createdAt }
// teams:   { id, name, desc, ownerId, inviteCode, createdAt }
// members: { teamId, userId, joinedAt }
// entries: { id, userId, type: 'study'|'meal'|'workout', date, createdAt, ...payload, sharedTeams: [teamId] }

let db = empty;
try {
  db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch {
  db = structuredClone(empty);
}

let timer = null;
export function save() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
  }, 100);
}

export default db;
