import { useRef } from 'react';
import { StyleSheet, View, Pressable, Text, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DoodleCanvas, { type DoodleCanvasHandle } from '../components/DoodleCanvas';
import { setDraft } from '../lib/draft';
import { COLORS } from '../lib/theme';

export default function DrawScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const canvasRef = useRef<DoodleCanvasHandle>(null);

  const onNext = () => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.isEmpty()) {
      Alert.alert('두들을 그려주세요', '오늘의 감정을 간단히 그림으로 남겨보세요.');
      return;
    }
    const base64 = canvas.exportBase64();
    if (!base64) {
      Alert.alert('이런', '그림을 저장하지 못했어요. 다시 시도해주세요.');
      return;
    }
    const size = canvas.getSize();
    setDraft({ base64, color: canvas.getColor(), width: size.width, height: size.height });
    router.push('/write');
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 12 }]}>
      <Text style={styles.hint}>지금 기분을 두들로 그려보세요 🎨</Text>
      <DoodleCanvas ref={canvasRef} />
      <Pressable style={styles.nextBtn} onPress={onNext}>
        <Text style={styles.nextText}>다음 →</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  hint: {
    fontSize: 14,
    color: COLORS.subtext,
    marginBottom: 12,
    textAlign: 'center',
  },
  nextBtn: {
    marginTop: 16,
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  nextText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
