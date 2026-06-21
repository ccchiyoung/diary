import { decode as decodeBase64 } from 'base64-arraybuffer';
import { supabase } from './supabase';

export type Entry = {
  id: string;
  date: string; // YYYY-MM-DD
  doodleUri: string; // 서명된 이미지 URL (표시용)
  text: string;
  color: string;
  width: number;
  height: number;
  posX: number | null; // 위클리에서 사용자가 옮긴 위치 (영역 대비 0~1)
  posY: number | null;
  updatedAt: number;
};

const BUCKET = 'doodles';
const SIGNED_TTL = 60 * 60; // 1시간
export const MAX_PER_DAY = 3;

type Row = {
  id: string;
  date: string;
  text: string | null;
  color: string | null;
  width: number | null;
  height: number | null;
  pos_x: number | null;
  pos_y: number | null;
  doodle_path: string;
  updated_at: string;
};

const SELECT_COLS = 'id, date, text, color, width, height, pos_x, pos_y, doodle_path, updated_at';

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) throw new Error('로그인이 필요합니다.');
  return uid;
}

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

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
    id: row.id,
    date: row.date,
    doodleUri: signedUrl,
    text: row.text ?? '',
    color: row.color ?? '#343A40',
    width: row.width ?? 0,
    height: row.height ?? 0,
    posX: row.pos_x,
    posY: row.pos_y,
    updatedAt: row.updated_at ? Date.parse(row.updated_at) : 0,
  };
}

// 특정 날짜의 기록 개수
export async function countEntriesForDate(date: string): Promise<number> {
  const uid = await getUserId();
  if (!uid) return 0;
  const { count } = await supabase
    .from('entries')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', uid)
    .eq('date', date);
  return count ?? 0;
}

// 두들 + 메타를 새 기록으로 추가 (하루 최대 MAX_PER_DAY 개)
export async function saveEntry(input: {
  date: string;
  base64: string;
  text: string;
  color: string;
  width: number;
  height: number;
}): Promise<Entry> {
  const uid = await requireUserId();

  const existing = await countEntriesForDate(input.date);
  if (existing >= MAX_PER_DAY) {
    throw new Error(`하루 최대 ${MAX_PER_DAY}개까지 기록할 수 있어요.`);
  }

  // 하루 여러 개를 위해 유니크한 파일 경로
  const unique = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const path = `${uid}/${input.date}/${unique}.png`;

  const bytes = decodeBase64(input.base64);
  const up = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: 'image/png',
    upsert: false,
  });
  if (up.error) throw up.error;

  const { data, error } = await supabase
    .from('entries')
    .insert({
      user_id: uid,
      date: input.date,
      text: input.text,
      color: input.color,
      width: Math.round(input.width),
      height: Math.round(input.height),
      doodle_path: path,
      updated_at: new Date().toISOString(),
    })
    .select(SELECT_COLS)
    .single();
  if (error) throw error;

  const signed = await signMany([path]);
  return rowToEntry(data as Row, signed[path] ?? '');
}

// 주어진 날짜들의 모든 기록(하루 여러 개 포함)을 최신순으로 반환
export async function listEntries(dates: string[]): Promise<Entry[]> {
  if (dates.length === 0) return [];
  const uid = await getUserId();
  if (!uid) return [];
  const { data, error } = await supabase
    .from('entries')
    .select(SELECT_COLS)
    .eq('user_id', uid)
    .in('date', dates)
    .order('date', { ascending: false })
    .order('updated_at', { ascending: false });
  if (error || !data) return [];

  const rows = data as Row[];
  const signed = await signMany(rows.map((r) => r.doodle_path));
  return rows.map((r) => rowToEntry(r, signed[r.doodle_path] ?? ''));
}

// 날짜 키 -> 해당 날짜 기록 배열(최신순)
export async function listEntriesByDate(
  dates: string[]
): Promise<Record<string, Entry[]>> {
  const entries = await listEntries(dates);
  const map: Record<string, Entry[]> = {};
  for (const e of entries) {
    (map[e.date] ??= []).push(e);
  }
  return map;
}

// 두들 위치 저장 (영역 대비 0~1 비율)
export async function updateEntryPosition(
  id: string,
  posX: number,
  posY: number
): Promise<void> {
  const uid = await getUserId();
  if (!uid) return;
  await supabase
    .from('entries')
    .update({ pos_x: posX, pos_y: posY })
    .eq('id', id)
    .eq('user_id', uid);
}

// 기록 삭제 (이미지 + 행)
export async function deleteEntry(entry: Entry): Promise<void> {
  const uid = await getUserId();
  if (!uid) return;
  await supabase.from('entries').delete().eq('id', entry.id).eq('user_id', uid);
}
