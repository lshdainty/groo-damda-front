import {
  formatDateRange,
  formatYearMonth,
  formatYear,
  formatYearQuarter,
} from "@/shared/lib/date";

export type TabKey = "cat" | "trend" | "compare" | "fixed";
export type SegMode = "m" | "q" | "y" | "custom";
export type RangeState = { from: Date; to: Date; segMode: SegMode };

export const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const monthRangeOf = (now: Date): RangeState => ({
  from: new Date(now.getFullYear(), now.getMonth(), 1),
  to: new Date(now.getFullYear(), now.getMonth() + 1, 0),
  segMode: "m",
});
export const quarterRangeOf = (now: Date): RangeState => {
  const q = Math.floor(now.getMonth() / 3);
  return {
    from: new Date(now.getFullYear(), q * 3, 1),
    to: new Date(now.getFullYear(), q * 3 + 3, 0),
    segMode: "q",
  };
};
export const yearRangeOf = (now: Date): RangeState => ({
  from: new Date(now.getFullYear(), 0, 1),
  to: new Date(now.getFullYear(), 11, 31),
  segMode: "y",
});

const sameDayAs = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * 달력에서 고른 기간이 어떤 보기인가 — 지금 기간 그대로면 보기를 지키고, 바뀌었으면 한 달 · 한 분기 · 한 해를
 * 정확히 채운 기간은 그 보기(월 · 분기 · 년)로, 나머지는 직접(custom)으로 센다.
 * (옛 시트의 월 · 분기 · 년 탭이 하던 일 — 전월 비교 · 일 평균 · 기간 이름이 이 값을 따른다)
 */
export const rangeSegModeOf = (
  from: Date,
  to: Date,
  current: RangeState,
): SegMode => {
  if (sameDayAs(from, current.from) && sameDayAs(to, current.to))
    return current.segMode;
  const spans = (r: RangeState) =>
    sameDayAs(from, r.from) && sameDayAs(to, r.to);
  if (spans(monthRangeOf(from))) return "m";
  if (spans(quarterRangeOf(from))) return "q";
  if (spans(yearRangeOf(from))) return "y";
  return "custom";
};

export const previousRange = ({
  from,
  to,
  segMode,
}: RangeState): { from: Date; to: Date } => {
  if (segMode === "m") {
    return {
      from: new Date(from.getFullYear(), from.getMonth() - 1, 1),
      to: new Date(from.getFullYear(), from.getMonth(), 0),
    };
  }
  if (segMode === "q") {
    return {
      from: new Date(from.getFullYear(), from.getMonth() - 3, 1),
      to: new Date(from.getFullYear(), from.getMonth(), 0),
    };
  }
  if (segMode === "y") {
    return {
      from: new Date(from.getFullYear() - 1, 0, 1),
      to: new Date(from.getFullYear() - 1, 11, 31),
    };
  }
  // custom: 같은 길이 직전 윈도우
  const days =
    Math.round(
      (startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000,
    ) + 1;
  const t = new Date(from);
  t.setDate(t.getDate() - 1);
  const f = new Date(t);
  f.setDate(f.getDate() - days + 1);
  return { from: f, to: t };
};

export const periodLabel = ({ from, to, segMode }: RangeState): string => {
  if (segMode === "m") return formatYearMonth(from);
  if (segMode === "q") return formatYearQuarter(from);
  if (segMode === "y") return formatYear(from);
  // 기간 줄 — "11월 2일~11월 8일", 다른 해가 끼면 두 끝 모두 연도(날짜 규칙)
  return formatDateRange(from, to);
};

/**
 * 비교에 쓰는 이름 — 기간이 오늘을 품은 월 · 분기 · 해면 상대 말("이번 달 · 지난 달" 등 지금 글 그대로),
 * 오늘을 품지 않은 월 · 분기 · 해면 실제 이름("2026년 9월" · "2026년 8월" — periodLabel 그대로, 새 문구 없음).
 * 직접(custom)은 지금 그대로("선택 기간 / 이전 기간").
 */
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export const relativeNames = (
  period: RangeState,
  today: Date,
  t: (key: string) => string,
): { now: string; prev: string; nowInline: string; prevInline: string } => {
  const labels = labelsOf(period);
  const day = startOfDay(today).getTime();
  const holdsToday =
    startOfDay(period.from).getTime() <= day &&
    day <= startOfDay(period.to).getTime();
  if (period.segMode === "custom" || holdsToday) {
    const now = t(labels.now);
    const prev = t(labels.prev);
    // 상대 말은 문장 안에서 소문자("vs. last month") — ko 는 대소문자가 없어 그대로
    return {
      now,
      prev,
      nowInline: lowerFirst(now),
      prevInline: lowerFirst(prev),
    };
  }
  const now = periodLabel(period);
  const prev = periodLabel({
    ...previousRange(period),
    segMode: period.segMode,
  });
  // 실제 이름("Sep 2026")은 문장 안에서도 그대로
  return { now, prev, nowInline: now, prevInline: prev };
};

export const labelsOf = ({ segMode }: RangeState) =>
  segMode === "m"
    ? {
        now: "period.m.now",
        prev: "period.m.prev",
        avg: "period.m.avg",
      }
    : segMode === "q"
      ? {
          now: "period.q.now",
          prev: "period.q.prev",
          avg: "period.q.avg",
        }
      : segMode === "y"
        ? {
            now: "period.y.now",
            prev: "period.y.prev",
            avg: "period.y.avg",
          }
        : {
            now: "period.custom.now",
            prev: "period.custom.prev",
            avg: "period.custom.avg",
          };
