import { cn } from "@/shared/lib/cn";

/*
 * Top Navigation 의 클래스 · 상수 — 컴포넌트 파일은 컴포넌트만 내보낸다(빠른 새로 고침).
 * 값의 원본은 groo-design specs/components/top-navigation.yaml(src/shared/ds/spec/top-navigation.json).
 * 임의 값([50px] 등)은 스펙 JSON 값과 같은 것이고, 토큰에 없는 숫자라 이유를 곁에 적었다.
 */

export type TopNavigationType = "root" | "standard" | "desktop";

// ── 바 ───────────────────────────────────────────────────────
// 위 안전 영역은 바탕만 채우고 내용은 그 아래 56 에. 좌우는 6(desktop 왼쪽은 본문 여백 32) + 그쪽 안전 영역
export const ROOT = [
  "sticky top-0 z-(--z-sticky) w-full shrink-0 bg-bg-layer-default pt-[env(safe-area-inset-top)] font-sans text-fg-neutral",
  "pr-[calc(var(--spacing-x1_5)+env(safe-area-inset-right))]",
].join(" ");
export const ROOT_LEFT: Record<TopNavigationType, string> = {
  root: "pl-[calc(var(--spacing-x1_5)+env(safe-area-inset-left))]",
  standard: "pl-[calc(var(--spacing-x1_5)+env(safe-area-inset-left))]",
  desktop: "pl-[calc(var(--layout-margin)+env(safe-area-inset-left))]",
};
export const ROW = "flex h-[56px] items-center";

// ── 제목 ─────────────────────────────────────────────────────
// 글자 크기 설정은 1.2배까지 — 크기 · 줄 높이 모두 clamp(고정 값(-static), 설정을 따르는 값(rem), 고정 값 × 1.2).
// Tailwind 는 소스의 글자 그대로를 읽으므로 쓰는 셋(t8 · t6 · t5)을 풀어 적는다
const TEXT_T8 =
  "text-[length:clamp(var(--text-t8-static),var(--text-t8),calc(var(--text-t8-static)*1.2))] leading-[clamp(var(--text-t8-static--line-height),var(--text-t8--line-height),calc(var(--text-t8-static--line-height)*1.2))]";
const TEXT_T6 =
  "text-[length:clamp(var(--text-t6-static),var(--text-t6),calc(var(--text-t6-static)*1.2))] leading-[clamp(var(--text-t6-static--line-height),var(--text-t6--line-height),calc(var(--text-t6-static--line-height)*1.2))]";
export const TEXT_T5 =
  "text-[length:clamp(var(--text-t5-static),var(--text-t5),calc(var(--text-t5-static)*1.2))] leading-[clamp(var(--text-t5-static--line-height),var(--text-t5--line-height),calc(var(--text-t5-static--line-height)*1.2))]";

export const FOCUS_INSIDE =
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-stroke-focus-ring";

// 제목 — 한 줄 말줄임 · 700, 오른쪽 자리 앞 8 은 TopNavigationActions 가 비운다. 화면을 옮기면 초점을 받는다(링은 키보드로 왔을 때만)
export const TITLE = [
  "m-0 min-w-0 flex-1 truncate font-bold text-fg-neutral",
  FOCUS_INSIDE,
].join(" ");
// root — 화면 끝에서 16(바의 6 + 10). standard — ← 다음 6 = 화면 끝에서 56
// (왼쪽 버튼이 없으면 50 을 띄워 같은 자리 — 6 + 44 + 6 에서 바의 6 을 뺀 값이라 토큰이 없다)
export const TITLE_TYPE: Record<
  Exclude<TopNavigationType, "desktop">,
  string
> = {
  root: cn("ml-x2_5", TEXT_T8),
  standard: cn("ml-x1_5 first:ml-[50px]", TEXT_T6),
};

// ── 검색칸 ───────────────────────────────────────────────────
// 높이 40(바 56 의 가운데 — 위아래 8)은 Input medium 이 정한다. standard — ← 다음 6 부터 남은 폭 · desktop — 머리 왼쪽 폭 360
export const SEARCH = "min-w-0";
export const SEARCH_TYPE: Record<TopNavigationType, string> = {
  root: "ml-x2_5 flex-1",
  standard: "ml-x1_5 first:ml-[50px] flex-1",
  desktop: "w-[360px] max-w-full",
};

// ── 오른쪽 자리 ──────────────────────────────────────────────
// 제목 끝 ↔ 첫 버튼 상자 8(SEED titleMinGap) — 제목이 없으면 오른쪽으로 민다. 버튼끼리는 붙는다
export const ACTIONS = "ml-auto flex shrink-0 items-center pl-x2";

// ── 버튼 ─────────────────────────────────────────────────────
const PRESS_TRANSITION =
  "[transition:background-color_var(--motion-duration-color-transition)_var(--motion-ease-easing),scale_var(--motion-duration-pressed-scale)_var(--motion-ease-pressed-scale)]";

// 아이콘 버튼 — 상자 44 = 누르는 영역 · 아이콘 24. 누르면 바탕 + 2px 거리 축소(44 → 0.955), 막히면 fg-disabled(바탕 · 축소 없음)
export const ICON_BUTTON = [
  "relative flex size-[44px] shrink-0 cursor-pointer items-center justify-center rounded-r2 border-0 bg-transparent p-0 text-fg-neutral",
  "[&_svg]:size-[24px] [&_svg]:shrink-0",
  // 켜고 끄는 단추(aria-pressed) — 끔 선 2 · 켬 선 2.5, 색은 그대로 fg-neutral(19B). aria-pressed 가 없는 버튼의 선은 건드리지 않는다
  "aria-[pressed=false]:[&_svg]:[stroke-width:2] aria-pressed:[&_svg]:[stroke-width:2.5]",
  PRESS_TRANSITION,
  "hover:bg-bg-layer-default-pressed active:bg-bg-layer-default-pressed active:[scale:calc(1-2/44)] motion-reduce:active:[scale:1]",
  FOCUS_INSIDE,
  "disabled:cursor-not-allowed disabled:bg-transparent disabled:text-fg-disabled disabled:[scale:1]",
].join(" ");

// 글 버튼 — 높이 44 · 좌우 10 · t5 · 500. 누르는 순간 기준 max(44, 폭 ÷ 4, 24) 를 잰다(--press-basis)
export const TEXT_BUTTON = [
  "relative flex h-[44px] shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-r2 border-0 bg-transparent px-x2_5 font-sans font-medium text-fg-neutral",
  TEXT_T5,
  PRESS_TRANSITION,
  "hover:bg-bg-layer-default-pressed active:bg-bg-layer-default-pressed active:[scale:calc(1-2/var(--press-basis,44))] motion-reduce:active:[scale:1]",
  FOCUS_INSIDE,
  "disabled:cursor-not-allowed disabled:bg-transparent disabled:text-fg-disabled disabled:[scale:1]",
].join(" ");

/** 누르는 순간 기준 길이 max(높이, 폭 ÷ 4, 24) 를 --press-basis 로 놓는다 */
export function measurePress(el: HTMLElement) {
  el.style.setProperty(
    "--press-basis",
    String(Math.max(el.offsetHeight, el.offsetWidth / 4, 24)),
  );
}

// ── 데스크톱 본문 제목 ───────────────────────────────────────
export const SCREEN_TITLE = cn(
  "m-0 mt-nav-to-title font-sans text-screen-title font-bold text-fg-neutral",
  FOCUS_INSIDE,
);

/** 제목 줄 — 제목 덩어리(제목 + 설명) 왼쪽 · 동작 버튼 오른쪽 아래 끝. 머리 아래 20 은 줄 전체의 위, 덩어리 ↔ 버튼 16 */
export const SCREEN_TITLE_ROW =
  "mt-nav-to-title flex items-end justify-between gap-x4";

/** 제목 아래 설명 16 / 22 · 400 · muted, 제목과 2 */
export const SCREEN_DESCRIPTION =
  "mt-x0_5 mb-0 text-t5 font-normal text-fg-neutral-muted";

/** 동작 버튼 묶음 — Button small, 사이 8 */
export const SCREEN_ACTIONS = "flex shrink-0 items-center gap-x2";
