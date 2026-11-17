/*
 * Groo Dialog 의 모양 — 수치 원본은 groo-design specs/components/dialog.yaml(값은 src/shared/ds/spec/dialog.json).
 * groo-design recipes/shadcn/components/ui/dialog.tsx 를 첫 판으로 가져왔다 — 이 파일은 모양 정의,
 * 컴포넌트는 dialog.tsx 다(컴포넌트 파일은 컴포넌트만 내보낸다 — 빠른 새로 고침).
 */

// 딤 — 100ms 로 나타나고 사라진다. z-modal 100(L2)
export const DIALOG_OVERLAY = [
  "fixed inset-0 z-(--z-modal) bg-[var(--overlay-dim-light)] dark:bg-[var(--overlay-dim-dark)]",
  "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:[--tw-animation-duration:var(--motion-duration-d2)] data-[state=open]:ease-[var(--motion-ease-enter)]",
  "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:[--tw-animation-duration:var(--motion-duration-d2)] data-[state=closed]:ease-[var(--motion-ease-exit)]",
].join(" ");

// 대화상자 — 정중앙, 좌우 20 은 남긴다, 높이는 화면의 80% 까지(dvh). z-modal-content 101. 열림 200ms enter-expressive 로 1.3 배에서
// 줄며 나타난다(모션 줄이기면 150ms 서서히). 닫힘 100ms exit 로 줄지 않고 사라진다.
// 길이는 --tw-animation-duration 으로 준다 — duration-* 는 transition-duration 도 바꿔 테마를 바꿀 때 색까지 번지게 한다
export const DIALOG_CONTENT = [
  "fixed left-1/2 top-1/2 z-(--z-modal-content) flex max-h-[80dvh] max-w-[calc(100%-var(--spacing-x5)*2)] -translate-x-1/2 -translate-y-1/2 flex-col",
  "overflow-hidden rounded-r5 bg-bg-layer-floating font-sans text-fg-neutral outline-none",
  "data-[state=open]:animate-in data-[state=open]:fade-in-0",
  "motion-safe:data-[state=open]:zoom-in-130 motion-safe:data-[state=open]:[--tw-animation-duration:var(--motion-duration-d4)] motion-safe:data-[state=open]:ease-[var(--motion-ease-enter-expressive)]",
  "motion-reduce:data-[state=open]:[--tw-animation-duration:var(--motion-duration-d3)] motion-reduce:data-[state=open]:ease-[var(--motion-ease-enter)]",
  "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:[--tw-animation-duration:var(--motion-duration-d2)] data-[state=closed]:ease-[var(--motion-ease-exit)]",
].join(" ");

// 높이 상한 비율 — 위 max-h-[80dvh] 와 같은 값. 키보드가 떠 있는 동안은 보이는 영역 높이에 이 비율을 건다(useKeyboardViewport)
export const DIALOG_MAX_HEIGHT_RATIO = 0.8;

export const DIALOG_SIZE = { medium: "w-[480px]", large: "w-[800px]" } as const;

// 머리 — 위 24 · 좌우 24 · 아래 16 · 사이 6. 본문이 위로 스크롤되면 안쪽 아래 1px stroke-neutral-subtle(150ms) — 본문이 흐림 마스크를
// 걸어도 선이 흐려지지 않게 머리에 그린다. --dialog-divider 는 선 색의 이름표다(검사기가 색을 읽는다)
export const DIALOG_HEADER = [
  "flex shrink-0 flex-col gap-x1_5 px-x6 pb-x4 pt-x6 [--dialog-divider:var(--color-stroke-neutral-subtle)]",
  "[transition:box-shadow_var(--motion-duration-color-transition)_var(--motion-ease-easing)]",
  "[&:has(~[data-slot=dialog-body][data-scrolled])]:shadow-[inset_0_-1px_0_0_var(--dialog-divider)]",
].join(" ");
// 닫기 버튼이 있으면 머리 오른쪽 52(24 + 아이콘 22 + 6)
export const DIALOG_HEADER_WITH_CLOSE = "pr-x13";
// 머리 오른쪽 동작(headerAction) — 닫기 단추가 있으면 그 왼쪽 사이 4, 없으면(입력 폼) 오른쪽 끝. 제목이 남은 폭에서 줄을 바꾼다
export const DIALOG_HEADER_WITH_ACTION_CLOSE =
  "pr-[calc(var(--spacing-x13)+var(--spacing-x1)+36px+var(--spacing-x2))]";
export const DIALOG_HEADER_WITH_ACTION =
  "pr-[calc(var(--spacing-x4)+36px+var(--spacing-x2))]";
export const DIALOG_HEADER_ACTION_CLOSE =
  "absolute right-[calc(var(--spacing-x6)+22px+var(--spacing-x1))] top-[39px] z-1 flex -translate-y-1/2 items-center";
export const DIALOG_HEADER_ACTION =
  "absolute right-x4 top-[39px] z-1 flex -translate-y-1/2 items-center";
// 머리 왼쪽 뒤로 가기(onBack) — 시트와 같은 값: 보이는 40 · 아이콘 24 · 누르는 44, 아이콘이 왼쪽 24 에 오고 제목은 상자 오른쪽 사이 4 에서 시작한다
export const DIALOG_TITLE_WITH_BACK = "pl-[36px]";
export const DIALOG_BACK = [
  "absolute left-[calc(var(--spacing-x6)-8px)] top-[calc(var(--spacing-x6)+15px)] z-1 flex size-[40px] -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-fg-neutral [&>svg]:size-[24px]",
  "before:absolute before:left-1/2 before:top-1/2 before:size-[44px] before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']",
  "[transition:background-color_var(--motion-duration-color-transition)_var(--motion-ease-easing)]",
  "hover:bg-bg-neutral-weak-pressed active:bg-bg-neutral-weak-pressed",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus-ring",
].join(" ");
export const DIALOG_TITLE = "m-0 text-t8 font-bold text-fg-neutral";
export const DIALOG_DESCRIPTION =
  "m-0 text-t5 font-normal text-fg-neutral-muted";

// 닫기 — 52 투명 상자 · 아이콘 22 fg-neutral-subtle. 아이콘이 위 28 · 오른쪽 24 에 오도록 상자를 (52 − 22) ÷ 2 = 15 만큼 당긴다.
// 누르면 bg-layer-floating-pressed + 2px 거리 축소(기준 52 → 0.962), 호버도 누름 색
export const DIALOG_CLOSE = [
  "absolute right-[calc(var(--spacing-x6)-15px)] top-[calc(var(--spacing-x7)-15px)] flex size-[52px] cursor-pointer items-center justify-center",
  "rounded-r3 border-0 bg-transparent p-0 text-fg-neutral-subtle [&>svg]:size-[22px]",
  "[transition:background-color_var(--motion-duration-color-transition)_var(--motion-ease-easing),scale_var(--motion-duration-pressed-scale)_var(--motion-ease-pressed-scale)]",
  "hover:bg-bg-layer-floating-pressed active:bg-bg-layer-floating-pressed [--press-basis:52] active:[scale:calc(1-2/var(--press-basis))] motion-reduce:active:[scale:1]",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus-ring",
].join(" ");

// 본문 — 좌우 24, 이 안에서만 스크롤. 맨 앞 자식(머리가 없으면)이면 위 24, 맨 끝 자식(바닥이 없으면)이면 아래 24.
// 끝에 닿아도 뒤 화면이 따라 스크롤되지 않는다(overscroll-behavior: contain — Scroll Area, 2026-10-10)
export const DIALOG_BODY = [
  "min-h-0 flex-1 overflow-y-auto overscroll-contain px-x6 first:pt-x6",
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-stroke-focus-ring",
].join(" ");
export const DIALOG_BODY_PLAIN = "last:pb-x6";
// 끝 흐림(scrollFog) — 본문 안 여백 위 20(머리가 없으면 24 그대로) · 아래 80(바닥이 있어도), 스크롤 여유도 위 20 · 아래 80
export const DIALOG_BODY_FOG =
  "pt-[20px] pb-[80px] scroll-pt-[20px] scroll-pb-[80px]";

// 바닥 — 위 16 · 좌우 24 · 아래 24, 오른쪽 정렬 [취소] [저장], 사이 8. Button small 36
export const DIALOG_FOOTER =
  "flex shrink-0 items-center justify-end gap-x2 px-x6 pb-x6 pt-x4";
