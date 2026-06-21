import { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Image,
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

// 문자열 키로 일관된(매 렌더 동일) 변형값 생성 — 바닥에 2D로 흩어진 더미
function collageVariant(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const widthRatios = [0.5, 0.42, 0.56, 0.46, 0.52, 0.48];
  // 가로 위치 0(왼쪽)~1(오른쪽) — 좌우로 넓게 흩어지게
  const xFracs = [0.04, 0.62, 0.28, 0.9, 0.16, 0.74, 0.46, 0.98, 0.36, 0.82];
  // 바닥에서 띄울 높이(px) — 어떤 건 바닥, 어떤 건 위에 얹힌 느낌
  const yPx = [0, 40, 96, 18, 64, 130, 8, 110, 52, 28];
  const rotations = ['-11deg', '8deg', '-6deg', '13deg', '-9deg', '4deg', '-14deg', '10deg'];
  return {
    widthRatio: widthRatios[h % widthRatios.length],
    xFrac: xFracs[(h >> 3) % xFracs.length],
    yPx: yPx[(h >> 7) % yPx.length],
    rotate: rotations[(h >> 5) % rotations.length],
    dropDelay: (h >> 11) % 5,
  };
}

// 위에서 떨어져 바닥에 흩어지는 한 개의 두들 (절대 위치)
function FallingDoodle({
  entry,
  index,
  total,
  width,
  height,
}: {
  entry: Entry;
  index: number;
  total: number;
  width: number;
  height: number;
}) {
  const v = collageVariant(entry.id);
  const drop = useRef(new Animated.Value(1)).current; // 1=위, 0=착지
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 오래된 것부터 떨어지고, 최신(index 0)이 마지막에 떨어져 맨 위에 얹힘
    const delay = (total - 1 - index) * 110 + v.dropDelay * 70;
    Animated.parallel([
      Animated.spring(drop, {
        toValue: 0,
        delay,
        friction: 6,
        tension: 70,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 160,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [drop, opacity, index, total, v.dropDelay]);

  const left = v.xFrac * Math.max(0, FRAME_W - width);
  const translateY = drop.interpolate({ inputRange: [0, 1], outputRange: [0, -360] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left,
        bottom: v.yPx,
        zIndex: total - index, // 최신이 위로 겹치게
        opacity,
        alignItems: 'center',
        transform: [{ translateY }, { rotate: v.rotate }],
      }}
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
          <View style={styles.pileArea}>
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
                <FallingDoodle
                  key={entry.id}
                  entry={entry}
                  index={i}
                  total={stacked.length}
                  width={w}
                  height={h}
                />
              );
            })}
          </View>
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
  // 두들이 절대 위치로 흩어지는 바닥 영역
  pileArea: { flex: 1, position: 'relative' },

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
