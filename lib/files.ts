import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

const isWeb = Platform.OS === 'web';
const DOODLE_DIR = `${FileSystem.documentDirectory ?? ''}doodles/`;

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DOODLE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DOODLE_DIR, { intermediates: true });
  }
}

// base64 PNG 를 저장하고 표시 가능한 uri 반환.
// 네이티브: 파일로 저장 후 file:// 경로. 웹: 파일시스템이 없으므로 data URI 그대로 사용.
export async function saveDoodlePng(date: string, base64: string): Promise<string> {
  if (isWeb) {
    return `data:image/png;base64,${base64}`;
  }
  await ensureDir();
  const uri = `${DOODLE_DIR}${date}.png`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return uri;
}

export async function deleteDoodle(date: string): Promise<void> {
  if (isWeb) return; // 웹은 메타(AsyncStorage)만 지우면 됨
  const uri = `${DOODLE_DIR}${date}.png`;
  await FileSystem.deleteAsync(uri, { idempotent: true });
}
