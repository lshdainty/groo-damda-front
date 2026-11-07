import * as React from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ds/button";
import { ChipRadio, ChipRadioGroup } from "@/shared/ds/chip";
import { mergeRefs } from "@/shared/ds/overlay";
import { WheelPicker, WheelPickerColumn } from "@/shared/ds/wheel-picker";

import { DayCell, OutsideCell, type DayState } from "./date-picker-day";
import {
  datePickerLabels,
  addDays,
  addMonths,
  clampDay,
  compareDay,
  dayKey,
  fromMonthNumber,
  getPresetRange,
  monthAt,
  monthNumber,
  monthStart,
  pad2,
  sameDay,
  startOfDay,
  weekEnd,
  weekStart,
  weeksInMonth,
  type DatePickerLabels,
  type DatePresetName,
  type DateRange,
} from "./date-picker-dates";
import {
  CONTINUOUS_FOG,
  CONTINUOUS_MONTH,
  CONTINUOUS_MONTH_LABEL,
  CONTINUOUS_OVERSCAN,
  CONTINUOUS_SCROLL,
  CELL,
  CONTINUOUS_WEEKDAYS,
  type ContinuousMetrics,
  FOG,
  GRID,
  HEADER,
  LIVE,
  METRICS_100,
  MONTH_GAP,
  PROBE,
  MONTH_LABEL,
  NAV,
  NAV_END,
  NAV_PX,
  NAV_START,
  OUTSIDE,
  PRESETS,
  ROOT,
  ROOT_SIZE,
  TITLE,
  TITLE_ICON,
  TWO_MONTHS,
  TWO_MONTHS_HEADER,
  WEEK,
  WEEKDAY,
  WEEKDAY_ROW,
  WHEEL,
  WHEEL_MONTH,
  WHEEL_YEAR,
} from "./date-picker-variants";
import { useDsText } from "@/shared/ds/i18n";

/*
 * Groo Date Picker — 구조는 SEED Date Picker(2026-10-03). 수치 원본은 groo-design specs/components/date-picker.yaml(값은
 * src/shared/ds/spec/date-picker.json). groo-design recipes/shadcn/components/ui/date-picker.tsx 를 첫 판으로 가져왔다 —
 * 날짜 도구 · 글 · 빠른 기간 · 표기는 date-picker-dates.ts, 모양은 date-picker-variants.ts, 날짜 칸 하나는 date-picker-day.tsx.
 * 옛 Calendar(react-day-picker)를 대신한다.
 *
 *   DatePicker          달력 — selection(single · range · multiple) × visibleRange(month · twoMonths · continuous).
 *                       value · onValueChange 는 쓰는 쪽이 가진다(제어 — 시트 · 팝오버의 draft). min · max · isDateDisabled ·
 *                       readOnlyStart(range) · maxSelectionCount(multiple) · presets · presetsLayout(range) · yearRange · today ·
 *                       autoFocus · labels · aria-label(기본 "날짜 선택") · aria-labelledby
 *
 * 값(Date 는 그 날의 로컬 0시로 다룬다 — 시간은 보지 않는다)
 *   single    Date | undefined — 누르면 고른다. 다시 눌러도 풀리지 않는다
 *   range     { start?, end? } — 첫 탭이 시작, 시작 뒤의 날은 끝(같은 날이면 하루짜리), 시작 앞의 날은 새 시작(둘을 바꾸지 않는다),
 *             완성된 뒤 누르면 새로 시작. onValueChange 는 { start } 다음 { start, end }. readOnlyStart 면 시작은 그대로이고
 *             시작 뒤의 날만 끝이 된다(시작 앞은 막힌 날)
 *   multiple  Date[] — 누를 때마다 고르고 풀린다, 늘 날짜 순 · 겹침 없음. maxSelectionCount 에 닿으면 고르지 않은 날이 막힌 날이
 *             된다(더 넣지 못하고 빼기는 된다 — SEED 의 제약과 같다)
 * 고르는 동안 칸 값은 그대로다 — 쓰는 쪽은 draft 에 받고 "완료" 로 칸에 넣는다(input-button.md). 기간은 끝을 고르기 전에 "완료" 를 막는다.
 *
 * 보이는 범위
 *   month      머리 48(연 · 월 제목 + 셰브론 20 · 이전 · 다음 Button ghost iconOnly medium 40, 아이콘 18, 둘 사이 0 · 오른쪽 끝) ·
 *              요일 줄 48 · 늘 6주(앞뒤 달 날짜를 흐리게 채운다 — 달을 넘겨도 높이가 그대로다). 폭은 부모(시트 — 시트 폭 − 48),
 *              팝오버 안이면 336(칸 48 × 7, data-slot=popover-content 를 보고 정한다). 제목을 누르면 요일 줄 · 날짜 자리(336)에
 *              연 | 월 휠(Wheel Picker medium × 7 — 연 120 오른쪽 정렬 · 월 96 왼쪽 정렬, 월은 돈다)이 뜨고 셰브론이 위로 돈다(150ms).
 *              휠이 열린 동안 이전 · 다음은 막힌다. 제목을 다시 누르면 고른 달로 옮기고 그 달 1일이 Tab 자리가 된다
 *   twoMonths  696(336 + 24 + 336) — 1280 이상 팝오버의 기간. 머리를 나누지 않는다 — 달 이름은 달마다 가운데(48), 이전은 첫 달
 *              왼쪽 끝 · 다음은 둘째 달 오른쪽 끝(위 4). 이전 · 다음은 한 달씩, PageUp · PageDown 은 두 달씩. 연 · 월 휠은 없다
 *   continuous 1280 미만 시트의 기간 — 머리 · 휠이 없고 달이 위아래로 이어진다. 요일 줄이 위에 붙고, 달마다 왼쪽 달 이름(48) ·
 *              그 달의 주 수(4 ~ 6, 앞뒤 달 날짜는 비운다) · 아래 16. 아래 끝 안개 96(투명 → 바탕색). 부모가 준 높이를 채운다 —
 *              시트는 BottomSheetContent 에 h-[90dvh] 를 준다. 달 높이가 정해져 있어(48 + 48 × 주 + 16) 보이는 달 ± 2달만 그린다.
 *              손으로 스크롤해 맨 위 달이 바뀌면 그 달 1일이 Tab 자리가 된다. 키로 달을 넘으면 그 날이 보이게 가장 적게 스크롤한다
 *
 * 날짜 칸 — 높이 48 · 폭 = 달력 폭 ÷ 7, 칸 전체가 누르는 자리. 원은 칸 가운데 42(위 3 — 원 · 띠끼리 6 떨어진다), 칸이 44 보다
 * 좁으면(320 화면) 칸 폭 − 2. 기간 띠도 원과 같은 높이다. 숫자 t5 16 / 22 · 500 · tabular-nums. 달 그리드가 크기 컨테이너라
 * --day = min(42px, 칸 폭 − 2px) 를 한 번 셈해 원 · 띠 · 링이 같이 쓴다. 상태 · 겹칠 때의 규칙은 date-picker-day.tsx 머리 주석.
 *
 * 빠른 기간(range) — 달력 위 칩 한 줄(ChipRadioGroup · ChipRadio outlineStrong medium, 칩 사이 8 · 아래 12). 누르면 그 기간을 칠하고
 * 시작이 든 달로 옮긴다(열 때와 같다). 달력에서 날을 누르면 칩 고름이 풀린다. 고른 칩은 값이 그 범위일 때만 남는다(초기화 등으로
 * 값이 바뀌면 풀린다) — 처음 그릴 때 값이 어느 칩의 범위와 같으면 그 칩을 골라 둔다. min · max · isDateDisabled 에 걸려 시작이나
 * 끝을 고를 수 없는 칩은 막는다(이름은 어디서나 같은 기간이라 범위를 잘라 넣지 않는다).
 * presetsLayout — scroll(시트, 한 줄 가로 스크롤 · 화면 끝까지 bleed) · wrap(팝오버, 줄바꿈). 기본은 continuous 면 scroll, 아니면 wrap.
 *
 * 키보드(WAI-ARIA Grid) — 날짜 하나만 Tab 순서에 든다(roving tabindex: 보이는 달의 고른 날 → 오늘 → 1일).
 *   ← → 하루 · ↑ ↓ 한 주 · Home End 그 주의 일요일 · 토요일 · PageUp PageDown 한 달(같은 날, 없으면 말일 — 두 달 보기는 두 달) ·
 *   Shift + PageUp PageDown 한 해 · Enter Space 고르기(막힌 날 · 읽기 전용은 무시). 보이는 달 밖으로 옮기면 달이 따라 넘어간다.
 *   보이는 달이 바뀌면 숨은 aria-live="polite" 가 "2026년 11월" 을 읽는다(두 달 보기는 "2026년 10월~2026년 11월" — 물결표를 붙여 쓴다, International Design).
 * autoFocus — 처음 그릴 때 그 날짜(고른 날, 없으면 오늘)에 초점을 둔다. 시트 · 팝오버가 처음 초점을 둔 뒤(바깥 표면의 effect 가
 * 나중에 돈다) 그리기 전에 옮긴다 — 표면은 연 자리(트리거)를 그대로 기억해 닫으면 초점이 칸으로 돌아온다.
 *
 * 이름: 달력 role="group"(aria-label 기본 "날짜 선택" — 칸 라벨이 있으면 aria-labelledby), 달마다 role="grid" + 달 제목으로
 * aria-labelledby · 기간 · 여러 날은 aria-multiselectable. 요일은 columnheader(이름 "일요일" — 보이는 "일" 은 숨긴다. 이어지는 달은
 * 붙은 요일 줄을 숨기고 달마다 숨은 columnheader 줄을 둔다). 날짜 버튼 이름 "2026년 10월 15일 목요일", 고른 날 · 기간 칸은
 * gridcell 에 aria-selected. 이전 · 다음 "이전 달" · "다음 달", 제목 버튼 aria-expanded · aria-controls(휠). 글은 labels 한 벌.
 *
 * 레시피와 다른 자리
 *   - useMemo 를 걷었다(React Compiler). 날짜 도구 · 글 · 표기 · 빠른 기간은 date-picker-dates.ts 로, 날짜 칸은 date-picker-day.tsx 로 나눴다.
 *   - 날짜 원 · 기간 띠 · 초점 링을 ::before / ::after 가 아닌 진짜 요소로 그린다(검사기가 가상 요소를 읽지 못한다 — variants 머리 주석).
 *   - defaultWheelOpen — 연 · 월 휠이 열린 채 시작한다(견본 · 테스트 전용. 스펙의 모양이 아니라 처음 상태만 정한다).
 */

// ── 속성 ─────────────────────────────────────────────────────
type DatePickerBaseProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "defaultValue" | "onChange" | "children"
> & {
  /** month(기본 — 하루 · 여러 날) · twoMonths(1280 이상 팝오버의 기간) · continuous(1280 미만 시트의 기간) */
  visibleRange?: "month" | "twoMonths" | "continuous";
  /** 고를 수 있는 첫날 — 그 앞은 막힌 날 */
  min?: Date;
  /** 고를 수 있는 마지막 날 — 그 뒤는 막힌 날 */
  max?: Date;
  /** 그 밖의 막힌 날 */
  isDateDisabled?: (date: Date) => boolean;
  /** 옮기고 고를 수 있는 연도(양끝 포함) — 기본 오늘 ± 100년 */
  yearRange?: { start: number; end: number };
  /** 오늘 — 기본 지금(테스트 · 서버 날짜에 맞출 때) */
  today?: Date;
  /** 처음 그릴 때 고른 날(없으면 오늘)에 초점 — 시트 · 팝오버가 열 때 */
  autoFocus?: boolean;
  /** 연 · 월 휠이 열린 채 시작한다(견본 · 테스트 전용) */
  defaultWheelOpen?: boolean;
  /** 글 한 벌(기본 한국어) */
  labels?: Partial<DatePickerLabels>;
};

export type DatePickerSingleProps = DatePickerBaseProps & {
  selection?: "single";
  value?: Date;
  onValueChange?: (value: Date) => void;
};

export type DatePickerRangeProps = DatePickerBaseProps & {
  selection: "range";
  value?: DateRange;
  /** { start } 다음 { start, end } */
  onValueChange?: (value: DateRange) => void;
  /** 확정된 시작일 — 시작은 그대로, 시작 뒤의 날만 끝이 된다(진행 중인 기간 늘리기) */
  readOnlyStart?: boolean;
  /** 빠른 기간 칩 — date-picker.md 의 한 벌에서 고른다 */
  presets?: readonly DatePresetName[];
  /** 칩 줄 — scroll(시트, 한 줄 가로 스크롤) · wrap(팝오버, 줄바꿈). 기본은 continuous 면 scroll, 아니면 wrap */
  presetsLayout?: "scroll" | "wrap";
};

export type DatePickerMultipleProps = DatePickerBaseProps & {
  selection: "multiple";
  value?: readonly Date[];
  /** 날짜 순 · 겹침 없음 */
  onValueChange?: (value: Date[]) => void;
  /** 최대 개수 — 닿으면 더 넣지 못한다(빼기는 된다) */
  maxSelectionCount?: number;
};

export type DatePickerProps =
  DatePickerSingleProps | DatePickerRangeProps | DatePickerMultipleProps;

type AnyProps = DatePickerBaseProps & {
  selection?: "single" | "range" | "multiple";
  value?: Date | DateRange | readonly Date[];
  onValueChange?: (value: never) => void;
  readOnlyStart?: boolean;
  presets?: readonly DatePresetName[];
  presetsLayout?: "scroll" | "wrap";
  maxSelectionCount?: number;
};

// ── 달력 ─────────────────────────────────────────────────────
const DatePicker = React.forwardRef<HTMLDivElement, DatePickerProps>(
  (props, ref) => {
    const {
      selection = "single",
      value,
      onValueChange,
      readOnlyStart = false,
      presets,
      presetsLayout,
      maxSelectionCount,
      visibleRange = "month",
      min,
      max,
      isDateDisabled,
      yearRange: yearRangeProp,
      today: todayProp,
      autoFocus = false,
      defaultWheelOpen = false,
      labels: labelsProp,
      className,
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledBy,
      ...rest
    } = props as AnyProps;
    useDsText();
    const labels = { ...datePickerLabels(), ...labelsProp };
    const twoMonths = visibleRange === "twoMonths";
    const continuous = visibleRange === "continuous";

    // 오늘 · 연도 범위 — 오늘을 주지 않으면 처음 그릴 때의 오늘
    const [autoToday] = React.useState(() => startOfDay(new Date()));
    const today = todayProp ? startOfDay(todayProp) : autoToday;
    const yearStart = yearRangeProp?.start ?? today.getFullYear() - 100;
    const yearEnd = yearRangeProp?.end ?? today.getFullYear() + 100;
    const firstDay = new Date(yearStart, 0, 1);
    const lastDay = new Date(yearEnd, 11, 31);
    const firstMonth = yearStart * 12;
    // 두 달 보기는 둘째 달까지 범위 안이어야 한다
    const lastViewMonth = yearEnd * 12 + 11 - (twoMonths ? 1 : 0);
    const clampView = (d: Date) =>
      fromMonthNumber(
        Math.min(Math.max(monthNumber(d), firstMonth), lastViewMonth),
      );

    // 값 — 안에서는 한 꼴로
    const single =
      selection === "single" ? (value as Date | undefined) : undefined;
    const range =
      selection === "range" ? (value as DateRange | undefined) : undefined;
    const rangeStart = range?.start ? startOfDay(range.start) : undefined;
    const rangeEnd =
      range?.end && rangeStart ? startOfDay(range.end) : undefined;
    let multiple: Date[] = [];
    if (selection === "multiple") {
      const list = ((value as readonly Date[] | undefined) ?? [])
        .map(startOfDay)
        .sort(compareDay);
      multiple = list.filter((d, i) => i === 0 || !sameDay(d, list[i - 1]));
    }
    const emit = (next: Date | DateRange | Date[]) =>
      (onValueChange as ((v: Date | DateRange | Date[]) => void) | undefined)?.(
        next,
      );
    const readOnlyStartActive =
      selection === "range" && readOnlyStart && !!rangeStart;
    const maxReached =
      selection === "multiple" &&
      maxSelectionCount !== undefined &&
      multiple.length >= maxSelectionCount;

    // 처음 보일 달 — 고른 날(기간은 시작, 여러 날은 가장 이른 날), 없으면 오늘
    const anchor =
      selection === "single"
        ? single && startOfDay(single)
        : selection === "range"
          ? rangeStart
          : multiple[0];

    const visibleMonths = (view: Date) =>
      twoMonths ? [view, fromMonthNumber(monthNumber(view) + 1)] : [view];
    const isVisible = (d: Date, view: Date) =>
      visibleMonths(view).some(
        (m) =>
          m.getFullYear() === d.getFullYear() && m.getMonth() === d.getMonth(),
      );
    // Tab 자리 — 보이는 달의 고른 날 → 오늘 → 1일
    const tabStopFor = (view: Date) => {
      const picked =
        selection === "single"
          ? single
            ? [startOfDay(single)]
            : []
          : selection === "range"
            ? [rangeStart, rangeEnd].filter((d): d is Date => !!d)
            : multiple;
      return (
        picked.find((d) => isVisible(d, view)) ??
        (isVisible(today, view) ? today : view)
      );
    };

    const [view, setView] = React.useState(() =>
      clampView(monthStart(anchor ?? today)),
    );
    const [focused, setFocused] = React.useState(() =>
      tabStopFor(clampView(monthStart(anchor ?? today))),
    );
    const [wheelOpen, setWheelOpen] = React.useState(defaultWheelOpen);
    const [wheel, setWheel] = React.useState({
      year: view.getFullYear(),
      month: view.getMonth() + 1,
    });

    // 고를 수 없는 날
    const isDisabled = (d: Date) =>
      compareDay(d, firstDay) < 0 ||
      compareDay(d, lastDay) > 0 ||
      (!!min && compareDay(d, startOfDay(min)) < 0) ||
      (!!max && compareDay(d, startOfDay(max)) > 0) ||
      !!isDateDisabled?.(d) ||
      (readOnlyStartActive && !!rangeStart && compareDay(d, rangeStart) < 0) ||
      (maxReached && !multiple.some((x) => sameDay(x, d)));

    const cellState = (d: Date): DayState => {
      const isToday = sameDay(d, today);
      const complete = !!rangeStart && !!rangeEnd;
      let selected = false;
      let isRangeStart = false;
      let isRangeEnd = false;
      let inRange = false;
      if (selection === "single") selected = sameDay(d, single);
      else if (selection === "multiple")
        selected = multiple.some((x) => sameDay(x, d));
      else if (rangeStart) {
        isRangeStart = sameDay(d, rangeStart);
        isRangeEnd = sameDay(d, rangeEnd);
        inRange =
          complete &&
          compareDay(d, rangeStart) > 0 &&
          compareDay(d, rangeEnd!) < 0;
        selected = isRangeStart || isRangeEnd;
      }
      return {
        today: isToday,
        selected,
        rangeStart: isRangeStart,
        rangeEnd: isRangeEnd,
        inRange,
        complete,
        singleDayRange: complete && sameDay(rangeStart, rangeEnd),
        disabled: isDisabled(d),
        readOnly: readOnlyStartActive && isRangeStart,
      };
    };

    // ── 빠른 기간 ──
    const presetList = selection === "range" ? (presets ?? []) : [];
    const presetAvailable = (name: DatePresetName) => {
      const r = getPresetRange(name, today);
      if (compareDay(r.start, firstDay) < 0 || compareDay(r.end, lastDay) > 0)
        return false;
      if (
        (min && compareDay(r.start, startOfDay(min)) < 0) ||
        (max && compareDay(r.end, startOfDay(max)) > 0)
      )
        return false;
      if (isDateDisabled?.(r.start) || isDateDisabled?.(r.end)) return false;
      if (readOnlyStartActive && rangeStart && !sameDay(r.start, rangeStart))
        return false;
      return true;
    };
    const matchesValue = (name: DatePresetName) => {
      const r = getPresetRange(name, today);
      return sameDay(r.start, rangeStart) && sameDay(r.end, rangeEnd);
    };
    const [presetPick, setPresetPick] = React.useState<DatePresetName | null>(
      () => presetList.find(matchesValue) ?? null,
    );
    // 고른 칩은 값이 그 범위일 때만 — 초기화 등으로 값이 바뀌면 풀린다
    const activePreset =
      presetPick && matchesValue(presetPick) ? presetPick : null;

    // ── 초점 · 스크롤 요청(커밋 뒤 처리) ──
    const rootRef = React.useRef<HTMLDivElement>(null);
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const focusRequestRef = React.useRef(false);
    const scrollRequestRef = React.useRef<number | null>(null);
    const userScrollRef = React.useRef(false);

    const id = React.useId();
    const titleId = `${id}title`;
    const wheelId = `${id}wheel`;
    const monthLabelId = (d: Date) => `${id}m${monthNumber(d)}`;

    // ── 이어지는 달: 달 위치 ──
    // 이름 줄 · 칸 · 요일 줄 높이 — 견본을 재서 쓴다(글자 크기를 따라 바뀐다)
    const probeRef = React.useRef<HTMLDivElement>(null);
    const [metrics, setMetrics] =
      React.useState<ContinuousMetrics>(METRICS_100);
    const monthCount = continuous ? (yearEnd - yearStart + 1) * 12 : 0;
    const heights: number[] = [];
    const offsets: number[] = [];
    let total = 0;
    for (let i = 0; i < monthCount; i++) {
      const d = fromMonthNumber(firstMonth + i);
      const h =
        metrics.label +
        weeksInMonth(d.getFullYear(), d.getMonth()) * metrics.row +
        MONTH_GAP;
      offsets.push(total);
      heights.push(h);
      total += h;
    }
    const layout = { offsets, heights, total };
    const offsetOf = (d: Date) => offsets[monthNumber(d) - firstMonth] ?? 0;
    const [scrollTop, setScrollTop] = React.useState(() =>
      continuous ? offsetOf(view) : 0,
    );
    const [viewport, setViewport] = React.useState(0);
    const scrollTopRef = React.useRef(scrollTop);

    // 그 날이 보이게 가장 적게 스크롤할 자리 — 위에 붙은 요일 줄(100% 48) · 아래 안개 96 을 피한다
    const revealTop = (d: Date, current: number, height: number) => {
      const { label, row: rowH, weekday } = metrics;
      const row = Math.floor(
        (new Date(d.getFullYear(), d.getMonth(), 1).getDay() +
          d.getDate() -
          1) /
          7,
      );
      const rowTop = weekday + offsetOf(d) + label + row * rowH;
      if (rowTop < current + weekday) return rowTop - weekday;
      if (height > 0 && rowTop + rowH > current + height - CONTINUOUS_FOG)
        return Math.min(
          rowTop + rowH - height + CONTINUOUS_FOG,
          rowTop - weekday,
        );
      return current;
    };
    const requestScroll = (top: number) => {
      const next = Math.max(0, top);
      scrollRequestRef.current = next;
      scrollTopRef.current = next;
      setScrollTop(next);
    };

    // 보이는 달을 바꾼다 — 이어지는 달이면 그 달을 맨 위로
    const showMonth = (month: Date, tabStop: Date) => {
      const next = clampView(month);
      setView(next);
      setFocused(tabStop);
      if (continuous) requestScroll(offsetOf(next));
    };

    // 키로 초점을 옮긴다 — 보이는 달 밖이면 달이 따라 넘어간다(이어지는 달은 그 날이 보이게 가장 적게 스크롤)
    const moveFocus = (target: Date) => {
      const next = clampDay(target, firstDay, lastDay);
      focusRequestRef.current = true;
      setFocused(next);
      if (continuous) {
        if (monthNumber(next) !== monthNumber(view)) setView(monthStart(next));
        const el = scrollRef.current;
        const top = revealTop(
          next,
          scrollTopRef.current,
          el?.clientHeight ?? viewport,
        );
        if (top !== scrollTopRef.current) requestScroll(top);
        return;
      }
      if (!isVisible(next, view)) setView(clampView(monthStart(next)));
    };

    const selectDate = (d: Date) => {
      const state = cellState(d);
      if (state.disabled || state.readOnly) return;
      setFocused(d);
      setPresetPick(null);
      if (selection === "single") {
        if (!sameDay(d, single)) emit(d);
        return;
      }
      if (selection === "multiple") {
        const exists = multiple.some((x) => sameDay(x, d));
        emit(
          exists
            ? multiple.filter((x) => !sameDay(x, d))
            : [...multiple, d].sort(compareDay),
        );
        return;
      }
      if (readOnlyStartActive && rangeStart) {
        if (compareDay(d, rangeStart) <= 0 || sameDay(d, rangeEnd)) return;
        emit({ start: rangeStart, end: d });
        return;
      }
      if (!rangeStart || rangeEnd) emit({ start: d });
      else if (compareDay(d, rangeStart) < 0) emit({ start: d });
      else emit({ start: rangeStart, end: d });
    };

    const choosePreset = (name: string) => {
      if (!presetList.includes(name as DatePresetName)) return;
      const r = getPresetRange(name as DatePresetName, today);
      setPresetPick(name as DatePresetName);
      emit({ start: r.start, end: r.end });
      // 시작이 든 달로 — Tab 자리는 시작
      showMonth(monthStart(r.start), r.start);
    };

    const onDayKeyDown = (
      e: React.KeyboardEvent<HTMLButtonElement>,
      d: Date,
    ) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.nativeEvent.isComposing)
        return;
      let next: Date;
      switch (e.key) {
        case "ArrowLeft":
          next = addDays(d, -1);
          break;
        case "ArrowRight":
          next = addDays(d, 1);
          break;
        case "ArrowUp":
          next = addDays(d, -7);
          break;
        case "ArrowDown":
          next = addDays(d, 7);
          break;
        case "Home":
          next = weekStart(d);
          break;
        case "End":
          next = weekEnd(d);
          break;
        case "PageUp":
          next = addMonths(d, e.shiftKey ? -12 : twoMonths ? -2 : -1);
          break;
        case "PageDown":
          next = addMonths(d, e.shiftKey ? 12 : twoMonths ? 2 : 1);
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          selectDate(d);
          return;
        default:
          return;
      }
      e.preventDefault();
      moveFocus(next);
    };

    // 이전 · 다음 — 한 달씩(두 달 보기도). Tab 자리는 새 달의 고른 날 → 오늘 → 1일
    const viewNumber = monthNumber(view);
    const canPrev = !wheelOpen && viewNumber > firstMonth;
    const canNext = !wheelOpen && viewNumber < lastViewMonth;
    const step = (dir: -1 | 1) => {
      const next = clampView(fromMonthNumber(viewNumber + dir));
      setView(next);
      setFocused(tabStopFor(next));
    };

    // 연 · 월 휠 — 열 때 지금 달에서, 닫을 때 고른 달로 옮기고 그 달 1일이 Tab 자리
    const toggleWheel = () => {
      if (!wheelOpen) {
        setWheel({ year: view.getFullYear(), month: view.getMonth() + 1 });
        setWheelOpen(true);
        return;
      }
      setWheelOpen(false);
      const picked = clampView(new Date(wheel.year, wheel.month - 1, 1));
      if (monthNumber(picked) === viewNumber) return;
      setView(picked);
      setFocused(picked);
    };
    const yearOptions = Array.from(
      { length: yearEnd - yearStart + 1 },
      (_, i) => ({
        value: String(yearStart + i),
        label: labels.yearOption(yearStart + i),
      }),
    );
    const monthOptions = Array.from({ length: 12 }, (_, i) => ({
      value: String(i + 1),
      label: labels.monthOption(i + 1),
    }));

    // ── 커밋 뒤 — 스크롤 요청을 먼저(그 날이 그려진 뒤) 그다음 초점 ──
    React.useLayoutEffect(() => {
      const el = scrollRef.current;
      if (el && scrollRequestRef.current !== null) {
        userScrollRef.current = false;
        el.scrollTop = scrollRequestRef.current;
        scrollRequestRef.current = null;
      }
      if (!focusRequestRef.current) return;
      focusRequestRef.current = false;
      rootRef.current
        ?.querySelector<HTMLElement>(`[data-date="${dayKey(focused)}"]`)
        ?.focus({ preventScroll: true });
    });

    // 처음 그릴 때 — 이어지는 달은 보일 달을 맨 위로, 스크롤 칸의 높이를 따라 잰다
    React.useLayoutEffect(() => {
      const el = scrollRef.current;
      if (!continuous || !el) return;
      el.scrollTop = scrollTopRef.current;
      const measure = () => setViewport(el.clientHeight);
      measure();
      const observer = new ResizeObserver(measure);
      observer.observe(el);
      return () => observer.disconnect();
    }, [continuous]);

    // 이어지는 달 — 견본(이름 줄 · 칸 · 요일 줄)을 재고, 글자 크기가 바뀌면 다시 잰다
    React.useLayoutEffect(() => {
      const el = probeRef.current;
      if (!continuous || !el) return;
      const parts = Array.from(el.children);
      const measure = () => {
        const [label, row, weekday] = parts.map(
          (c) => c.getBoundingClientRect().height,
        );
        if (!label || !row || !weekday) return;
        setMetrics((m) =>
          m.label === label && m.row === row && m.weekday === weekday
            ? m
            : { label, row, weekday },
        );
      };
      measure();
      const observer = new ResizeObserver(measure);
      for (const c of parts) observer.observe(c);
      return () => observer.disconnect();
    }, [continuous]);
    // 높이가 바뀌면(처음 잰 값 · 배율 바뀜) 달 위치가 모두 움직인다 — 보던 달을 다시 맨 위로
    const measuredRef = React.useRef(metrics);
    React.useLayoutEffect(() => {
      if (measuredRef.current === metrics) return;
      measuredRef.current = metrics;
      if (continuous) requestScroll(offsetOf(view));
    });

    // autoFocus — 처음 그릴 때만. 시트 · 팝오버가 처음 초점을 둔 뒤 그리기 전에(바깥 표면의 effect 가 나중에 돈다 — 그다음 차례).
    // 지금 값은 ref 로 읽는다
    const autoFocusRef = React.useRef(autoFocus);
    const focusedRef = React.useRef(focused);
    const revealRef = React.useRef(revealTop);
    React.useLayoutEffect(() => {
      focusedRef.current = focused;
      revealRef.current = revealTop;
    });
    React.useEffect(() => {
      if (!autoFocusRef.current) return;
      let cancelled = false;
      queueMicrotask(() => {
        if (cancelled) return;
        const target = focusedRef.current;
        const el = scrollRef.current;
        if (el) {
          const top = Math.max(
            0,
            revealRef.current(target, el.scrollTop, el.clientHeight),
          );
          if (top !== el.scrollTop) {
            el.scrollTop = top;
            scrollTopRef.current = top;
            setScrollTop(top);
          }
        }
        rootRef.current
          ?.querySelector<HTMLElement>(`[data-date="${dayKey(target)}"]`)
          ?.focus({ preventScroll: true });
      });
      return () => {
        cancelled = true;
      };
    }, []);

    // 이어지는 달 스크롤 — 그릴 달을 고르고, 손으로 스크롤해 맨 위 달이 바뀌면 그 달 1일이 Tab 자리
    const frameRef = React.useRef<number | null>(null);
    const viewRef = React.useRef(view);
    React.useLayoutEffect(() => {
      viewRef.current = view;
    });
    const onContinuousScroll = () => {
      if (frameRef.current !== null) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        const el = scrollRef.current;
        if (!el) return;
        const top = el.scrollTop;
        scrollTopRef.current = top;
        setScrollTop(top);
        if (!userScrollRef.current) return;
        const index = monthAt(layout.offsets, layout.heights, top);
        const month = fromMonthNumber(firstMonth + index);
        if (monthNumber(month) !== monthNumber(viewRef.current)) {
          setView(month);
          setFocused(month);
        }
      });
    };
    React.useEffect(
      () => () => {
        if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      },
      [],
    );
    const markUserScroll = () => {
      userScrollRef.current = true;
    };

    // ── 그리기 ──
    const multiselectable = selection !== "single" || undefined;
    const second = fromMonthNumber(viewNumber + 1);
    const liveText = twoMonths
      ? `${labels.month(view.getFullYear(), view.getMonth() + 1)}${labels.rangeSeparator}${labels.month(second.getFullYear(), second.getMonth() + 1)}`
      : labels.month(view.getFullYear(), view.getMonth() + 1);

    // 요일 줄 — 보이는 줄(위에 붙는 줄 포함)과, 이어지는 달에서 달마다 두는 숨은 줄(읽는 이름만)
    const weekdayHeader = (hidden: boolean) => (
      <div
        role="row"
        data-slot={
          hidden ? "date-picker-weekdays-hidden" : "date-picker-weekdays"
        }
        className={hidden ? "sr-only" : WEEKDAY_ROW}
      >
        {labels.weekdays.map((w, i) => (
          <div
            key={i}
            role="columnheader"
            aria-label={labels.weekdaysLong[i]}
            data-slot="date-picker-weekday"
            className={WEEKDAY}
          >
            <span aria-hidden>{w}</span>
          </div>
        ))}
      </div>
    );

    const renderDay = (d: Date) => {
      const s = cellState(d);
      const label = s.readOnly
        ? `${labels.day(d)}, ${labels.readOnlyRangeStart}`
        : labels.day(d);
      return (
        <DayCell
          key={dayKey(d)}
          date={d}
          state={s}
          label={label}
          tabStop={sameDay(d, focused)}
          onSelect={() => selectDate(d)}
          onFocus={() => {
            if (!sameDay(d, focused)) setFocused(d);
          }}
          onKeyDown={(e) => onDayKeyDown(e, d)}
        />
      );
    };

    // 한 달 — fixed 는 늘 6주(앞뒤 달은 흐리게), natural 은 그 달의 주 수(앞뒤 달은 비운다)
    const renderGrid = (
      month: Date,
      mode: "fixed" | "natural",
      labelledBy: string,
    ) => {
      const y = month.getFullYear();
      const m = month.getMonth();
      const first = weekStart(new Date(y, m, 1));
      const weeks = mode === "fixed" ? 6 : weeksInMonth(y, m);
      return (
        <div
          role="grid"
          aria-labelledby={labelledBy}
          aria-multiselectable={multiselectable}
          data-month={`${y}-${pad2(m + 1)}`}
          className={GRID}
        >
          {weekdayHeader(mode === "natural")}
          {Array.from({ length: weeks }, (_, w) => (
            <div key={w} role="row" className={WEEK}>
              {Array.from({ length: 7 }, (_, i) => {
                const d = addDays(first, w * 7 + i);
                if (d.getMonth() === m) return renderDay(d);
                return (
                  <OutsideCell
                    key={dayKey(d)}
                    date={d}
                    show={mode === "fixed"}
                  />
                );
              })}
            </div>
          ))}
        </div>
      );
    };

    const prevButton = (extra?: string) => (
      <Button
        variant="ghost"
        size="medium"
        layout="iconOnly"
        aria-label={labels.previousMonth}
        data-slot="date-picker-previous"
        disabled={!canPrev}
        className={cn(NAV_PX, extra)}
        onClick={() => step(-1)}
      >
        <ChevronLeft aria-hidden />
      </Button>
    );
    const nextButton = (extra?: string) => (
      <Button
        variant="ghost"
        size="medium"
        layout="iconOnly"
        aria-label={labels.nextMonth}
        data-slot="date-picker-next"
        disabled={!canNext}
        className={cn(NAV_PX, extra)}
        onClick={() => step(1)}
      >
        <ChevronRight aria-hidden />
      </Button>
    );

    const layoutOfPresets = presetsLayout ?? (continuous ? "scroll" : "wrap");
    const presetRow = presetList.length > 0 && (
      <ChipRadioGroup
        aria-label={labels.presets}
        data-slot="date-picker-presets"
        data-layout={layoutOfPresets}
        layout={layoutOfPresets}
        bleed={layoutOfPresets === "scroll"}
        value={activePreset ?? ""}
        onValueChange={choosePreset}
        className={PRESETS}
      >
        {presetList.map((name) => (
          <ChipRadio
            key={name}
            variant="outlineStrong"
            size="medium"
            value={name}
            disabled={!presetAvailable(name)}
          >
            {labels.presetNames[name]}
          </ChipRadio>
        ))}
      </ChipRadioGroup>
    );

    // 이어지는 달 — 보이는 달 ± 2달(Tab 자리의 달은 늘)
    let body: React.ReactNode;
    if (continuous) {
      const height = Math.max(viewport, metrics.row * 8);
      const topIndex = monthAt(layout.offsets, layout.heights, scrollTop);
      const bottomIndex = monthAt(
        layout.offsets,
        layout.heights,
        scrollTop + height,
      );
      const focusIndex = monthNumber(focused) - firstMonth;
      const from = Math.max(
        0,
        Math.min(topIndex - CONTINUOUS_OVERSCAN, focusIndex),
      );
      const to = Math.min(
        monthCount - 1,
        Math.max(bottomIndex + CONTINUOUS_OVERSCAN, focusIndex),
      );
      const topSpace = layout.offsets[from] ?? 0;
      const bottomSpace =
        layout.total - ((layout.offsets[to] ?? 0) + (layout.heights[to] ?? 0));
      body = (
        <div
          ref={scrollRef}
          data-slot="date-picker-scroll"
          className={CONTINUOUS_SCROLL}
          onScroll={onContinuousScroll}
          onWheel={markUserScroll}
          onTouchStart={markUserScroll}
          onPointerDown={markUserScroll}
        >
          <div
            aria-hidden
            data-slot="date-picker-weekdays"
            className={CONTINUOUS_WEEKDAYS}
          >
            {labels.weekdays.map((w, i) => (
              <div key={i} data-slot="date-picker-weekday" className={WEEKDAY}>
                {w}
              </div>
            ))}
          </div>
          <div aria-hidden style={{ height: topSpace }} />
          {Array.from({ length: to - from + 1 }, (_, k) => {
            const month = fromMonthNumber(firstMonth + from + k);
            const labelId = monthLabelId(month);
            return (
              <div
                key={monthNumber(month)}
                data-slot="date-picker-month"
                className={CONTINUOUS_MONTH}
              >
                <div
                  id={labelId}
                  data-slot="date-picker-month-label"
                  className={cn(MONTH_LABEL, CONTINUOUS_MONTH_LABEL)}
                >
                  {labels.month(month.getFullYear(), month.getMonth() + 1)}
                </div>
                {renderGrid(month, "natural", labelId)}
              </div>
            );
          })}
          <div aria-hidden style={{ height: bottomSpace }} />
          <div aria-hidden data-slot="date-picker-fog" className={FOG} />
        </div>
      );
    } else if (twoMonths) {
      body = (
        <div data-slot="date-picker-months" className={TWO_MONTHS}>
          {visibleMonths(view).map((month, i) => {
            const labelId = monthLabelId(month);
            return (
              <div
                key={monthNumber(month)}
                data-slot="date-picker-month"
                className="min-w-0"
              >
                <div
                  data-slot="date-picker-header"
                  className={TWO_MONTHS_HEADER}
                >
                  <span
                    id={labelId}
                    data-slot="date-picker-month-label"
                    className={MONTH_LABEL}
                  >
                    {labels.month(month.getFullYear(), month.getMonth() + 1)}
                  </span>
                  {i === 0 ? prevButton(NAV_START) : nextButton(NAV_END)}
                </div>
                {renderGrid(month, "fixed", labelId)}
              </div>
            );
          })}
        </div>
      );
    } else {
      body = (
        <>
          <div data-slot="date-picker-header" className={HEADER}>
            <button
              type="button"
              id={titleId}
              aria-expanded={wheelOpen}
              aria-controls={wheelOpen ? wheelId : undefined}
              data-slot="date-picker-title"
              className={TITLE}
              onClick={toggleWheel}
            >
              <span className="truncate">
                {labels.month(view.getFullYear(), view.getMonth() + 1)}
              </span>
              <ChevronDown
                aria-hidden
                strokeWidth={2}
                data-slot="date-picker-title-icon"
                className={cn(TITLE_ICON, wheelOpen && "rotate-180")}
              />
            </button>
            <div className={NAV}>
              {prevButton()}
              {nextButton()}
            </div>
          </div>
          {wheelOpen ? (
            <div id={wheelId} data-slot="date-picker-wheel" className={WHEEL}>
              <WheelPicker
                size="medium"
                visibleItems={7}
                aria-label={labels.month(wheel.year, wheel.month)}
              >
                <WheelPickerColumn
                  aria-label={labels.yearWheel}
                  className={WHEEL_YEAR}
                  align="right"
                  options={yearOptions}
                  value={String(wheel.year)}
                  onValueChange={(year) =>
                    setWheel((w) => ({ ...w, year: Number(year) }))
                  }
                />
                <WheelPickerColumn
                  aria-label={labels.monthWheel}
                  className={WHEEL_MONTH}
                  align="left"
                  loop
                  options={monthOptions}
                  value={String(wheel.month)}
                  onValueChange={(month) =>
                    setWheel((w) => ({ ...w, month: Number(month) }))
                  }
                />
              </WheelPicker>
            </div>
          ) : (
            renderGrid(view, "fixed", titleId)
          )}
        </>
      );
    }

    return (
      <div
        ref={mergeRefs(ref, rootRef)}
        role="group"
        aria-label={ariaLabelledBy ? ariaLabel : (ariaLabel ?? labels.root)}
        aria-labelledby={ariaLabelledBy}
        data-slot="date-picker"
        data-selection={selection}
        data-visible-range={visibleRange}
        className={cn(ROOT, ROOT_SIZE[visibleRange], className)}
        {...rest}
      >
        {presetRow}
        {body}
        {continuous && (
          <div
            ref={probeRef}
            aria-hidden
            data-slot="date-picker-probe"
            className={PROBE}
          >
            <div className={cn(MONTH_LABEL, CONTINUOUS_MONTH_LABEL)}>
              {labels.month(view.getFullYear(), view.getMonth() + 1)}
            </div>
            <div className={WEEK}>
              <div className={CELL}>
                <span className={OUTSIDE}>30</span>
              </div>
            </div>
            <div className={WEEKDAY_ROW}>
              <div className={WEEKDAY}>{labels.weekdays[0]}</div>
            </div>
          </div>
        )}
        <span
          aria-live="polite"
          aria-atomic="true"
          data-slot="date-picker-live"
          className={LIVE}
        >
          {liveText}
        </span>
      </div>
    );
  },
);
DatePicker.displayName = "DatePicker";

export { DatePicker };
