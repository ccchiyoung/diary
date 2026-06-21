// draw 화면 -> write 화면으로 두들 데이터를 넘기기 위한 in-memory 임시 저장소.
// (base64 PNG는 URL 파라미터로 넘기기엔 너무 크기 때문에 메모리에 잠시 보관)
type Draft = {
  base64: string;
  color: string;
  width: number;
  height: number;
};

let current: Draft | null = null;

export function setDraft(d: Draft): void {
  current = d;
}

export function getDraft(): Draft | null {
  return current;
}

export function clearDraft(): void {
  current = null;
}
