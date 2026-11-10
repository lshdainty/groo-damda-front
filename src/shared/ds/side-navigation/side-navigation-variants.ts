/*
 * Side Navigation 의 클래스 · 상수 — 컴포넌트 파일은 컴포넌트만 내보낸다(빠른 새로 고침).
 * 값의 원본은 groo-design specs/components/side-navigation.yaml(src/shared/ds/spec/side-navigation.json).
 * 임의 값([24px] 등)은 스펙 JSON 값과 같은 것이다 — 토큰에 없는 숫자(끝 흐림 24 · 하위 시작 40 · 펼침 메뉴 200 · 접기 버튼 위 12)라 이유를 곁에 적었다.
 */

// ── 폭 · 기억 ────────────────────────────────────────────────
export const STORAGE_KEY = "porest:side-navigation-collapsed";
export const DESKTOP_QUERY = "(min-width: 768px)";
export const WIDE_QUERY = "(min-width: 1280px)";
// 펼침 메뉴 · 말풍선의 기다림(side-navigation.yaml flyout · tooltip)
export const FLYOUT_OPEN_DELAY = 200;
export const FLYOUT_CLOSE_DELAY = 100;

// ── 사이드바 ─────────────────────────────────────────────────
// 흰 면 + 오른쪽 안쪽 1px 선, 높이 전체 · 왼쪽에 붙는다. 폭 240 ↔ 56 200ms easing
// z-sticky(50) — sticky 라 스스로 쌓임 맥락이다. 층이 auto 면 뒤따르는 본문 카드가 그 위에 그려져 안에 그리는 펼침 메뉴를 가린다
// (side-navigation.yaml root.zIndex · 2026-11-09 그루 이음 셸)
export const ROOT = [
  "sticky top-0 z-(--z-sticky) flex h-dvh shrink-0 flex-col overflow-hidden bg-bg-layer-default font-sans text-fg-neutral",
  "shadow-[inset_-1px_0_0_0_var(--color-stroke-neutral-subtle)]",
  "[transition:width_var(--motion-duration-d4)_var(--motion-ease-easing)] motion-reduce:transition-none",
].join(" ");
export const ROOT_EXPANDED = "w-(--layout-sidebar)";
export const ROOT_COLLAPSED = "w-(--layout-sidebar-collapsed)";

// ── 머리 ─────────────────────────────────────────────────────
// 높이 64 · 안쪽 8. 내용이 위 끝에서 떨어지면 안쪽 아래 1px 선(150ms) — 내용은 흐림 마스크를 걸어 그 안에 그린 선은 흐려진다
export const HEADER = [
  "relative flex min-h-[64px] shrink-0 items-center p-x2",
  "[transition:box-shadow_var(--motion-duration-color-transition)_var(--motion-ease-easing)]",
  "[&:has(~[data-slot=side-navigation-content][data-scrolled])]:shadow-[inset_0_-1px_0_0_var(--color-stroke-neutral-subtle)]",
].join(" ");
// 로고 — 마크 24 + 이름 t5 · 700, 화면 끝에서 16. 접기 버튼 자리(40 + 12 = 52)를 비운다
export const LOGO =
  "ml-x2 mr-[52px] flex min-w-0 items-center gap-x2 overflow-hidden whitespace-nowrap text-t5-static font-bold text-fg-neutral [&>img]:size-[24px] [&>img]:shrink-0 [&>svg]:size-[24px] [&>svg]:shrink-0";
// 접기 버튼 — 40 · 아이콘 18 · 모서리 8 · 누르는 영역 44, 위 12 · 오른쪽 12(접히면 8)
export const TRIGGER = [
  "absolute top-x3 flex size-[40px] cursor-pointer items-center justify-center rounded-r2 border-0 bg-transparent p-0 text-fg-neutral-subtle [&>svg]:size-[18px]",
  "before:absolute before:left-1/2 before:top-1/2 before:size-[44px] before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']",
  "[transition:background-color_var(--motion-duration-color-transition)_var(--motion-ease-easing),scale_var(--motion-duration-pressed-scale)_var(--motion-ease-pressed-scale)]",
  "hover:bg-bg-layer-default-pressed active:bg-bg-layer-default-pressed active:[scale:calc(1-2/40)] motion-reduce:active:[scale:1]",
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-stroke-focus-ring",
].join(" ");

// ── 내용 ─────────────────────────────────────────────────────
// 아래 끝 24 를 늘 흐린다 — gradient-fade-mask(방향 없는 위 → 아래 토큰)를 아래에서 위로 붙여 내용 상자에 건다(사이드바의 제 안개)
export const FOG_DEPTH = "24px";
// 내용 — 위 8 · 좌우 8 · 아래 24(흐림 깊이), 묶음 사이 8(접히면 0 — 선으로 가른다). 키보드로 옮긴 항목이 흐림 아래 멈추지 않게 스크롤 여유
export const CONTENT =
  "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-x2 pb-[24px] pt-x2 scroll-pb-[24px] scroll-pt-x2";

// ── 묶음 ─────────────────────────────────────────────────────
// 묶음 이름 — t4 · 700 · fg-neutral-muted · 안쪽 6(글은 화면 끝에서 14). 길면 단어 단위로 줄을 바꾼다
export const GROUP_LABEL =
  "p-x1_5 text-t4 font-bold text-fg-neutral-muted break-keep [overflow-wrap:break-word]";
// 접혔을 때 — 앞 묶음과의 사이에 1px 선(위아래 8 · 좌우 8)
export const GROUP_DIVIDER =
  "[[data-slot=side-navigation-group]+&]:before:mx-x2 [[data-slot=side-navigation-group]+&]:before:my-x2 [[data-slot=side-navigation-group]+&]:before:block [[data-slot=side-navigation-group]+&]:before:h-px [[data-slot=side-navigation-group]+&]:before:bg-stroke-neutral-subtle [[data-slot=side-navigation-group]+&]:before:content-['']";

// ── 항목 ─────────────────────────────────────────────────────
// 항목 — 최소 44 · 좌우 8 · 모서리 10, 키보드 포커스에 안쪽 2px 링. 바탕은 지금 항목 · 호버 · 누름에만
// 펼침 ↔ 접힘에 좌우 여백(8 ↔ 10)도 사이드바 폭과 같이 200ms 로 바뀐다(모션 줄이기면 바로)
export const ITEM = [
  "group/side-navigation-item relative flex min-h-[44px] w-full items-center rounded-r2_5 border-0 bg-transparent px-x2 text-left font-sans no-underline",
  "[transition:background-color_var(--motion-duration-color-transition)_var(--motion-ease-easing),padding_var(--motion-duration-d4)_var(--motion-ease-easing)]",
  "motion-reduce:[transition:background-color_var(--motion-duration-color-transition)_var(--motion-ease-easing)]",
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-stroke-focus-ring",
].join(" ");
// 접힘 — 40(56 − 좌우 8) · 좌우 10, 아이콘이 화면 끝에서 18
// 보이는 폭 40 은 스펙(56 − 안쪽 8 × 2) 그대로 — 누르는 영역만 ::before 로 가로 44 까지 넓힌다(높이는 이미 44)
export const ITEM_COLLAPSED =
  "w-[40px] px-x2_5 before:absolute before:inset-y-0 before:left-1/2 before:w-[44px] before:-translate-x-1/2 before:content-['']";
export const ITEM_HOVER =
  "cursor-pointer hover:bg-bg-layer-default-pressed active:bg-bg-layer-default-pressed";
// 지금 항목 — 한 단계 짙은 옅은 회색, 마우스를 올리거나 눌러도 그대로
export const ITEM_CURRENT = "cursor-pointer bg-bg-neutral-weak-pressed";
export const ITEM_DISABLED = "cursor-not-allowed";
// 콘텐츠 층 — 아이콘 ↔ 이름 12. 누르는 동안만 2px 거리 축소(바탕은 그대로)
export const ITEM_CONTENT =
  "relative flex min-w-0 flex-1 items-center gap-x3 [transition:scale_var(--motion-duration-pressed-scale)_var(--motion-ease-pressed-scale)]";
export const ITEM_CONTENT_PRESS =
  "group-active/side-navigation-item:[scale:calc(1-2/var(--press-basis))] motion-reduce:group-active/side-navigation-item:[scale:1]";
export const ITEM_ICON = "flex shrink-0 [&>svg]:size-[20px]";
// 이름 — t4 · 500 · 위아래 6, 단어 단위로 줄을 바꾼다(말줄임 없음)
export const ITEM_LABEL =
  "min-w-0 flex-1 py-x1_5 text-t4 font-medium break-keep [overflow-wrap:break-word]";

export const tone = (current: boolean, disabled: boolean) =>
  disabled
    ? { icon: "text-fg-disabled", label: "text-fg-disabled" }
    : current
      ? { icon: "text-fg-neutral", label: "text-fg-neutral" }
      : { icon: "text-fg-neutral-subtle", label: "text-fg-neutral-muted" };

// 꺾쇠 — 16 · fg-neutral-subtle, 펼치면 위로(300ms — 하위 펼침과 같은 시간, 모션 줄이기면 바로)
export const CHEVRON =
  "size-[16px] shrink-0 text-fg-neutral-subtle [transition:rotate_var(--motion-duration-d6)_var(--motion-ease-easing)] motion-reduce:transition-none";

// 하위 목록 — 높이 · 투명도로 펼친다(300ms — Accordion 과 같다). 접히면 다 접힌 뒤 보이지 않게(보조 기술 · Tab 에서 빠진다).
// 모션 줄이기면 높이는 바로 바꾸고 투명도만 150ms — 접을 때는 다 흐려진 뒤 높이를 접는다
export const SUB_LIST = "grid";
export const SUB_LIST_OPEN = [
  "visible grid-rows-[1fr] opacity-100",
  "[transition:grid-template-rows_var(--motion-duration-d6)_var(--motion-ease-easing),opacity_var(--motion-duration-d6)_var(--motion-ease-easing),visibility_0s]",
  "motion-reduce:[transition:opacity_var(--motion-duration-d3)_var(--motion-ease-easing),visibility_0s]",
].join(" ");
export const SUB_LIST_CLOSED = [
  "invisible grid-rows-[0fr] opacity-0",
  "[transition:grid-template-rows_var(--motion-duration-d6)_var(--motion-ease-easing),opacity_var(--motion-duration-d6)_var(--motion-ease-easing),visibility_0s_linear_var(--motion-duration-d6)]",
  "motion-reduce:[transition:grid-template-rows_0s_linear_var(--motion-duration-d3),opacity_var(--motion-duration-d3)_var(--motion-ease-easing),visibility_0s_linear_var(--motion-duration-d3)]",
].join(" ");

// ── 펼침 메뉴 ────────────────────────────────────────────────
// Menu 표면(폭 200 · 모서리 20 · 떠 있는 바탕 + s3 · 위아래 8 · z-floating). 150ms enter · 100ms exit 로 0.95 ↔ 1 · 투명도
export const FLYOUT = [
  "z-(--z-floating) w-[200px] overflow-hidden rounded-r5 bg-bg-layer-floating py-x2 font-sans text-fg-neutral shadow-[var(--shadow-s3)] outline-none",
  "origin-[var(--radix-popover-content-transform-origin)]",
  "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:[--tw-animation-duration:var(--motion-duration-d3)] data-[state=open]:ease-[var(--motion-ease-enter)] motion-safe:data-[state=open]:zoom-in-95",
  "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:[--tw-animation-duration:var(--motion-duration-d2)] data-[state=closed]:ease-[var(--motion-ease-exit)] motion-safe:data-[state=closed]:zoom-out-95",
].join(" ");
// 펼침 메뉴의 묶음 이름 — 부모 이름. t3 · 400 · fg-neutral-subtle · 위아래 8 · 좌우 16
export const FLYOUT_LABEL =
  "px-x4 py-x2 text-t3 font-normal text-fg-neutral-subtle break-keep [overflow-wrap:break-word]";

// ── 하위 항목 ────────────────────────────────────────────────
// 부모 아래 목록 — 최소 44 · 이름이 부모 이름과 같은 자리(8 + 아이콘 20 + 12 = 40)
export const SUB_ITEM = "pl-[40px] pr-x2";
// 펼침 메뉴의 줄 — 최소 44 · 좌우 16 · t4 · 400 · fg-neutral. 키보드 포커스는 알약 자리(좌우 8 · 모서리 12)의 안쪽 링
export const FLYOUT_ITEM = [
  "group/side-navigation-flyout-item relative flex min-h-[44px] items-center px-x4 font-sans text-t4 font-normal no-underline outline-none scroll-my-x2",
  "after:pointer-events-none after:absolute after:inset-y-0 after:inset-x-x2 after:rounded-r3 after:content-['']",
  "focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-stroke-focus-ring",
].join(" ");
// 알약 — 마우스를 올리거나 누르면 좌우 8 들어오며 칠해진다. 지금 화면 줄은 늘 bg-neutral-weak-pressed
export const FLYOUT_PILL =
  "pointer-events-none absolute inset-y-0 rounded-r3 [transition:background-color_var(--motion-duration-color-transition)_var(--motion-ease-easing),inset_var(--motion-duration-color-transition)_var(--motion-ease-easing)]";
export const FLYOUT_PILL_OTHER =
  "inset-x-0 bg-transparent group-hover/side-navigation-flyout-item:inset-x-x2 group-hover/side-navigation-flyout-item:bg-bg-layer-floating-pressed group-active/side-navigation-flyout-item:inset-x-x2 group-active/side-navigation-flyout-item:bg-bg-layer-floating-pressed";
export const FLYOUT_PILL_CURRENT = "inset-x-x2 bg-bg-neutral-weak-pressed";
export const FLYOUT_ITEM_CONTENT =
  "relative min-w-0 flex-1 break-keep [overflow-wrap:break-word] [transition:scale_var(--motion-duration-pressed-scale)_var(--motion-ease-pressed-scale)]";
export const FLYOUT_ITEM_CONTENT_PRESS =
  "group-active/side-navigation-flyout-item:[scale:calc(1-2/var(--press-basis))] motion-reduce:group-active/side-navigation-flyout-item:[scale:1]";

// ── 바닥 ─────────────────────────────────────────────────────
// 계정 · 보조 링크 — 고정, 안쪽 8. 비면 그리지 않는다
export const FOOTER = "shrink-0 p-x2";
