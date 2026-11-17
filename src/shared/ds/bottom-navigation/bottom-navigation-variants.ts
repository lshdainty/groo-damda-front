/*
 * Bottom Navigation 의 클래스 · 상수 — 컴포넌트 파일은 컴포넌트만 내보낸다(빠른 새로 고침).
 * 값의 원본은 groo-design specs/components/bottom-navigation.yaml(src/shared/ds/spec/bottom-navigation.json).
 * 임의 값은 스펙 JSON 값과 같은 것이고, 토큰에 없는 숫자(66 · 48 · 480)라 이유를 곁에 적었다.
 */

/** 본문 아래 여백 — 바의 아래 자리 + 66 + 24. 바가 줄어도 그대로 둔다(줄 때마다 본문이 밀리지 않게) */
export const BOTTOM_NAVIGATION_INSET =
  "calc(max(14px, env(safe-area-inset-bottom) - 6px) + 90px)";

// 줄어들기 기준(지금 Desk 웹 · 앱 값) — 아래로 20 · 위로 28 · 맨 위 40
export const SHRINK_AFTER = 20;
export const EXPAND_AFTER = 28;
export const TOP_ZONE = 40;
// 좁은 칸 — 칸 폭이 + 원 44 보다 좁으면(320 보다 좁은 화면 — 페이지 확대, Layout "지원 폭") 줄어든 바처럼 라벨을 숨기고 원을 36 으로.
// 칸 폭 = (바 안쪽 폭 − 칸 사이 2 × 4) ÷ 5. 320 화면은 펼침 52.8 · 줄어듦 44.8 이라 걸리지 않는다
export const NARROW_CELL = 44;
export const CELL_COUNT = 5;
export const CELL_GAP = 2;
// 화면 키보드 — visualViewport 가 화면보다 이만큼 작으면 열렸다고 본다
export const KEYBOARD_GAP = 150;
// 세지 않는 스크롤 — 시트 · 대화상자 · 떠 있는 목록 안
export const IGNORED_SCROLL =
  '[role="dialog"], [role="alertdialog"], [data-vaul-drawer], [data-radix-popper-content-wrapper]';

// ── 바 ───────────────────────────────────────────────────────
// 480 · 66 · 48 은 토큰에 없는 바 자신의 치수다(bottom-navigation.yaml root.maxWidth · height)
export const ROOT = [
  "fixed z-(--z-sticky) mx-auto grid max-w-[480px] grid-cols-5 gap-[2px] rounded-full bg-bg-layer-floating font-sans",
  "shadow-[var(--shadow-s3),inset_0_0_0_1px_var(--color-stroke-neutral-subtle)]",
  "[transition:height_var(--motion-duration-d4)_var(--motion-ease-easing),left_var(--motion-duration-d4)_var(--motion-ease-easing),right_var(--motion-duration-d4)_var(--motion-ease-easing),bottom_var(--motion-duration-d4)_var(--motion-ease-easing),padding_var(--motion-duration-d4)_var(--motion-ease-easing)]",
  "motion-reduce:transition-none",
].join(" ");
// 펼침 66 · 화면 끝 14 · 아래 max(14, 안전 영역 − 6) / 줄어듦 48 · 36 · max(12, 안전 영역 − 8)
export const ROOT_REGULAR = [
  "h-[66px] px-x2_5 py-x1_5",
  "left-[calc(var(--spacing-x3_5)+env(safe-area-inset-left))] right-[calc(var(--spacing-x3_5)+env(safe-area-inset-right))]",
  "bottom-[max(14px,calc(env(safe-area-inset-bottom)-6px))]",
].join(" ");
export const ROOT_COMPACT = [
  "h-[48px] cursor-pointer px-x2 py-0",
  "left-[calc(var(--spacing-x9)+env(safe-area-inset-left))] right-[calc(var(--spacing-x9)+env(safe-area-inset-right))]",
  "bottom-[max(12px,calc(env(safe-area-inset-bottom)-8px))]",
].join(" ");

// ── 칸 ───────────────────────────────────────────────────────
// 칸 — 아이콘 위 · 라벨 아래(사이 2), 칸 전체가 누르는 자리. 누르면 칸만 2px 거리 축소(색은 그대로), 키보드 포커스에 안쪽 2px 링
export const ITEM = [
  "relative flex h-full min-w-0 cursor-pointer flex-col items-center justify-center gap-[2px] rounded-r3 no-underline",
  "[&_svg]:size-[24px] [&_svg]:shrink-0",
  "[transition:scale_var(--motion-duration-pressed-scale)_var(--motion-ease-pressed-scale)]",
  "active:[scale:calc(1-2/var(--press-basis,54))] motion-reduce:active:[scale:1]",
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-stroke-focus-ring",
].join(" ");
// 지금 탭 — 짙은 글자색 + 선 2.5 / 다른 탭 — fg-neutral-subtle + 선 2
export const ITEM_CURRENT = "text-fg-neutral [&_svg]:[stroke-width:2.5]";
export const ITEM_OTHER = "text-fg-neutral-subtle [&_svg]:[stroke-width:2]";
// 라벨 — 11 / 15 · 500 고정 크기 · 한 줄
export const LABEL = "text-t1-static font-medium";
export const LABEL_SHOWN = "block max-w-full truncate whitespace-nowrap";

// ── 가운데 + ────────────────────────────────────────────────
// 칸 전체가 누르는 자리 — 브랜드 원 44(줄어듦 36) + 흰 + 24(20). 누르면 원만 누름 색 + 2px 거리 축소, 키보드 포커스에 원 바깥 2px 링
export const ADD =
  "group/bottom-navigation-add relative flex h-full min-w-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0 outline-none";
export const ADD_CIRCLE = [
  "flex shrink-0 items-center justify-center rounded-full bg-bg-brand-solid text-static-white [&_svg]:shrink-0 [&_svg]:[stroke-width:2.5]",
  "[transition:background-color_var(--motion-duration-pressed-scale)_var(--motion-ease-pressed-scale),scale_var(--motion-duration-pressed-scale)_var(--motion-ease-pressed-scale),width_var(--motion-duration-d4)_var(--motion-ease-easing),height_var(--motion-duration-d4)_var(--motion-ease-easing)]",
  "motion-reduce:[transition:background-color_var(--motion-duration-pressed-scale)_var(--motion-ease-pressed-scale)]",
  "group-active/bottom-navigation-add:bg-bg-brand-solid-pressed group-active/bottom-navigation-add:[scale:calc(1-2/var(--add-basis))] motion-reduce:group-active/bottom-navigation-add:[scale:1]",
  "group-focus-visible/bottom-navigation-add:outline-2 group-focus-visible/bottom-navigation-add:outline-offset-2 group-focus-visible/bottom-navigation-add:outline-stroke-focus-ring",
].join(" ");
export const ADD_CIRCLE_REGULAR =
  "size-[44px] [--add-basis:44] [&_svg]:size-[24px]";
export const ADD_CIRCLE_COMPACT =
  "size-[36px] [--add-basis:36] [&_svg]:size-[20px]";
