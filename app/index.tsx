import { useCallback, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth';
import { getEntryMap, type Entry } from '../lib/storage';
import { todayKey, dayLabel, weekDays, weekRangeLabel } from '../lib/dates';
import { COLORS } from '../lib/theme';

const SCREEN_W = Dimensions.get('window').width;
// 위클리 프레임 안에서 쓸 수 있는 가로폭 (바깥 16 + 프레임 14 패딩 양쪽)
const FRAME_W = SCREEN_W - 16 * 2 - 14 * 2;

// 날짜 문자열로 일관된(매 렌더 동일) 변형값 생성 — 콜라주 느낌의 자연스러운 배치
function collageVariant(date: string) {
  let h = 0;
  for (let i = 0; i < date.length; i++) h = (h * 31 + date.charCodeAt(i)) >>> 0;
  const widthRatios = [0.95, 0.7, 0.82, 0.6, 0.75, 0.9];
  const aligns: ('flex-start' | 'center' | 'flex-end')[] = [
    'flex-start',
    'center',
    'flex-end',
    'center',
  ];
  const rotations = ['-4deg', '3deg', '-2deg', '5deg', '0deg', '-6deg', '2deg'];
  return {
    widthRatio: widthRatios[h % widthRatios.length],
    align: aligns[(h >> 3) % aligns.length],
    rotate: rotations[(h >> 5) % rotations.length],
  };
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const [entries, setEntries] = useState<Record<string, Entry>>({});

  // 화면 포커스마다 이번 주 기록 갱신
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getEntryMap(weekDays(new Date()))
        .then((m) => active && setEntries(m))
        .catch(() => {});
      return () => {
        active = false;
      };
    }, [])
  );

  // 이번 주 기록: 최신 → 과거 순으로 배열 (위가 최신, 맨 아래가 가장 오래된 것)
  // 프레임 안에서 아래쪽으로 정렬되어, 바닥부터 위로 쌓이는 느낌이 됨.
  const stacked = weekDays(new Date())
    .filter((k) => entries[k])
    .sort((a, b) => (a < b ? 1 : -1))
    .map((k) => entries[k]);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.date}>{dayLabel(todayKey())}</Text>
          <Pressable onPress={signOut} hitSlop={8}>
            <Text style={styles.logout}>로그아웃</Text>
          </Pressable>
        </View>
        <Pressable style={styles.primaryBtn} onPress={() => router.push('/draw')}>
          <Text style={styles.primaryText}>오늘 감정 기록하기</Text>
        </Pressable>
      </View>

      {/* 위클리 프레임 */}
      <View style={styles.weeklyFrame}>
        <View style={styles.weeklyHeader}>
          <Text style={styles.weeklyTitle}>위클리</Text>
          <Text style={styles.weeklyRange}>{weekRangeLabel(new Date())}</Text>
        </View>

        {stacked.length > 0 ? (
          <ScrollView
            style={styles.weeklyScroll}
            contentContainerStyle={styles.weeklyScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {stacked.map((entry, i) => {
              const v = collageVariant(entry.date);
              const w = FRAME_W * v.widthRatio;
              // 저장된 비율로 높이 계산 (이전 데이터 호환: 값 없으면 정사각)
              const ratio = entry.width && entry.height ? entry.height / entry.width : 1;
              return (
                <View
                  key={entry.date}
                  style={[
                    styles.doodleRow,
                    { alignItems: v.align, marginTop: i === 0 ? 0 : 14 },
                  ]}
                >
                  {!!entry.text && (
                    <View style={styles.bubbleWrap}>
                      <View style={styles.bubble}>
                        <Text style={styles.bubbleText}>{entry.text}</Text>
                      </View>
                      <View style={styles.bubbleTail} />
                    </View>
                  )}
                  <Image
                    source={{ uri: entry.doodleUri }}
                    style={{
                      width: w,
                      height: w * ratio,
                      transform: [{ rotate: v.rotate }],
                    }}
                    resizeMode="contain"
                  />
                </View>
              );
            })}
          </ScrollView>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🎨</Text>
            <Text style={styles.emptyTitle}>이번 주 첫 감정을 남겨보세요</Text>
            <Text style={styles.emptySub}>두들이 아래부터 차곡차곡 쌓여요</Text>
          </View>
        )}
      </View>

      {/* 하단 고정: 먼슬리 */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable style={styles.monthlyBtn} onPress={() => router.push('/monthly')}>
          <Text style={styles.monthlyEmoji}>🗓️</Text>
          <Text style={styles.monthlyText}>먼슬리로 보기</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 8 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  date: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  logout: { fontSize: 13, color: COLORS.subtext, fontWeight: '600' },
  primaryBtn: {
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  weeklyFrame: {
    flex: 1,
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    padding: 14,
    overflow: 'hidden',
  },
  weeklyHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  weeklyTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  weeklyRange: { fontSize: 12, color: COLORS.subtext, fontWeight: '600' },
  weeklyScroll: { flex: 1 },
  // 바닥 정렬 → 두들이 프레임 아래쪽부터 위로 쌓임
  weeklyScrollContent: { flexGrow: 1, justifyContent: 'flex-end', paddingTop: 8 },
  doodleRow: { width: '100%' },

  // 말풍선 (두들 위, 꼬리는 아래로)
  bubbleWrap: { maxWidth: '88%', marginBottom: 2, zIndex: 2 },
  bubble: {
    backgroundColor: '#EEF1FF',
    borderWidth: 1,
    borderColor: '#D7DEFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  bubbleText: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  bubbleTail: {
    width: 0,
    height: 0,
    marginLeft: 18,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#EEF1FF',
  },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginTop: 12 },
  emptySub: { fontSize: 13, color: COLORS.subtext, marginTop: 6 },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  monthlyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 16,
    borderRadius: 16,
  },
  monthlyEmoji: { fontSize: 20 },
  monthlyText: { fontSize: 16, fontWeight: '700', color: COLORS.text },
});
