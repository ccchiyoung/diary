import { useCallback, useState } from 'react';
import { StyleSheet, View, Text, Image, Pressable, ScrollView } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listEntriesByDate, type Entry } from '../lib/storage';
import { monthDays, todayKey, dayLabel } from '../lib/dates';
import { COLORS } from '../lib/theme';

// 캘린더 한글화
LocaleConfig.locales.ko = {
  monthNames: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
  monthNamesShort: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
  dayNames: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'],
  dayNamesShort: ['일', '월', '화', '수', '목', '금', '토'],
  today: '오늘',
};
LocaleConfig.defaultLocale = 'ko';

export default function MonthlyScreen() {
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(new Date());
  const [byDate, setByDate] = useState<Record<string, Entry[]>>({});
  const [selected, setSelected] = useState<Entry[] | null>(null);

  const loadFor = useCallback((ref: Date) => {
    listEntriesByDate(monthDays(ref)).then(setByDate).catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFor(month);
    }, [month, loadFor])
  );

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
      <Calendar
        current={todayKey()}
        onMonthChange={(m) => {
          const ref = new Date(m.year, m.month - 1, 1);
          setMonth(ref);
          loadFor(ref);
        }}
        hideExtraDays
        theme={{
          calendarBackground: COLORS.bg,
          textSectionTitleColor: COLORS.subtext,
          monthTextColor: COLORS.text,
          arrowColor: COLORS.accent,
          textMonthFontWeight: '700',
        }}
        // 각 날짜 칸에 대표 두들 + 개수 표시
        dayComponent={({ date, state }: any) => {
          const dayEntries = date ? byDate[date.dateString] ?? [] : [];
          const rep = dayEntries[0]; // 최신 기록 (목록은 최신순)
          const isToday = date?.dateString === todayKey();
          return (
            <Pressable
              style={styles.cell}
              onPress={() => dayEntries.length && setSelected(dayEntries)}
              disabled={!dayEntries.length}
            >
              <Text
                style={[
                  styles.cellDay,
                  state === 'disabled' && styles.cellDisabled,
                  isToday && styles.cellToday,
                ]}
              >
                {date?.day}
              </Text>
              <View
                style={[
                  styles.cellThumb,
                  rep ? { borderColor: rep.color } : styles.cellThumbEmpty,
                ]}
              >
                {rep ? (
                  <Image source={{ uri: rep.doodleUri }} style={styles.cellImg} resizeMode="cover" />
                ) : null}
                {dayEntries.length > 1 && (
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{dayEntries.length}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        }}
      />

      {selected && selected.length > 0 ? (
        <View style={styles.detail}>
          <Text style={styles.detailDate}>
            {dayLabel(selected[0].date)} · {selected.length}개
          </Text>
          <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
            {selected.map((e) => (
              <View key={e.id} style={styles.detailRow}>
                <Image source={{ uri: e.doodleUri }} style={styles.detailThumb} resizeMode="contain" />
                <Text style={styles.detailText}>{e.text || '두들만 남긴 날'}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : (
        <Text style={styles.hint}>날짜를 누르면 그날의 기록을 볼 수 있어요.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 8 },
  cell: { alignItems: 'center', paddingVertical: 2, width: 44 },
  cellDay: { fontSize: 12, color: COLORS.text, marginBottom: 2 },
  cellDisabled: { color: '#CFCAC1' },
  cellToday: { color: COLORS.accent, fontWeight: '800' },
  cellThumb: {
    width: 34,
    height: 34,
    borderRadius: 9,
    borderWidth: 1.5,
    overflow: 'hidden',
    backgroundColor: COLORS.canvas,
  },
  cellThumbEmpty: { borderColor: COLORS.border, borderStyle: 'dashed' },
  cellImg: { width: '100%', height: '100%' },
  countBadge: {
    position: 'absolute',
    right: -4,
    top: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  countText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  detail: {
    marginTop: 12,
    marginHorizontal: 8,
    padding: 14,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  detailDate: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  detailThumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: COLORS.canvas,
  },
  detailText: { flex: 1, fontSize: 14, color: COLORS.text, lineHeight: 20 },
  hint: {
    textAlign: 'center',
    color: COLORS.subtext,
    fontSize: 13,
    marginTop: 24,
  },
});
