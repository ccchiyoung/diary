import { decode as decodeBase64 } from 'base64-arraybuffer';
import { supabase } from './supabase';

export type Entry = {
  date: string; // YYYY-MM-DD
  doodleUri: string; // 서명된 이미지 URL (표시용)
  text: string;
  color: string;
  width: number;
  height: number;
  updatedAt: number;
};

const BUCKET = 'doodles';
const SIGNED_TTL = 60 * 60; // 1시간

type Row = {
  date: string;
  text: string | null;
  color: string | null;
  width: number | null;
  height: number | null;
  doodle_path: string;
  updated_at: string;
};

// 현재 로그인 사용자 id (없으면 null)
async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

// 여러 path 를 한 번에 서명 URL 로 변환 (path -> url)
async function signMany(paths: string[]): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  if (paths.length === 0) return map;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, SIGNED_TTL);
  if (error || !data) return map;
  for (const item of data) {
    if (item.signedUrl && item.path) map[item.path] = item.signedUrl;
  }
  return map;
}

function rowToEntry(row: Row, signedUrl: string): Entry {
  return {
    date: row.date,
    doodleUri: signedUrl,
    text: row.text ?? '',
    color: row.color ?? '#343A40',
    width: row.width ?? 0,
    height: row.height ?? 0,
    updatedAt: row.updated_at ? Date.parse(row.updated_at) : 0,
  };
}

// 두들 base64 + 메타를 Supabase 에 저장 (하루 1개, 같은 날이면 덮어쓰기)
export async function saveEntry(input: {
  date: string;
  base64: string;
  text: string;
  color: string;
  width: number;
  height: number;
}): Promise<Entry> {
  const uid = await getUserId();
  if (!uid) throw new Error('로그인이 필요합니다.');
  const path = `${uid}/${input.date}.png`;

  // 1) 이미지 업로드 (덮어쓰기)
  const bytes = decodeBase64(input.base64);
  const up = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: 'image/png',
    upsert: true,
  });
  if (up.error) throw up.error;

  // 2) 메타 upsert (user_id + date 유니크)
  const { error } = await supabase.from('entries').upsert(
    {
      user_id: uid,
      date: input.date,
      text: input.text,
      color: input.color,
      width: input.width,
      height: input.height,
      doodle_path: path,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,date' }
  );
  if (error) throw error;

  const signed = await signMany([path]);
  return rowToEntry(
    {
      date: input.date,
      text: input.text,
      color: input.color,
      width: input.width,
      height: input.height,
      doodle_path: path,
      updated_at: new Date().toISOString(),
    },
    signed[path] ?? ''
  );
}

export async function getEntries(dates: string[]): Promise<(Entry | null)[]> {
  const map = await getEntryMap(dates);
  return dates.map((d) => map[d] ?? null);
}

// 날짜 키 -> Entry 맵 (기록 있는 것만)
export async function getEntryMap(dates: string[]): Promise<Record<string, Entry>> {
  if (dates.length === 0) return {};
  const uid = await getUserId();
  if (!uid) return {}; // 로그인 전이면 빈 결과 (에러 대신)
  const { data, error } = await supabase
    .from('entries')
    .select('date, text, color, width, height, doodle_path, updated_at')
    .eq('user_id', uid)
    .in('date', dates);
  if (error || !data) return {};

  const rows = data as Row[];
  const signed = await signMany(rows.map((r) => r.doodle_path));
  const map: Record<string, Entry> = {};
  for (const row of rows) {
    map[row.date] = rowToEntry(row, signed[row.doodle_path] ?? '');
  }
  return map;
}

export async function getEntry(date: string): Promise<Entry | null> {
  const map = await getEntryMap([date]);
  return map[date] ?? null;
}
