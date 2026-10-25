// 데이터 저장소.
//  - SUPABASE_URL + SUPABASE_SERVICE_KEY 가 있으면: Supabase Storage 에 db.json 저장 (서버 재시작에도 유지)
//  - 없으면: 로컬 data/db.json (개발용)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, 'data', 'db.json');
const DATA_BUCKET = 'fitband-data';
const UPLOAD_BUCKET = 'fitband-uploads';

export const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })
  : null;

const empty = { users: [], teams: [], members: [], entries: [], comments: [], likes: [], posts: [] };
const db = structuredClone(empty);

export async function load() {
  let raw = null;
  if (supabase) {
    const { data, error } = await supabase.storage.from(DATA_BUCKET).download('db.json');
    if (data) raw = await data.text();
    else if (error && !/not found|Object not found/i.test(error.message)) console.error('db load:', error.message);
  } else {
    try { raw = fs.readFileSync(FILE, 'utf8'); } catch {}
  }
  if (raw) {
    try { Object.assign(db, { ...structuredClone(empty), ...JSON.parse(raw) }); } catch (e) { console.error('db parse:', e.message); }
  }
  console.log(`DB loaded (${supabase ? 'supabase' : 'local'}): users=${db.users.length} teams=${db.teams.length} entries=${db.entries.length}`);
}

let timer = null;
let saving = Promise.resolve();
export function save() {
  clearTimeout(timer);
  timer = setTimeout(() => { saving = saving.then(flush).catch((e) => console.error('db save:', e.message)); }, 150);
}
async function flush() {
  const json = JSON.stringify(db, null, 2);
  if (supabase) {
    const { error } = await supabase.storage.from(DATA_BUCKET).upload('db.json', Buffer.from(json), { contentType: 'application/json', upsert: true });
    if (error) throw error;
  } else {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, json);
  }
}

// 업로드 파일 저장 → 접근 가능한 URL 반환
export async function storeUpload(localPath, filename, mimeType) {
  if (!supabase) return `/uploads/${filename}`;
  const { error } = await supabase.storage.from(UPLOAD_BUCKET).upload(filename, fs.readFileSync(localPath), { contentType: mimeType, upsert: true });
  if (error) throw error;
  fs.unlink(localPath, () => {});
  return supabase.storage.from(UPLOAD_BUCKET).getPublicUrl(filename).data.publicUrl;
}

export default db;
