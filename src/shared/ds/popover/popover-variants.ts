/*
 * Groo Popover 의 모양 — 수치 원본은 groo-design specs/components/popover.yaml(값은 src/shared/ds/spec/popover.json).
 * groo-design recipes/shadcn/components/ui/popover.tsx 를 첫 판으로 가져왔다. 이 파일은 모양 정의(클래스 · 자리 상수),
 * 컴포넌트는 popover.tsx 다(컴포넌트 파일은 컴포넌트만 내보낸다 — 빠른 새로 고침).
 */

// 표면 — 폭 320 ~ 480(가용 폭까지) · 높이 600(가용 높이까지), 모서리 r5 20 · 그림자 s3 · z-floating 200.
// 열림 150ms enter 로 트리거 쪽 변에서 0.95 → 1 · 투명도, 닫힘 100ms exit 로 0.95 · 투명도(모션 줄이기면 투명도만).
// 가용 폭 · 높이는 Radix 가 자리를 잰 뒤에 들어온다 — 그 전에는 320 · 480 · 600 으로 둔다.
// 길이는 --tw-animation-duration 으로 준다 — duration-* 는 transition-duration 도 바꿔 테마를 바꿀 때 색까지 번지게 한다
export const POPOVER = [
  "relative z-(--z-floating) box-border flex flex-col overflow-hidden rounded-r5 bg-bg-layer-floating font-sans text-fg-neutral shadow-[var(--shadow-s3)] outline-none",
  "min-w-[min(320px,var(--radix-popover-content-available-width,320px))] max-w-[min(480px,var(--radix-popover-content-available-width,480px))]",
  "max-h-[min(600px,var(--radix-popover-content-available-height,600px))]",
  "origin-[var(--radix-popover-content-transform-origin)]",
  "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:[--tw-animation-duration:var(--motion-duration-d3)] data-[state=open]:ease-[var(--motion-ease-enter)] motion-safe:data-[state=open]:zoom-in-95",
  "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:[--tw-animation-duration:var(--motion-duration-d2)] data-[state=closed]:ease-[var(--motion-ease-exit)] motion-safe:data-[state=closed]:zoom-out-95",
].join(" ");

// 머리 — 위 24 · 좌우 24 · 아래 16 · 사이 6, 오른쪽 52(닫기 — pr-x13). 본문이 위로 스크롤되면 안쪽 아래 1px stroke-neutral-subtle(150ms) —
// 본문이 흐림 마스크를 걸어도 선이 흐려지지 않게 머리에 그린다
export const POPOVER_HEADER = [
  "flex shrink-0 flex-col gap-x1_5 px-x6 pb-x4 pr-x13 pt-x6",
  "[transition:box-shadow_var(--motion-duration-color-transition)_var(--motion-ease-easing)]",
  "[&:has(~[data-slot=popover-body][data-scrolled])]:shadow-[inset_0_-1px_0_0_var(--color-stroke-neutral-subtle)]",
].join(" ");

// 제목 t7 20 / 27 · 700 — 단어 단위 줄바꿈. 설명 t4 14 / 19 · 400 fg-neutral-muted
export const POPOVER_TITLE =
  "m-0 text-t7 font-bold text-fg-neutral break-keep [overflow-wrap:break-word]";
export const POPOVER_DESCRIPTION =
  "m-0 text-t4 font-normal text-fg-neutral-muted";

// 닫기 — 52 투명 상자 · 아이콘 22. 아이콘이 위 27 · 오른쪽 24 에 오도록 상자를 15 당긴다(top 12 · right 24 − 15) — 제목 첫 줄 가운데다.
// 글자를 키워 제목(t7) 줄이 높아지면 늘어난 만큼의 절반을 더 내린다(상자 · 아이콘은 그대로).
// 누르면 bg-layer-floating-pressed + 2px 거리 축소(기준 52). 호버는 누름 색
export const POPOVER_CLOSE = [
  "absolute right-[calc(var(--spacing-x6)-15px)] top-[calc(12px+(var(--text-t7--line-height)_-_27px)/2)] flex size-[52px] cursor-pointer items-center justify-center",
  "rounded-r3 border-0 bg-transparent p-0 text-fg-neutral-subtle [&>svg]:size-[22px]",
  "[transition:background-color_var(--motion-duration-color-transition)_var(--motion-ease-easing),scale_var(--motion-duration-pressed-scale)_var(--motion-ease-pressed-scale)]",
  "hover:bg-bg-layer-floating-pressed active:bg-bg-layer-floating-pressed [--press-basis:52] active:[scale:calc(1-2/var(--press-basis))] motion-reduce:active:[scale:1]",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus-ring",
].join(" ");

// 본문 — 좌우 24, 맨 앞(머리가 없을 때)이면 위 24 · 맨 끝(바닥이 없을 때)이면 아래 24. 끝에서 뒤 화면을 끌고 가지 않는다
export const POPOVER_BODY = [
  "min-h-0 flex-1 overflow-y-auto overscroll-contain px-x6 first:pt-x6",
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-stroke-focus-ring",
].join(" ");
export const POPOVER_BODY_PLAIN = "last:pb-x6";
// 끝 흐림(scrollFog) — 본문 안 여백 위 20 · 아래 80(바닥이 있어도), 스크롤 여유도 위 20 · 아래 80
export const POPOVER_BODY_FOG =
  "pt-[20px] pb-[80px] scroll-pt-[20px] scroll-pb-[80px]";

// 바닥 — 위 16 · 좌우 24 · 아래 24, 오른쪽 정렬, 사이 8. Button small 36
export const POPOVER_FOOTER =
  "flex shrink-0 items-center justify-end gap-x2 px-x6 pb-x6 pt-x4";

// 자리 — 트리거와 8 · 화면 가장자리와 16(popover.yaml root.offset). 아래, 모자라면 위
export const POPOVER_POSITION = {
  side: "bottom",
  align: "center",
  sideOffset: 8,
  collisionPadding: 16,
} as const;
