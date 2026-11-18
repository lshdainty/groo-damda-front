/*
 * Groo Date Picker 의 모양 — 수치 원본은 groo-design specs/components/date-picker.yaml(값은 src/shared/ds/spec/date-picker.json).
 * groo-design recipes/shadcn/components/ui/date-picker.tsx 를 첫 판으로 가져왔다. 이 파일은 모양 정의(클래스 · 자리 상수),
 * 컴포넌트는 date-picker.tsx · date-picker-day.tsx 다(컴포넌트 파일은 컴포넌트만 내보낸다 — 빠른 새로 고침).
 *
 * 레시피와 다른 자리 — 날짜 원 · 기간 띠 · 초점 링을 ::before / ::after 가 아니라 **진짜 요소**(span)로 그린다. 검사기(ds:check)는
 * 요소의 계산된 스타일만 읽고 가상 요소는 읽지 못해서, 원의 크기 · 모서리 · 색 · 전환과 띠의 높이 · 색과 링의 두께 · 띠움을 잴 수 없었다.
 * 모양은 같다(원 42 · 칸 가운데, 띠는 칸 세로 가운데, 링은 원 둘레 안쪽 2px).
 */

import { WEEK_GRID_TEXT } from "@/shared/ds/week-grid-text";

// 달력 — bg-layer-floating. 폭은 부모(시트), 팝오버 안이면 336(칸 48 × 7 — 스펙 값 그대로), 두 달은 696(336 + 24 + 336).
// 이어지는 달은 부모가 준 높이를 채운다
export const ROOT =
  "relative flex min-w-0 flex-col bg-bg-layer-floating font-sans";
export const ROOT_SIZE = {
  month: "w-full [[data-slot=popover-content]_&]:w-[336px]",
  twoMonths: "w-[696px]",
  continuous: "h-full min-h-0 w-full",
} as const;

// 빠른 기간 칩 줄 — 머리와 12
export const PRESETS = "shrink-0 pb-x3";

// 머리 최소 48(글이 크면 그만큼만 늘어난다 — 03-C 결정 1B) — 왼쪽 제목, 오른쪽 이전 · 다음(사이 0)
export const HEADER = "flex min-h-[48px] shrink-0 items-center justify-between";
// 제목 — 누르는 자리는 머리 높이 48 전체, 글자는 왼쪽에서 4 · 셰브론과 4. 바탕이 없어 모서리 8 은 초점 링에만 보인다
export const TITLE = [
  "inline-flex min-h-[48px] min-w-0 cursor-pointer items-center gap-x1 rounded-r2 border-0 bg-transparent px-x1 font-sans text-t5 font-bold text-fg-neutral outline-none",
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-stroke-focus-ring",
].join(" ");
// 셰브론 20 — 휠이 열리면 위로(150ms easing). 모션 줄이기면 바로
export const TITLE_ICON =
  "size-[20px] shrink-0 text-fg-neutral [transition:rotate_var(--motion-duration-d3)_var(--motion-ease-easing)] motion-reduce:[transition:none]";
export const NAV = "flex shrink-0 items-center";

// 두 달 — 사이 24, 달마다 가운데 이름 48 · 이전은 첫 달 왼쪽 끝 · 다음은 둘째 달 오른쪽 끝(위 4)
export const TWO_MONTHS = "grid grid-cols-2 gap-x-x6";
export const TWO_MONTHS_HEADER =
  "relative flex min-h-[48px] items-center justify-center";
export const NAV_START = "absolute left-0 top-x1";
export const NAV_END = "absolute right-0 top-x1";

// 달 이름 48 — 두 달 보기는 가운데, 이어지는 달은 왼쪽(좌우 4)에 붙고 달 아래 16
export const MONTH_LABEL =
  "flex min-h-[48px] items-center whitespace-nowrap text-t5 font-bold text-fg-neutral";
export const CONTINUOUS_MONTH_LABEL = "px-x1";

// 이어지는 달 — 스크롤 칸(스크롤바 숨김) · 위에 붙는 요일 줄 · 달마다 왼쪽 이름 48 + 아래 16 · 아래 안개 96.
// z-[2] · z-[3] 은 이 스크롤 칸 안의 쌓임(요일 줄 < 안개)이라 전역 z 토큰이 아니다
// 시트가 낮아(320 보다 좁은 화면에서 바닥 버튼이 위아래로 쌓일 때 등) 달이 요일 줄 + 2주보다 낮아지면 그 높이에서 멈춘다 — 넘친 만큼은
// 시트 본문이 스크롤한다(DATE_PICKER_CONTINUOUS_SHEET_BODY, Layout "지원 폭"). 요일 줄 · 주 줄 높이는 WHEEL 과 같은 셈이다
export const CONTINUOUS_SCROLL =
  "relative min-h-[calc(max(48px,min(var(--text-t4--line-height),calc(var(--text-t4-static--line-height)_*_2)))_+_2_*_max(48px,calc(min(var(--text-t5--line-height),calc(var(--text-t5-static--line-height)_*_2))_+_6px)))] flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
export const CONTINUOUS_WEEKDAYS =
  "sticky top-0 z-[2] grid min-h-[48px] grid-cols-7 bg-bg-layer-floating";
export const CONTINUOUS_MONTH = "pb-x4";
export const FOG =
  "pointer-events-none sticky bottom-0 z-[3] -mt-24 h-[96px] [background:linear-gradient(to_bottom,transparent,var(--color-bg-layer-floating))]";

// 연 · 월 휠 자리 — 요일 줄 + 6주를 덮는다: max(48, 요일 줄 높이) + 6 × max(48, 숫자 줄 높이 + 6)(둘 다 200% 상한 — WEEK_GRID_TEXT) — 100% 336 · 200% 348.
// 글이 크면 달력을 따라 늘어나 열고 닫을 때 높이가 그대로다(WEEKDAY_ROW · CELL · DAY 와 같은 셈). 휠 308 은 가운데(100% 위아래 14). 연 120 · 월 96
export const WHEEL =
  "flex h-[calc(max(48px,min(var(--text-t4--line-height),calc(var(--text-t4-static--line-height)_*_2)))_+_6_*_max(48px,calc(min(var(--text-t5--line-height),calc(var(--text-t5-static--line-height)_*_2))_+_6px)))] items-center bg-bg-layer-floating";
export const WHEEL_YEAR = "w-[120px]";
export const WHEEL_MONTH = "w-[96px]";

// 달 그리드 — 크기 컨테이너. --day = min(42, 칸 폭 − 2) 를 원 · 띠 · 링이 같이 쓴다(칸이 44 보다 좁은 320 화면에서 원을 줄인다)
export const GRID = "@container [--day:min(42px,calc(100cqw_/_7_-_2px))]";
export const WEEK = "grid grid-cols-7";
export const WEEKDAY_ROW = "grid min-h-[48px] grid-cols-7";
/**
 * 요일 글 — text-t4 에 글자 크기 200% 상한(WEEK_GRID_TEXT — date-picker.md "글자 크기 설정", groo-design #252 · #258). 320 폭에서 그보다 크면
 * 한 글자(영어 "W")도 칸에 들지 않는다. 날짜 숫자(DAY · OUTSIDE)도 같은 상한이고, 제목은 그대로 커진다
 */
export const WEEKDAY = `flex items-center justify-center whitespace-nowrap ${WEEK_GRID_TEXT.t4} font-medium text-fg-neutral-subtle`;

// 칸 — 높이 max(48, 숫자 줄 높이 + 6)(날짜 버튼 · 앞뒤 달 숫자의 위아래 3 이 키운다 — 100% 48 · 200% 50, 03-C 1B) · 폭 = 달력 폭 ÷ 7. 기간 띠는 칸 안의 span(원 높이, 칸 세로 가운데)
export const CELL = "relative isolate min-h-[48px] min-w-0";
export const BAND =
  "pointer-events-none absolute top-1/2 h-[var(--day)] -translate-y-1/2 bg-bg-neutral-weak";
export const BAND_SIDE = {
  start: "left-1/2 right-0",
  middle: "inset-x-0",
  end: "left-0 right-1/2",
} as const;

// 날짜 버튼 — 칸 전체. 원(DAY_VISUAL)은 칸 가운데 --day(바탕만 color-transition), 키보드 초점 링(DAY_RING)은 원 둘레 안쪽 2px
export const DAY = `group/day relative isolate flex h-full w-full items-center justify-center border-0 bg-transparent px-0 py-[3px] font-sans ${WEEK_GRID_TEXT.t5} font-medium tabular-nums outline-none select-none [-webkit-tap-highlight-color:transparent]`;
export const DAY_VISUAL =
  "pointer-events-none absolute left-1/2 top-1/2 -z-10 size-[var(--day)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-transparent [transition:background-color_var(--motion-duration-color-transition)_var(--motion-ease-easing)]";
export const DAY_RING =
  "pointer-events-none absolute left-1/2 top-1/2 size-[var(--day)] -translate-x-1/2 -translate-y-1/2 rounded-full group-focus-visible/day:outline-2 group-focus-visible/day:-outline-offset-2 group-focus-visible/day:outline-stroke-focus-ring";
// 호버(마우스 — 고운 포인터만) · 누름(터치) — 원 bg-neutral-weak-alpha-pressed(SEED 투명 색 — 03-C 결정 2B), 축소 없음
export const DAY_PRESS =
  "[@media(hover:hover)_and_(pointer:fine)]:group-hover/day:bg-bg-neutral-weak-alpha-pressed group-active/day:bg-bg-neutral-weak-alpha-pressed";
// 오늘(옅은 원) · 기간 사이 날(띠) 위의 호버 · 누름 — 한 단계 짙은 bg-neutral-weak-pressed(옅은 원 · 띠와 같은 색이면 안 보인다)
export const DAY_PRESS_ON_WEAK =
  "[@media(hover:hover)_and_(pointer:fine)]:group-hover/day:bg-bg-neutral-weak-pressed group-active/day:bg-bg-neutral-weak-pressed";
// 상태 — 글자(button) · 원(span)
export const DAY_STATE = {
  enabled: "cursor-pointer text-fg-neutral-muted",
  today: "cursor-pointer text-fg-neutral",
  selected: "cursor-pointer text-fg-neutral-inverted",
  inRange: "cursor-pointer text-fg-neutral-muted",
  disabled: "cursor-not-allowed text-fg-disabled",
  readOnly: "cursor-default text-fg-neutral-inverted",
} as const;
export const DAY_VISUAL_STATE = {
  enabled: "",
  today: "bg-bg-neutral-weak",
  selected: "bg-bg-neutral-inverted",
  inRange: "",
  disabled: "",
  readOnly: "bg-stroke-neutral-solid",
} as const;
export const DAY_TODAY_WEIGHT = "font-bold";
export const DAY_STRIKE = "line-through";
// 앞뒤 달 — 숫자만(버튼 아님), 흐리게 · 누르지 못한다
export const OUTSIDE = `flex h-full w-full cursor-default select-none items-center justify-center py-[3px] ${WEEK_GRID_TEXT.t5} font-medium tabular-nums text-fg-disabled`;

export const LIVE = "sr-only";

// 이어지는 달의 높이 — 달 이름 줄 + 칸 × 주 + 아래 16. 이름 줄 · 칸 · 요일 줄은 글자가 크면 늘어나(200% 에서 칸 50)
// 숨은 견본(PROBE)으로 잰다. 처음 값은 100% 의 48 · 48 · 48
export const MONTH_GAP = 16;
export type ContinuousMetrics = { label: number; row: number; weekday: number };
export const METRICS_100: ContinuousMetrics = {
  label: 48,
  row: 48,
  weekday: 48,
};
// 견본 — 보이지 않고 보조 기술에도 숨긴다. 달 이름 줄 · 칸 한 줄(앞뒤 달 숫자 — 날짜 버튼과 같은 높이) · 요일 줄 차례
export const PROBE =
  "pointer-events-none invisible absolute inset-x-0 top-0 -z-10";
export const CONTINUOUS_FOG = 96;
export const CONTINUOUS_OVERSCAN = 2;

/** 두 달 보기를 담는 PopoverContent 의 className — 팝오버 폭 744(달력 696 + 좌우 24). Popover 최대 480 의 예외(date-picker.md) */
export const DATE_PICKER_TWO_MONTHS_POPOVER =
  "max-w-[min(744px,var(--radix-popover-content-available-width,744px))]";

/**
 * 이어지는 달(continuous)을 담는 BottomSheetBody 의 className — 세로는 본문이 스크롤하고(SHEET_BODY 의 overflow-y-auto 그대로) 가로는 자른다
 * (칩 줄 bleed 는 본문 좌우 여백 안이라 잘리지 않는다). 보통 높이에서는 달력이 본문을 꼭 채워 본문 스크롤이 생기지 않고 달 안에서 스크롤한다.
 * 시트가 낮아 달이 요일 줄 + 2주에서 멈추면 넘친 만큼 본문이 스크롤한다 — 머리 · 바닥은 그대로 보인다(date-picker.md · Layout "지원 폭")
 */
export const DATE_PICKER_CONTINUOUS_SHEET_BODY = "overflow-x-hidden";

/** 이전 · 다음 버튼 — 40 px(글자 배율을 따르지 않는다 — 03-C 결정 1B, 레시피 NAV_PX) */
export const NAV_PX = "h-[40px] w-[40px]";
