import { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../lib/auth';
import { isSupabaseConfigured } from '../lib/supabase';
import { COLORS } from '../lib/theme';

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    if (!email.trim() || password.length < 6) {
      Alert.alert('확인', '이메일과 6자 이상 비밀번호를 입력해주세요.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
      } else {
        const { needsConfirm } = await signUp(email.trim(), password);
        if (needsConfirm) {
          Alert.alert(
            '메일을 확인해주세요',
            '가입 확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해주세요.'
          );
          setMode('signin');
        }
      }
    } catch (e: any) {
      Alert.alert('로그인 실패', e?.message ?? '다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>설정이 필요해요</Text>
        <Text style={styles.sub}>
          Supabase 접속 정보(EXPO_PUBLIC_SUPABASE_URL / ANON_KEY)가{'\n'}
          아직 설정되지 않았습니다.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.emoji}>🎨</Text>
        <Text style={styles.title}>감정 다이어리</Text>
        <Text style={styles.sub}>로그인하면 폰과 웹에서 함께 보여요</Text>

        <TextInput
          style={styles.input}
          placeholder="이메일"
          placeholderTextColor={COLORS.subtext}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="비밀번호 (6자 이상)"
          placeholderTextColor={COLORS.subtext}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Pressable style={[styles.btn, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>{mode === 'signin' ? '로그인' : '회원가입'}</Text>
          )}
        </Pressable>

        <Pressable
          style={styles.switch}
          onPress={() => setMode((m) => (m === 'signin' ? 'signup' : 'signin'))}
        >
          <Text style={styles.switchText}>
            {mode === 'signin' ? '계정이 없나요? 회원가입' : '이미 계정이 있나요? 로그인'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: COLORS.bg },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  emoji: { fontSize: 48, textAlign: 'center' },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.text, textAlign: 'center', marginTop: 12 },
  sub: { fontSize: 14, color: COLORS.subtext, textAlign: 'center', marginTop: 8, marginBottom: 28, lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 12,
  },
  btn: {
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  switch: { marginTop: 18, alignItems: 'center' },
  switchText: { color: COLORS.accent, fontSize: 14, fontWeight: '600' },
});
