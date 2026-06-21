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
  const { signIn, signUp, sendPasswordReset } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;

    // 비밀번호 찾기: 이메일만 필요
    if (mode === 'reset') {
      if (!email.trim()) {
        Alert.alert('확인', '가입한 이메일을 입력해주세요.');
        return;
      }
      setBusy(true);
      try {
        await sendPasswordReset(email.trim());
        Alert.alert(
          '메일을 보냈어요',
          '비밀번호 재설정 링크를 메일로 보냈어요. 링크를 누르면 새 비밀번호를 설정할 수 있어요.'
        );
        setMode('signin');
      } catch (e: any) {
        Alert.alert('전송 실패', e?.message ?? '다시 시도해주세요.');
      } finally {
        setBusy(false);
      }
      return;
    }

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

  const title =
    mode === 'signin' ? '로그인' : mode === 'signup' ? '회원가입' : '재설정 메일 보내기';

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
        <Text style={styles.sub}>
          {mode === 'reset'
            ? '가입한 이메일로 재설정 링크를 보내드려요'
            : '로그인하면 폰과 웹에서 함께 보여요'}
        </Text>

        <TextInput
          style={styles.input}
          placeholder="이메일"
          placeholderTextColor={COLORS.subtext}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        {mode !== 'reset' && (
          <TextInput
            style={styles.input}
            placeholder="비밀번호 (6자 이상)"
            placeholderTextColor={COLORS.subtext}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        )}

        {mode === 'signin' && (
          <Pressable style={styles.forgot} onPress={() => setMode('reset')}>
            <Text style={styles.forgotText}>비밀번호를 잊으셨나요?</Text>
          </Pressable>
        )}

        <Pressable style={[styles.btn, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{title}</Text>}
        </Pressable>

        {mode === 'reset' ? (
          <Pressable style={styles.switch} onPress={() => setMode('signin')}>
            <Text style={styles.switchText}>로그인으로 돌아가기</Text>
          </Pressable>
        ) : (
          <Pressable
            style={styles.switch}
            onPress={() => setMode((m) => (m === 'signin' ? 'signup' : 'signin'))}
          >
            <Text style={styles.switchText}>
              {mode === 'signin' ? '계정이 없나요? 회원가입' : '이미 계정이 있나요? 로그인'}
            </Text>
          </Pressable>
        )}
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
  forgot: { alignSelf: 'flex-end', marginTop: 2, marginBottom: 4 },
  forgotText: { color: COLORS.subtext, fontSize: 13, fontWeight: '600' },
  switch: { marginTop: 18, alignItems: 'center' },
  switchText: { color: COLORS.accent, fontSize: 14, fontWeight: '600' },
});
