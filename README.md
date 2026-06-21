# 감정 두들 다이어리 🎨

매일의 감정을 **간단한 두들(낙서) 그림 + 한두 문장**으로 남기는 다이어리 앱입니다. (Expo / React Native)

## 기능

- **기록하기**: ① 두들 그리기 화면(자유 그리기 + 감정별 색상 팔레트, 브러시 굵기, 되돌리기/전체삭제) → ② 한 줄 기록 화면
- **주간 보기**: 한 주(일~토)의 두들과 한 줄 기록을 한 페이지에 모아서 확인 (이전/다음 주 이동)
- **먼슬리**: 캘린더의 각 날짜 칸에 그날의 두들 썸네일이 표시됨 (날짜를 누르면 상세)
- 모든 데이터는 **기기 로컬**에 저장됩니다 (인터넷/계정 불필요)

## 실행 방법

```bash
npm install          # 최초 1회
npx expo start       # 개발 서버 시작
```

- iOS 시뮬레이터에서 실행: 터미널에서 `i`
- Android 에뮬레이터에서 실행: `a`
- 실제 기기: Expo Go 앱(또는 dev build)으로 QR 코드 스캔

> 두들 그리기에 `@shopify/react-native-skia`를 사용합니다. 대부분 Expo Go에서 동작하지만,
> 네이티브 모듈 이슈가 있으면 `npx expo run:ios` / `npx expo run:android`로 dev build를 사용하세요.

## 구조

```
app/
  _layout.tsx     루트 스택 + GestureHandlerRootView
  index.tsx       홈 (오늘 기록 / 주간 / 먼슬리 진입)
  draw.tsx        ① 두들 그리기 화면
  write.tsx       ② 한 줄 기록 화면
  weekly.tsx      주간 보기
  monthly.tsx     먼슬리 캘린더
components/
  DoodleCanvas.tsx    Skia 기반 그리기 캔버스 (팔레트/굵기/undo/clear/PNG export)
  DoodleThumbnail.tsx 저장된 두들 썸네일
lib/
  theme.ts    색상 팔레트/테마
  dates.ts    주·월 날짜 계산 (date-fns)
  files.ts    두들 PNG 파일 저장 (expo-file-system)
  storage.ts  기록 메타데이터 저장/조회 (AsyncStorage)
  draft.ts    draw → write 화면 간 두들 임시 전달
```

## 데이터 모델

- 하루 1개 기록 (같은 날 다시 그리면 덮어쓰기)
- 두들 이미지: `documentDirectory/doodles/{YYYY-MM-DD}.png`
- 메타: AsyncStorage 키 `entry:{YYYY-MM-DD}` → `{ date, doodleUri, text, color, updatedAt }`
