import { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth';
import { COLORS } from '../lib/theme';

export default function ResetPasswordScreen() {
  const { updatePassword } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    if (password.length < 6) {
      Alert.alert('확인', '새 비밀번호는 6자 이상이어야 해요.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('확인', '비밀번호가 서로 달라요.');
      return;
    }
    setBusy(true);
    try {
      await updatePassword(password);
      Alert.alert('완료', '새 비밀번호로 변경했어요.');
      router.replace('/');
    } catch (e: any) {
      Alert.alert('변경 실패', e?.message ?? '다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.emoji}>🔑</Text>
        <Text style={styles.title}>새 비밀번호 설정</Text>
        <Text style={styles.sub}>새로 사용할 비밀번호를 입력해주세요</Text>

        <TextInput
          style={styles.input}
          placeholder="새 비밀번호 (6자 이상)"
          placeholderTextColor={COLORS.subtext}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TextInput
          style={styles.input}
          placeholder="새 비밀번호 확인"
          placeholderTextColor={COLORS.subtext}
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
        />

        <Pressable style={[styles.btn, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>변경하기</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  emoji: { fontSize: 48, textAlign: 'center' },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.text, textAlign: 'center', marginTop: 12 },
  sub: { fontSize: 14, color: COLORS.subtext, textAlign: 'center', marginTop: 8, marginBottom: 28 },
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
});
