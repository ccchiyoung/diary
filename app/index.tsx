import { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Image,
  ScrollView,
  Dimensions,
  Animated,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth';
import { listEntries, MAX_PER_DAY, type Entry } from '../lib/storage';
import { todayKey, dayLabel, weekDays, weekRangeLabel } from '../lib/dates';
import { COLORS } from '../lib/theme';

// 데스크톱(웹)에서 과도하게 넓어지지 않게 콘텐츠 폭 상한
const CONTENT_W = Math.min(Dimensions.get('window').width, 480);
// 위클리 프레임 안에서 쓸 수 있는 가로폭 (바깥 16 + 프레임 14 패딩 양쪽)
const FRAME_W = CONTENT_W - 16 * 2 - 14 * 2;
// 두들 한 개의 최대 표시 높이 (세로로 긴 그림이 폭발하지 않게)
const MAX_DOODLE_H = 240;

// 문자열 키로 일관된(매 렌더 동일) 변형값 생성
function collageVariant(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const widthRatios = [0.78, 0.66, 0.72, 0.6, 0.7];
  // 가로 위치(-1=왼쪽 ~ 1=오른쪽) — 바닥 더미가 좌우로 자연스럽게 퍼지도록
  const xBias = [0, -0.55, 0.5, -0.3, 0.35, -0.6, 0.6];
  const rotations = ['-5deg', '4deg', '-3deg', '6deg', '0deg', '-7deg', '3deg'];
  return {
    widthRatio: widthRatios[h % widthRatios.length],
    xBias: xBias[(h >> 3) % xBias.length],
    rotate: rotations[(h >> 5) % rotations.length],
  };
}

// 위에서 떨어져 바닥에 쌓이는 한 개의 두들
function FallingDoodle({
  entry,
  index,
  width,
  height,
}: {
  entry: Entry;
  index: number;
  width: number;
  height: number;
}) {
  const v = collageVariant(entry.id);
  const drop = useRef(new Animated.Value(1)).current; // 1=위, 0=착지
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(drop, {
        toValue: 0,
        delay: index * 110,
        friction: 6,
        tension: 70,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        delay: index * 110,
        useNativeDriver: true,
      }),
    ]).start();
  }, [drop, opacity, index]);

  // 바닥 더미에서 좌우로 흩어질 여유 폭
  const freeX = Math.max(0, FRAME_W - width);
  const offsetX = (v.xBias * freeX) / 2;
  const translateY = drop.interpolate({ inputRange: [0, 1], outputRange: [0, -260] });

  return (
    <Animated.View
      style={[
        styles.pileItem,
        {
          marginTop: index === 0 ? 0 : -28, // 살짝 겹쳐 쌓임
          opacity,
          transform: [{ translateX: offsetX }, { translateY }, { rotate: v.rotate }],
        },
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
      <Image source={{ uri: entry.doodleUri }} style={{ width, height }} resizeMode="contain" />
    </Animated.View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const [stacked, setStacked] = useState<Entry[]>([]);

  // 화면 포커스마다 이번 주 기록 갱신 (하루 여러 개 포함, 최신순)
  useFocusEffect(
    useCallback(() => {
      let active = true;
      listEntries(weekDays(new Date()))
        .then((list) => active && setStacked(list))
        .catch(() => {});
      return () => {
        active = false;
      };
    }, [])
  );

  const todayCount = stacked.filter((e) => e.date === todayKey()).length;
  const full = todayCount >= MAX_PER_DAY;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.date}>{dayLabel(todayKey())}</Text>
          <Pressable onPress={signOut} hitSlop={8}>
            <Text style={styles.logout}>로그아웃</Text>
          </Pressable>
        </View>
        <Pressable
          style={[styles.primaryBtn, full && styles.primaryBtnDisabled]}
          onPress={() => router.push('/draw')}
          disabled={full}
        >
          <Text style={styles.primaryText}>
            {full
              ? `오늘 기록 완료 (${todayCount}/${MAX_PER_DAY})`
              : `오늘 감정 기록하기 (${todayCount}/${MAX_PER_DAY})`}
          </Text>
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
              const v = collageVariant(entry.id);
              const ratio = entry.width && entry.height ? entry.height / entry.width : 1;
              let w = FRAME_W * v.widthRatio;
              let h = w * ratio;
              if (h > MAX_DOODLE_H) {
                h = MAX_DOODLE_H;
                w = h / ratio;
              }
              return (
                <FallingDoodle key={entry.id} entry={entry} index={i} width={w} height={h} />
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
  primaryBtnDisabled: { backgroundColor: '#B9C2E8' },
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
  weeklyScrollContent: { flexGrow: 1, justifyContent: 'flex-end', paddingTop: 8, paddingBottom: 4 },
  pileItem: { width: '100%', alignItems: 'center' },

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
