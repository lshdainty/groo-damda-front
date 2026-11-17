/*
 * Groo Bottom Sheet 의 모양 — 수치 원본은 groo-design specs/components/bottom-sheet.yaml(값은 src/shared/ds/spec/bottom-sheet.json).
 * groo-design recipes/shadcn/components/ui/bottom-sheet.tsx 를 첫 판으로 가져왔다 — 이 파일은 모양 정의,
 * 컴포넌트는 bottom-sheet.tsx 다(컴포넌트 파일은 컴포넌트만 내보낸다 — 빠른 새로 고침).
 */

// 딤 — 300ms enter 로 나타나고 200ms exit 로 사라진다(모션 줄이기면 150ms). 끌다 놓아 제자리로 갈 때도 200ms exit 로 돌아오고,
// 끄는 동안(바로 뒤 시트에 .vaul-dragging)은 손가락을 바로 따른다
export const SHEET_OVERLAY = [
  "fixed inset-0 z-(--z-modal) bg-[var(--overlay-dim-light)] dark:bg-[var(--overlay-dim-dark)]",
  "[animation-duration:var(--sheet-anim-duration)]! [animation-timing-function:var(--sheet-anim-ease)]!",
  "data-[state=open]:[--sheet-anim-duration:var(--motion-duration-d6)] data-[state=open]:[--sheet-anim-ease:var(--motion-ease-enter)]",
  "data-[state=closed]:[--sheet-anim-duration:var(--motion-duration-d4)] data-[state=closed]:[--sheet-anim-ease:var(--motion-ease-exit)]",
  "motion-reduce:data-[state]:[--sheet-anim-duration:var(--motion-duration-d3)]",
  "[&:not(:has(+.vaul-dragging))]:[transition:opacity_var(--motion-duration-d4)_var(--motion-ease-exit)]!",
].join(" ");

// 시트 — 최대 480 가운데, 위 모서리 r6, 내용만큼(최대 화면 높이의 90%), 바닥 아래 안전 영역. z-modal-content 101.
// 열림 300ms enter-expressive · 닫힘 200ms exit(vaul 의 slideFromBottom · slideToBottom 그대로, 시간 · 곡선만).
// vaul 이 넣는 0.5s 는 덮는다 — vaul 의 CSS 는 나중에 들어오고 끌다 놓을 때는 인라인으로 넣으므로 !important 로 이긴다
export const SHEET_CONTENT = [
  "fixed inset-x-0 bottom-0 z-(--z-modal-content) mx-auto flex max-h-[90dvh] w-full max-w-[480px] flex-col",
  "rounded-t-r6 bg-bg-layer-floating pb-[env(safe-area-inset-bottom)] font-sans text-fg-neutral outline-none",
  "[animation-duration:var(--sheet-anim-duration)]! [animation-timing-function:var(--sheet-anim-ease)]!",
  "data-[state=open]:[--sheet-anim-duration:var(--motion-duration-d6)] data-[state=open]:[--sheet-anim-ease:var(--motion-ease-enter-expressive)]",
  "data-[state=closed]:[--sheet-anim-duration:var(--motion-duration-d4)] data-[state=closed]:[--sheet-anim-ease:var(--motion-ease-exit)]",
  // 끌다 놓아 제자리로 200ms exit · 스냅 높이 사이 300ms enter-expressive. 끄는 동안은 손가락을 바로 따른다
  "[&:not(.vaul-dragging)]:[transition:transform_var(--sheet-move-duration)_var(--sheet-move-ease)]!",
  "[--sheet-move-duration:var(--motion-duration-d4)] [--sheet-move-ease:var(--motion-ease-exit)]",
  "data-[vaul-snap-points=true]:[--sheet-move-duration:var(--motion-duration-d6)] data-[vaul-snap-points=true]:[--sheet-move-ease:var(--motion-ease-enter-expressive)]",
  // 모션 줄이기 — 미끄러지지 않고 150ms 서서히 나타나고 사라진다. 제자리 · 스냅 이동은 바로
  "motion-reduce:data-[state=open]:[animation-name:fadeIn]! motion-reduce:data-[state=closed]:[animation-name:fadeOut]!",
  "motion-reduce:data-[state]:data-[vaul-drawer]:[--sheet-anim-duration:var(--motion-duration-d3)]",
  "motion-reduce:data-[vaul-drawer]:data-[vaul-snap-points]:[--sheet-move-duration:0s]",
].join(" ");

// 높이 상한 비율 — 위 max-h-[90dvh] 와 같은 값. 키보드가 떠 있는 동안은 보이는 영역 높이에 이 비율을 건다(useKeyboardViewport)
export const SHEET_MAX_HEIGHT_RATIO = 0.9;

// 머리 — 위 24 · 아래 16 · 좌우 화면 여백 24 · 제목 ↔ 설명 8
export const SHEET_HEADER =
  "flex shrink-0 flex-col gap-x2 px-global-gutter pb-x4 pt-x6";
// 제목 t8 22 / 30 · 700 — 닫기 버튼이 있으면 오른쪽 64(24 + 원 28 + 12)를 비운다
export const SHEET_TITLE = "m-0 text-t8 font-bold text-fg-neutral";
export const SHEET_TITLE_WITH_CLOSE = "pr-x10";
// 머리 오른쪽 동작(headerAction) — 닫기 단추 왼쪽 사이 4, 36 ghost iconOnly 단추 하나. 제목은 남은 폭(닫기 40 + 사이 4 + 동작 36)을 비운다
export const SHEET_TITLE_WITH_ACTION =
  "pr-[calc(var(--spacing-x10)+var(--spacing-x1)+36px)]";
// 닫기(28 px) 왼쪽 사이 4 · 세로는 닫기 가운데에 맞춘다(동작 단추는 36 px)
export const SHEET_HEADER_ACTION =
  "absolute right-[calc(var(--spacing-global-gutter)+28px+var(--spacing-x1))] top-[calc(var(--spacing-x6)+14px)] z-1 flex -translate-y-1/2 items-center";
// 머리 왼쪽 뒤로 가기(onBack) — 보이는 40 · 아이콘 24 · 누르는 44(::before). 아이콘이 화면 여백 24 에 오도록 상자를 8 당기고,
// 세로는 제목 첫 줄(30) 가운데에 맞춘다. 제목은 상자 오른쪽 사이 4 에서 시작한다(36 px)
export const SHEET_TITLE_WITH_BACK = "pl-[36px]";
export const SHEET_BACK = [
  "absolute left-[calc(var(--spacing-global-gutter)-8px)] top-[calc(var(--spacing-x6)+15px)] z-1 flex size-[40px] -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-fg-neutral [&>svg]:size-[24px]",
  "before:absolute before:left-1/2 before:top-1/2 before:size-[44px] before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']",
  "[transition:background-color_var(--motion-duration-color-transition)_var(--motion-ease-easing)]",
  "hover:bg-bg-neutral-weak-pressed active:bg-bg-neutral-weak-pressed",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus-ring",
].join(" ");
// 설명 t5 16 / 22 · fg-neutral-muted
export const SHEET_DESCRIPTION =
  "m-0 text-t5 font-normal text-fg-neutral-muted";

// 닫기 — 28 원 · 아이콘 14, 누르는 영역 44(::before). 누르면 bg-neutral-weak-pressed + 2px 거리 축소(기준 28 → 0.929), 호버도 누름 색
export const SHEET_CLOSE = [
  "absolute right-global-gutter top-x6 flex size-[28px] cursor-pointer items-center justify-center rounded-full border-0 bg-bg-neutral-weak p-0 text-fg-neutral [&>svg]:size-[14px]",
  "before:absolute before:left-1/2 before:top-1/2 before:size-[44px] before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']",
  "[transition:background-color_var(--motion-duration-color-transition)_var(--motion-ease-easing),scale_var(--motion-duration-pressed-scale)_var(--motion-ease-pressed-scale)]",
  "hover:bg-bg-neutral-weak-pressed active:bg-bg-neutral-weak-pressed [--press-basis:28] active:[scale:calc(1-2/var(--press-basis))] motion-reduce:active:[scale:1]",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus-ring",
].join(" ");

// 손잡이 — 36 × 4 · 위 6 가운데, 누르는 영역 44. 누름 색은 두지 않는다(bottom-sheet.yaml)
export const SHEET_HANDLE = [
  "absolute left-1/2 top-x1_5 h-[4px] w-[36px] -translate-x-1/2 cursor-pointer rounded-full bg-stroke-neutral-weak",
  "before:absolute before:left-1/2 before:top-1/2 before:size-[44px] before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']",
].join(" ");

// 본문 — 좌우 화면 여백 24, 넘치면 이 안에서 스크롤. 바닥이 없어 맨 끝이면 아래 16(바닥의 아래 여백).
// 끝에 닿아도 뒤 화면이 따라 스크롤되지 않는다(overscroll-behavior: contain — Scroll Area, 2026-10-10)
export const SHEET_BODY =
  "min-h-0 flex-1 overflow-y-auto overscroll-contain px-global-gutter";
export const SHEET_BODY_PLAIN = "last:pb-x4";
// 끝 흐림(scrollFog) — 본문 안 여백 위 20 · 아래 80(바닥이 있어도), 스크롤 여유도 위 20 · 아래 80
export const SHEET_BODY_FOG =
  "pt-[20px] pb-[80px] scroll-pt-[20px] scroll-pb-[80px]";

// 바닥 — 위 12 · 아래 16(그 아래 안전 영역은 시트가 둔다), 버튼 하나면 폭 전체 · 둘이면 반씩(사이 8). Button large 48
// 짝 버튼은 ResponsivePair(03A-013 A): 한 라벨이 반 폭을 넘으면(min-content = 한 줄 라벨) 세로로 쌓고 뒤 버튼(주)이 위로 간다 — wrap-reverse
// 짝 버튼 판정은 ResponsivePair(button 폴더)가 맡는다 — 여기는 바닥 자리 여백만(I-01 결정 6A)
export const SHEET_FOOTER = "shrink-0 px-global-gutter pb-x4 pt-x3";

// 시트 위의 시트(폼 시트 위 고르기 시트 — bottom-sheet.md "폼 시트 위에는 고르기 시트와 확인창만") — 같은 층(100 · 101)이면 딤이 아래 시트 뒤에 가려
// 두 시트가 한 면처럼 붙어 보인다. 딤을 아래 시트(101) 바로 위로, 위 시트를 그 딤 위로 올린다(Popover 200 · Alert Dialog 300 보다 아래).
export const SHEET_NESTED_OVERLAY = "z-[calc(var(--z-modal-content)+1)]";
export const SHEET_NESTED_CONTENT = "z-[calc(var(--z-modal-content)+2)]";
