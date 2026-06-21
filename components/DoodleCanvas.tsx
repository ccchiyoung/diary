import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  Text,
  Platform,
  LayoutChangeEvent,
} from 'react-native';
import {
  Canvas,
  Path,
  Skia,
  useCanvasRef,
  type SkPath,
} from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { PALETTE, BRUSH_SIZES, COLORS } from '../lib/theme';

type Stroke = { path: SkPath; color: string; width: number };

export type DoodleCanvasHandle = {
  // 현재 그림을 PNG base64로 추출 (빈 그림이면 null). 배경은 투명.
  exportBase64: () => string | null;
  getColor: () => string;
  // 캔버스(=그림) 크기. 표시 시 비율 계산에 사용.
  getSize: () => { width: number; height: number };
  isEmpty: () => boolean;
};

const DoodleCanvas = forwardRef<DoodleCanvasHandle>((_props, ref) => {
  const canvasRef = useCanvasRef();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [color, setColor] = useState(PALETTE[7]); // 기본: 먹먹(검정 계열)
  const [width, setWidth] = useState(BRUSH_SIZES[1]);

  // 현재 그리고 있는 선 (ref + tick으로 라이브 렌더)
  const currentRef = useRef<SkPath | null>(null);
  const [, force] = useState(0);
  const rerender = () => force((t) => t + 1);

  // 마지막 export 시 잘라낸 그림 영역 크기 (getSize 에서 사용)
  const lastSizeRef = useRef({ width: 0, height: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setSize({ width: w, height: h });
  };

  // 손가락 그리기는 JS 스레드에서 직접 처리 (runOnJS)
  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onStart((e) => {
      const p = Skia.Path.Make();
      p.moveTo(e.x, e.y);
      currentRef.current = p;
      rerender();
    })
    .onUpdate((e) => {
      currentRef.current?.lineTo(e.x, e.y);
      rerender();
    })
    .onEnd(() => {
      if (currentRef.current) {
        const finished = currentRef.current;
        setStrokes((prev) => [...prev, { path: finished, color, width }]);
        currentRef.current = null;
        rerender();
      }
    });

  const undo = () => {
    setStrokes((prev) => prev.slice(0, -1));
  };
  const clear = () => {
    setStrokes([]);
    currentRef.current = null;
    rerender();
  };

  useImperativeHandle(ref, () => ({
    exportBase64: () => {
      const all = [...strokes];
      if (currentRef.current) all.push({ path: currentRef.current, color, width });
      if (all.length === 0) return null;

      // 모든 선의 합집합 바운딩 박스 계산 (선 굵기 + 여백 포함) → 그림만 잘라 저장
      let l = Infinity,
        t = Infinity,
        r = -Infinity,
        b = -Infinity;
      for (const s of all) {
        const bb = s.path.getBounds(); // { x, y, width, height }
        const pad = s.width / 2 + 6;
        l = Math.min(l, bb.x - pad);
        t = Math.min(t, bb.y - pad);
        r = Math.max(r, bb.x + bb.width + pad);
        b = Math.max(b, bb.y + bb.height + pad);
      }
      // 캔버스 범위로 클램프
      l = Math.max(0, l);
      t = Math.max(0, t);
      r = Math.min(size.width || r, r);
      b = Math.min(size.height || b, b);
      const cw = Math.max(1, r - l);
      const ch = Math.max(1, b - t);

      // 웹의 Skia 캔버스는 devicePixelRatio 로 스케일됨 → 캡처 영역도 그만큼 보정.
      // 네이티브는 논리 좌표 그대로 동작하므로 1.
      const pr =
        Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.devicePixelRatio || 1
          : 1;

      const rect = Skia.XYWHRect(l * pr, t * pr, cw * pr, ch * pr);
      const image = canvasRef.current?.makeImageSnapshot(rect);
      if (!image) return null;
      lastSizeRef.current = { width: cw, height: ch };
      return image.encodeToBase64();
    },
    getColor: () => color,
    getSize: () =>
      lastSizeRef.current.width > 0 ? lastSizeRef.current : size,
    isEmpty: () => strokes.length === 0 && !currentRef.current,
  }));

  return (
    <View style={styles.wrap}>
      <View style={styles.canvasBox} onLayout={onLayout}>
        <GestureDetector gesture={pan}>
          {/* 배경 Rect 없이 그려서 PNG가 투명 배경으로 저장됨 (그림만 추출) */}
          <Canvas ref={canvasRef} style={styles.canvas}>
            {strokes.map((s, i) => (
              <Path
                key={i}
                path={s.path}
                color={s.color}
                style="stroke"
                strokeWidth={s.width}
                strokeJoin="round"
                strokeCap="round"
              />
            ))}
            {currentRef.current && (
              <Path
                path={currentRef.current}
                color={color}
                style="stroke"
                strokeWidth={width}
                strokeJoin="round"
                strokeCap="round"
              />
            )}
          </Canvas>
        </GestureDetector>
      </View>

      {/* 색상 팔레트 */}
      <View style={styles.paletteRow}>
        {PALETTE.map((c) => (
          <Pressable
            key={c}
            onPress={() => setColor(c)}
            style={[
              styles.swatch,
              { backgroundColor: c },
              color === c && styles.swatchActive,
            ]}
          />
        ))}
      </View>

      {/* 브러시 굵기 + 도구 */}
      <View style={styles.toolRow}>
        <View style={styles.brushGroup}>
          {BRUSH_SIZES.map((s) => (
            <Pressable
              key={s}
              onPress={() => setWidth(s)}
              style={[styles.brushBtn, width === s && styles.brushBtnActive]}
            >
              <View
                style={{
                  width: s + 4,
                  height: s + 4,
                  borderRadius: (s + 4) / 2,
                  backgroundColor: COLORS.text,
                }}
              />
            </Pressable>
          ))}
        </View>
        <View style={styles.actionGroup}>
          <Pressable onPress={undo} style={styles.actionBtn}>
            <Text style={styles.actionText}>되돌리기</Text>
          </Pressable>
          <Pressable onPress={clear} style={styles.actionBtn}>
            <Text style={styles.actionText}>전체삭제</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
});

DoodleCanvas.displayName = 'DoodleCanvas';
export default DoodleCanvas;

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  canvasBox: {
    flex: 1,
    backgroundColor: COLORS.canvas,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  canvas: { flex: 1 },
  paletteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
  },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchActive: {
    borderColor: COLORS.text,
    transform: [{ scale: 1.12 }],
  },
  toolRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  brushGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brushBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  brushBtnActive: { borderColor: COLORS.accent, borderWidth: 2 },
  actionGroup: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionText: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
});
