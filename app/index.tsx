import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Image,
  type LayoutChangeEvent,
} from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth';
import { listEntries, updateEntryPosition, MAX_PER_DAY, type Entry } from '../lib/storage';
import { todayKey, dayLabel, weekDays, weekRangeLabel } from '../lib/dates';
import { COLORS } from '../lib/theme';

// 두들 한 개의 최대 표시 크기 (스티커 느낌으로 작게)
const MAX_DOODLE_H = 140;
const MAX_DOODLE_W = 130;

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

const GAP = 8; // 스티커 사이 최소 간격

type Rect = { x: number; y: number; w: number; h: number };

function overlaps(x: number, y: number, w: number, h: number, o: Rect): boolean {
  return (
    x < o.x + o.w + GAP &&
    x + w + GAP > o.x &&
    y < o.y + o.h + GAP &&
    y + h + GAP > o.y
  );
}

// 원하는 위치에 두되, 다른 스티커와 겹치면 가장 가까운 빈 자리로
function findFreeSpot(
  desiredX: number,
  desiredY: number,
  w: number,
  h: number,
  others: Rect[],
  areaW: number,
  areaH: number
): { x: number; y: number } {
  const maxX = Math.max(0, areaW - w);
  const maxY = Math.max(0, areaH - h);
  const cx = Math.min(maxX, Math.max(0, desiredX));
  const cy = Math.min(maxY, Math.max(0, desiredY));
  if (!others.some((o) => overlaps(cx, cy, w, h, o))) return { x: cx, y: cy };

  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  const step = 10;
  for (let y = 0; y <= maxY; y += step) {
    for (let x = 0; x <= maxX; x += step) {
      if (others.some((o) => overlaps(x, y, w, h, o))) continue;
      const d = (x - cx) ** 2 + (y - cy) ** 2;
      if (d < bestD) {
        bestD = d;
        best = { x, y };
      }
    }
  }
  return best ?? { x: cx, y: cy };
}

// 두들 크기 계산 (화면 크기와 무관하게 작게: 가로/세로 상한)
function doodleSize(entry: Entry, areaW: number) {
  const v = collageVariant(entry.id);
  const ratio = entry.width && entry.height ? entry.height / entry.width : 1;
  let w = Math.min(areaW * v.widthRatio, MAX_DOODLE_W);
  let h = w * ratio;
  if (h > MAX_DOODLE_H) {
    h = MAX_DOODLE_H;
    w = h / ratio;
  }
  return { w, h };
}

// 모든 스티커를 겹치지 않게 배치 (저장 위치/기본 위치 → 충돌 해소)
function packLayout(
  entries: Entry[],
  area: { w: number; h: number },
  override: Record<string, { fx: number; fy: number }>,
  lastMovedId: string | null
): Record<string, Rect> {
  const res: Record<string, Rect> = {};
  if (!area.w || !area.h) return res;

  // 방금 옮긴 스티커는 마지막에 배치 → 다른 스티커를 밀어내지 않음
  const order = entries
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (a.e.id === lastMovedId ? 1 : 0) - (b.e.id === lastMovedId ? 1 : 0));

  const placed: Rect[] = [];
  for (const { e, i } of order) {
    const { w, h } = doodleSize(e, area.w);
    const availW = Math.max(1, area.w - w);
    const availH = Math.max(1, area.h - h);
    const ov = override[e.id];
    const fx = ov ? ov.fx : e.posX;
    const fy = ov ? ov.fy : e.posY;
    let dx: number;
    let dy: number;
    if (fx != null && fy != null) {
      dx = fx * availW;
      dy = fy * availH;
    } else {
      const v = collageVariant(e.id);
      const lane = Math.min(1, Math.max(0, X_LANES[i % X_LANES.length] + v.jitter));
      dx = lane * availW;
      dy = Math.min(availH, i * (h * 0.7));
    }
    const spot = findFreeSpot(dx, dy, w, h, placed, area.w, area.h);
    const rect = { x: spot.x, y: spot.y, w, h };
    placed.push(rect);
    res[e.id] = rect;
  }
  return res;
}

// 끌어서 옮길 수 있는 한 개의 두들 (위치/충돌은 부모가 관리)
function DraggableDoodle({
  entry,
  rect,
  areaW,
  areaH,
  onDrop,
}: {
  entry: Entry;
  rect: Rect;
  areaW: number;
  areaH: number;
  onDrop: (id: string, px: number, py: number) => void;
}) {
  const v = collageVariant(entry.id);
  const { x, y, w: width, h: height } = rect;
  const maxX = Math.max(0, areaW - width);
  const maxY = Math.max(0, areaH - height);

  const tx = useSharedValue(x);
  const ty = useSharedValue(y);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  // 부모가 위치를 재배치(드롭/리사이즈)하면 그 자리로 부드럽게 이동
  useEffect(() => {
    tx.value = withSpring(x, { damping: 16, stiffness: 140 });
    ty.value = withSpring(y, { damping: 16, stiffness: 140 });
  }, [x, y, tx, ty]);

  const report = useCallback(
    (px: number, py: number) => {
      onDrop(entry.id, px, py);
    },
    [entry.id, onDrop]
  );

  const pan = Gesture.Pan()
    .onStart(() => {
      startX.value = tx.value;
      startY.value = ty.value;
    })
    .onUpdate((e) => {
      tx.value = Math.min(maxX, Math.max(0, startX.value + e.translationX));
      ty.value = Math.min(maxY, Math.max(0, startY.value + e.translationY));
    })
    .onEnd(() => {
      runOnJS(report)(tx.value, ty.value);
    });

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Reanimated.View
        style={[{ position: 'absolute', left: 0, top: 0, width, alignItems: 'center' }, aStyle]}
      >
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
  // 드래그로 바뀐 위치(영역 대비 0~1) + 마지막으로 옮긴 스티커
  const [override, setOverride] = useState<Record<string, { fx: number; fy: number }>>({});
  const [lastMovedId, setLastMovedId] = useState<string | null>(null);

  const onAreaLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArea({ w: width, h: height });
  };

  // 화면 포커스마다 이번 주 기록 갱신 (하루 여러 개 포함, 최신순)
  useFocusEffect(
    useCallback(() => {
      let active = true;
      listEntries(weekDays(new Date()))
        .then((list) => {
          if (active) {
            setStacked(list);
            setOverride({}); // 새로 불러오면 저장된 위치 기준으로 재배치
          }
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }, [])
  );

  // 겹치지 않게 배치된 좌표 (저장 위치/기본 위치 → 충돌 해소)
  const layout = useMemo(
    () => packLayout(stacked, area, override, lastMovedId),
    [stacked, area, override, lastMovedId]
  );

  // 드롭: 놓은 위치를 다른 스티커와 안 겹치는 가장 가까운 자리로 보정 후 저장
  const handleDrop = useCallback(
    (id: string, px: number, py: number) => {
      const self = layout[id];
      if (!self) return;
      const others = Object.entries(layout)
        .filter(([oid]) => oid !== id)
        .map(([, r]) => r);
      const spot = findFreeSpot(px, py, self.w, self.h, others, area.w, area.h);
      const availW = Math.max(1, area.w - self.w);
      const availH = Math.max(1, area.h - self.h);
      const fx = spot.x / availW;
      const fy = spot.y / availH;
      setOverride((o) => ({ ...o, [id]: { fx, fy } }));
      setLastMovedId(id);
      updateEntryPosition(id, fx, fy).catch(() => {});
    },
    [layout, area.w, area.h]
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
            stacked.map((entry) => {
              const rect = layout[entry.id];
              if (!rect) return null;
              return (
                <DraggableDoodle
                  key={entry.id}
                  entry={entry}
                  rect={rect}
                  areaW={area.w}
                  areaH={area.h}
                  onDrop={handleDrop}
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
