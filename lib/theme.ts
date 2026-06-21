// 감정별 색상 팔레트 (두들 그리기 + 캘린더 강조에 사용)
export const EMOTION_COLORS: { color: string; label: string }[] = [
  { color: '#FF6B6B', label: '화남' },
  { color: '#FFA94D', label: '들뜸' },
  { color: '#FFD43B', label: '기쁨' },
  { color: '#69DB7C', label: '평온' },
  { color: '#4DABF7', label: '차분' },
  { color: '#748FFC', label: '우울' },
  { color: '#DA77F2', label: '설렘' },
  { color: '#343A40', label: '먹먹' },
];

export const PALETTE = EMOTION_COLORS.map((c) => c.color);

export const BRUSH_SIZES = [3, 6, 12, 20];

export const COLORS = {
  bg: '#FBFAF7',
  card: '#FFFFFF',
  border: '#E9E6DF',
  text: '#2B2926',
  subtext: '#8A857C',
  accent: '#5C7CFA',
  canvas: '#FFFFFF',
};
