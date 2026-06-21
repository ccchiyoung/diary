import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  addMonths,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  isSameDay,
  parseISO,
} from 'date-fns';
import { ko } from 'date-fns/locale';

// 주 시작 요일: 일요일(0)
const WEEK_OPTS = { weekStartsOn: 0 as const };

// 로컬 날짜 키 (YYYY-MM-DD). 타임존 영향 없이 로컬 기준으로 포맷.
export function dateKey(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function todayKey(): string {
  return dateKey(new Date());
}

export function fromKey(key: string): Date {
  return parseISO(key);
}

// 한 주(일~토)의 7일 날짜 키 배열
export function weekDays(ref: Date): string[] {
  const start = startOfWeek(ref, WEEK_OPTS);
  const end = endOfWeek(ref, WEEK_OPTS);
  return eachDayOfInterval({ start, end }).map(dateKey);
}

export function weekRangeLabel(ref: Date): string {
  const start = startOfWeek(ref, WEEK_OPTS);
  const end = endOfWeek(ref, WEEK_OPTS);
  return `${format(start, 'M.d')} – ${format(end, 'M.d')}`;
}

export function shiftWeek(ref: Date, delta: number): Date {
  return addWeeks(ref, delta);
}

export function shiftMonth(ref: Date, delta: number): Date {
  return addMonths(ref, delta);
}

export function monthLabel(ref: Date): string {
  return format(ref, 'yyyy년 M월', { locale: ko });
}

// 해당 월의 첫째 날 ~ 마지막 날 키
export function monthRange(ref: Date): { start: string; end: string } {
  return {
    start: dateKey(startOfMonth(ref)),
    end: dateKey(endOfMonth(ref)),
  };
}

// 해당 월의 모든 날짜 키 배열
export function monthDays(ref: Date): string[] {
  return eachDayOfInterval({
    start: startOfMonth(ref),
    end: endOfMonth(ref),
  }).map(dateKey);
}

export function dayLabel(key: string): string {
  return format(fromKey(key), 'M월 d일 (EEE)', { locale: ko });
}

export function shortWeekday(key: string): string {
  return format(fromKey(key), 'EEE', { locale: ko });
}

export function isToday(key: string): boolean {
  return isSameDay(fromKey(key), new Date());
}
