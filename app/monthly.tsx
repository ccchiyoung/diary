import { useCallback, useState } from 'react';
import { StyleSheet, View, Text, Image, Pressable } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getEntryMap, type Entry } from '../lib/storage';
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
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [selected, setSelected] = useState<Entry | null>(null);

  const loadFor = useCallback((ref: Date) => {
    getEntryMap(monthDays(ref)).then(setEntries).catch(() => {});
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
        markedDates={entries}
        hideExtraDays
        theme={{
          calendarBackground: COLORS.bg,
          textSectionTitleColor: COLORS.subtext,
          monthTextColor: COLORS.text,
          arrowColor: COLORS.accent,
          textMonthFontWeight: '700',
        }}
        // 각 날짜 칸에 두들 썸네일 렌더
        dayComponent={({ date, state }: any) => {
          const entry = date ? (entries[date.dateString] as Entry | undefined) : undefined;
          const isToday = date?.dateString === todayKey();
          return (
            <Pressable
              style={styles.cell}
              onPress={() => entry && setSelected(entry)}
              disabled={!entry}
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
                  entry ? { borderColor: entry.color } : styles.cellThumbEmpty,
                ]}
              >
                {entry ? (
                  <Image
                    source={{ uri: entry.doodleUri }}
                    style={styles.cellImg}
                    resizeMode="cover"
                  />
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />

      {selected ? (
        <View style={styles.detail}>
          <Image source={{ uri: selected.doodleUri }} style={styles.detailImg} resizeMode="contain" />
          <View style={styles.detailBody}>
            <Text style={styles.detailDate}>{dayLabel(selected.date)}</Text>
            <Text style={styles.detailText}>{selected.text || '두들만 남긴 날'}</Text>
          </View>
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
  detail: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 12,
    marginHorizontal: 8,
    padding: 14,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  detailImg: {
    width: 90,
    height: 90,
    borderRadius: 12,
    backgroundColor: COLORS.canvas,
  },
  detailBody: { flex: 1 },
  detailDate: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  detailText: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  hint: {
    textAlign: 'center',
    color: COLORS.subtext,
    fontSize: 13,
    marginTop: 24,
  },
});
