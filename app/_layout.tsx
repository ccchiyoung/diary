import { useEffect, useState } from 'react';
import { Platform, View, Text, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { COLORS } from '../lib/theme';
import { AuthProvider, useAuth } from '../lib/auth';

function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg }}>
      <ActivityIndicator color={COLORS.accent} />
    </View>
  );
}

// 세션 유무에 따라 로그인/앱 화면으로 라우팅 가드
function RootNavigator() {
  const { session, loading, passwordRecovery } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const onLogin = segments[0] === 'login';
    const onReset = segments[0] === 'reset-password';
    // 비밀번호 재설정 링크로 들어온 경우: 새 비번 화면으로
    if (passwordRecovery) {
      if (!onReset) router.replace('/reset-password');
      return;
    }
    if (!session && !onLogin) router.replace('/login');
    else if (session && onLogin) router.replace('/');
  }, [session, loading, passwordRecovery, segments]);

  if (loading) return <Loading />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.bg },
        headerShadowVisible: false,
        headerTintColor: COLORS.text,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: COLORS.bg },
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="reset-password" options={{ headerShown: false }} />
      <Stack.Screen name="index" options={{ title: '감정 다이어리' }} />
      <Stack.Screen name="draw" options={{ title: '오늘의 두들' }} />
      <Stack.Screen name="write" options={{ title: '한 줄 기록' }} />
      <Stack.Screen name="monthly" options={{ title: '먼슬리' }} />
    </Stack>
  );
}

const CK_VERSION = '0.40.0';
const CK_BASE = `https://cdn.jsdelivr.net/npm/canvaskit-wasm@${CK_VERSION}/bin/full/`;

// 웹에서 CanvasKit(Skia) 을 CDN <script> 로 직접 주입한다.
// Metro 번들 경유 로드가 실패하던 문제를 피하기 위함. CanvasKit 준비 후에만 resolve.
function loadCanvasKitWeb(): Promise<void> {
  const w = window as any;
  if (w.CanvasKit) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${CK_BASE}canvaskit.js`;
    script.async = true;
    script.onload = async () => {
      try {
        const CanvasKit = await w.CanvasKitInit({ locateFile: (f: string) => `${CK_BASE}${f}` });
        w.CanvasKit = CanvasKit;
        (globalThis as any).CanvasKit = CanvasKit;
        resolve();
      } catch (e) {
        reject(e);
      }
    };
    script.onerror = () => reject(new Error('canvaskit.js load failed'));
    document.head.appendChild(script);
  });
}

export default function RootLayout() {
  // 웹에서는 Skia(CanvasKit WASM)를 먼저 로드해야 두들 그리기가 동작함.
  // 네이티브(iOS/Android)는 즉시 준비 완료.
  const [skiaReady, setSkiaReady] = useState(Platform.OS !== 'web');
  const [skiaError, setSkiaError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') {
      loadCanvasKitWeb()
        .then(() => setSkiaReady(true))
        .catch((e) => setSkiaError(String(e?.message ?? e)));
    }
  }, []);

  if (!skiaReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg, padding: 24 }}>
        {skiaError ? (
          <Text style={{ color: COLORS.subtext, textAlign: 'center' }}>
            그리기 엔진을 불러오지 못했어요.{'\n'}네트워크 확인 후 새로고침 해주세요.
          </Text>
        ) : (
          <ActivityIndicator color={COLORS.accent} />
        )}
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
