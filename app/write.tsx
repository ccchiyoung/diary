import { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { getDraft, clearDraft } from '../lib/draft';
import { saveEntry } from '../lib/storage';
import { todayKey, dayLabel } from '../lib/dates';
import { COLORS } from '../lib/theme';

const MAX_LEN = 120;

export default function WriteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const draft = getDraft();

  // 두들 없이 직접 진입한 경우 되돌리기
  useEffect(() => {
    if (!draft) router.replace('/');
  }, [draft]);

  if (!draft) return null;

  const previewUri = `data:image/png;base64,${draft.base64}`;

  const onSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await saveEntry({
        date: todayKey(),
        base64: draft.base64,
        text: text.trim(),
        color: draft.color,
        width: draft.width,
        height: draft.height,
      });
      clearDraft();
      // 기록 후 홈으로 (스택 초기화). 웹에서는 dismissAll 이 동작하지 않을 수 있어 가드.
      try {
        router.dismissAll();
      } catch {}
      router.replace('/');
    } catch (e) {
      setSaving(false);
      Alert.alert('저장 실패', '기록을 저장하지 못했어요. 다시 시도해주세요.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.inner, { paddingBottom: insets.bottom + 16 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.date}>{dayLabel(todayKey())}</Text>

        <View style={styles.previewWrap}>
          <Image source={{ uri: previewUri }} style={styles.preview} resizeMode="contain" />
        </View>

        <Text style={styles.label}>오늘의 한 줄</Text>
        <TextInput
          style={styles.input}
          placeholder="지금 마음을 한두 문장으로 적어보세요"
          placeholderTextColor={COLORS.subtext}
          value={text}
          onChangeText={(t) => t.length <= MAX_LEN && setText(t)}
          multiline
          maxLength={MAX_LEN}
          autoFocus
        />
        <Text style={styles.counter}>
          {text.length} / {MAX_LEN}
        </Text>

        <Pressable
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={onSave}
          disabled={saving}
        >
          <Text style={styles.saveText}>{saving ? '저장 중…' : '저장하기'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flexGrow: 1, padding: 16 },
  date: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  previewWrap: {
    height: 200,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.canvas,
    overflow: 'hidden',
    marginBottom: 20,
  },
  preview: { width: '100%', height: '100%' },
  label: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  input: {
    minHeight: 90,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    padding: 14,
    fontSize: 16,
    color: COLORS.text,
    textAlignVertical: 'top',
  },
  counter: {
    alignSelf: 'flex-end',
    marginTop: 6,
    fontSize: 12,
    color: COLORS.subtext,
  },
  saveBtn: {
    marginTop: 'auto',
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
