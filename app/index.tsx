import { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Image,
  Dimensions,
  type LayoutChangeEvent,
} from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth';
import { listEntries, updateEntryPosition, MAX_PER_DAY, type Entry } from '../lib/storage';
import { todayKey, dayLabel, weekDays, weekRangeLabel } from '../lib/dates';
import { COLORS } from '../lib/theme';

// 데스크톱(웹)에서 과도하게 넓어지지 않게 콘텐츠 폭 상한
const CONTENT_W = Math.min(Dimensions.get('window').width, 480);
// 위클리 프레임 안에서 쓸 수 있는 가로폭 (바깥 16 + 프레임 14 패딩 양쪽)
const FRAME_W = CONTENT_W - 16 * 2 - 14 * 2;
// 두들 한 개의 최대 표시 높이 (스티커 느낌으로 작게)
const MAX_DOODLE_H = 150;

// 문자열 키로 일관된(매 렌더 동일) 변형값 생성
function collageVariant(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const widthRatios = [0.34, 0.28, 0.4, 0.3, 0.36, 0.32];
  const rotations = ['-9deg', '7deg', '-5deg', '11deg', '-7deg', '4deg', '-12deg', '8deg'];
  // 부호 없는 시프트(>>>) 사용 — >> 는 큰 해시에서 음수가 되어 배열[음수]=undefined 크래시
  return {
    widthRatio: widthRatios[h % widthRatios.length],
    jitter: (((h >>> 9) % 11) - 5) / 100, // -0.05 ~ 0.05 가로 미세 흔들림
    rotate: rotations[(h >>> 5) % rotations.length],
    dropDelay: (h >>> 11) % 5,
  };
}

// 순서별 가로 레인 — 가운데/왼쪽/오른쪽 골고루 분배 (한쪽 몰림 방지)
const X_LANES = [0.5, 0.12, 0.86, 0.32, 0.68, 0.04, 0.95, 0.45, 0.22, 0.75];

// 끌어서 옮길 수 있는 한 개의 두들 (위치는 영역 대비 0~1 비율로 저장)
function DraggableDoodle({
  entry,
  index,
  areaW,
  areaH,
  width,
  height,
}: {
  entry: Entry;
  index: number;
  areaW: number;
  areaH: number;
  width: number;
  height: number;
}) {
  const v = collageVariant(entry.id);
  const availW = Math.max(1, areaW - width);
  const availH = Math.max(1, areaH - height);

  // 저장값 없으면 기본 위치: 가로 레인 + 세로 스태거
  const laneFrac = Math.min(1, Math.max(0, X_LANES[index % X_LANES.length] + v.jitter));
  const defX = laneFrac * availW;
  const defY = Math.min(availH, index * (height * 0.7));
  const initX = entry.posX != null ? Math.min(availW, Math.max(0, entry.posX * availW)) : defX;
  const initY = entry.posY != null ? Math.min(availH, Math.max(0, entry.posY * availH)) : defY;

  const tx = useSharedValue(initX);
  const ty = useSharedValue(initY);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  // 데이터/영역 변경 시 위치 동기화
  useEffect(() => {
    tx.value = initX;
    ty.value = initY;
  }, [initX, initY, tx, ty]);

  const persist = useCallback(
    (fx: number, fy: number) => {
      updateEntryPosition(entry.id, fx, fy).catch(() => {});
    },
    [entry.id]
  );

  const pan = Gesture.Pan()
    .onStart(() => {
      startX.value = tx.value;
      startY.value = ty.value;
    })
    .onUpdate((e) => {
      tx.value = Math.min(availW, Math.max(0, startX.value + e.translationX));
      ty.value = Math.min(availH, Math.max(0, startY.value + e.translationY));
    })
    .onEnd(() => {
      runOnJS(persist)(tx.value / availW, ty.value / availH);
    });

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Reanimated.View style={[{ position: 'absolute', left: 0, top: 0, width, alignItems: 'center' }, aStyle]}>
        {!!entry.text && (
          <View style={styles.bubbleWrap}>
            <View style={styles.bubble}>
              <Text style={styles.bubbleText}>{entry.text}</Text>
            </View>
            <View style={styles.bubbleTail} />
          </View>
        )}
        <View style={{ transform: [{ rotate: v.rotate }] }}>
          <Image source={{ uri: entry.doodleUri }} style={{ width, height }} resizeMode="contain" />
        </View>
      </Reanimated.View>
    </GestureDetector>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const [stacked, setStacked] = useState<Entry[]>([]);
  const [area, setArea] = useState({ w: 0, h: 0 });

  const onAreaLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArea({ w: width, h: height });
  };

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

        <View style={styles.pileArea} onLayout={onAreaLayout}>
          {stacked.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🎨</Text>
              <Text style={styles.emptyTitle}>이번 주 첫 감정을 남겨보세요</Text>
              <Text style={styles.emptySub}>두들을 끌어서 자유롭게 배치할 수 있어요</Text>
            </View>
          ) : (
            area.w > 0 &&
            stacked.map((entry, i) => {
              const v = collageVariant(entry.id);
              const ratio = entry.width && entry.height ? entry.height / entry.width : 1;
              let w = area.w * v.widthRatio;
              let h = w * ratio;
              if (h > MAX_DOODLE_H) {
                h = MAX_DOODLE_H;
                w = h / ratio;
              }
              return (
                <DraggableDoodle
                  key={entry.id}
                  entry={entry}
                  index={i}
                  areaW={area.w}
                  areaH={area.h}
                  width={w}
                  height={h}
                />
              );
            })
          )}
        </View>
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
  // 두들을 끌어서 배치하는 영역
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
