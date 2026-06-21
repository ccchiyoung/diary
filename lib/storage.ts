import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveDoodlePng } from './files';

export type Entry = {
  date: string; // YYYY-MM-DD
  doodleUri: string; // file:// 경로
  text: string;
  color: string; // 대표 감정 색
  width: number; // 두들 가로 픽셀 (표시 비율 계산용)
  height: number; // 두들 세로 픽셀
  updatedAt: number;
};

const keyFor = (date: string) => `entry:${date}`;

// 두들 base64 + 메타를 함께 저장 (하루 1개, 같은 날이면 덮어쓰기)
export async function saveEntry(input: {
  date: string;
  base64: string;
  text: string;
  color: string;
  width: number;
  height: number;
}): Promise<Entry> {
  const doodleUri = await saveDoodlePng(input.date, input.base64);
  const entry: Entry = {
    date: input.date,
    doodleUri,
    text: input.text,
    color: input.color,
    width: input.width,
    height: input.height,
    updatedAt: Date.now(),
  };
  await AsyncStorage.setItem(keyFor(input.date), JSON.stringify(entry));
  return entry;
}

export async function getEntry(date: string): Promise<Entry | null> {
  const raw = await AsyncStorage.getItem(keyFor(date));
  return raw ? (JSON.parse(raw) as Entry) : null;
}

// 여러 날짜 키에 대한 기록을 한 번에 조회 (없으면 null)
export async function getEntries(dates: string[]): Promise<(Entry | null)[]> {
  const pairs = await AsyncStorage.multiGet(dates.map(keyFor));
  return pairs.map(([, v]) => (v ? (JSON.parse(v) as Entry) : null));
}

// 날짜 키 -> Entry 맵 (기록 있는 것만)
export async function getEntryMap(dates: string[]): Promise<Record<string, Entry>> {
  const entries = await getEntries(dates);
  const map: Record<string, Entry> = {};
  entries.forEach((e) => {
    if (e) map[e.date] = e;
  });
  return map;
}
