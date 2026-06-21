import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// 환경변수에서 Supabase 접속 정보 읽기 (anon key 는 공개되어도 안전 — RLS 로 보호)
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// 키가 설정됐는지 여부 (미설정 시 로그인 화면에서 안내)
export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey;

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // 웹: 이메일 인증 링크의 세션을 URL 에서 감지. 네이티브는 불필요.
      detectSessionInUrl: Platform.OS === 'web',
    },
  }
);
