/*
 * Groo Alert Dialog 의 모양 — 수치 원본은 groo-design specs/components/alert-dialog.yaml(값은 src/shared/ds/spec/alert-dialog.json).
 * groo-design recipes/shadcn/components/ui/alert-dialog.tsx 를 첫 판으로 가져왔다 — 이 파일은 모양 정의,
 * 컴포넌트는 alert-dialog.tsx 다(컴포넌트 파일은 컴포넌트만 내보낸다 — 빠른 새로 고침).
 */
import { CLOSING_INERT } from "@/shared/ds/overlay/closing-surface";

import { OVERLAY_DIM_BOUNDS } from "@/shared/ds/overlay/dim-bounds";

// 딤 — overlay-dim 라이트 0.50 · 다크 0.65, z-alert 300(L5 — 열린 대화상자 · 시트 위). 100ms 로 나타나고 사라진다
export const ALERT_OVERLAY = [
  // 덮는 범위 — 화면 위아래로 넘친다(키보드 아래 띠까지, overlay/dim-bounds.ts)
  OVERLAY_DIM_BOUNDS,
  "z-(--z-alert) bg-[var(--overlay-dim-light)] dark:bg-[var(--overlay-dim-dark)]",
  "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:[--tw-animation-duration:var(--motion-duration-d2)] data-[state=open]:ease-[var(--motion-ease-enter)]",
  "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:[--tw-animation-duration:var(--motion-duration-d2)] data-[state=closed]:ease-[var(--motion-ease-exit)]",
  // 사라지는 100ms 동안 누름을 흘려보낸다(overlay/closing-surface.ts)
  CLOSING_INERT,
].join(" ");

// 확인창 — 높이는 화면까지(max-height 100%), 넘치면 확인창 전체(버튼 포함)가 스크롤한다(03-F 1A — SEED alert-dialog.css). 최대 272, 좌우 32 를 남긴다(화면이 336 보다 좁으면 화면 폭 − 64). 안쪽 20 · 모서리 20, 그림자 없음, z-alert-content 301.
// 열림 200ms enter-expressive 로 1.3 배에서 줄며 나타난다(모션 줄이기면 150ms 서서히). 닫힘 100ms exit 로 줄지 않고 사라진다.
// 길이는 --tw-animation-duration 으로 준다 — duration-* 는 transition-duration 도 바꿔 테마를 바꿀 때 색까지 번지게 한다
export const ALERT_CONTENT = [
  "fixed left-1/2 top-1/2 z-(--z-alert-content) flex w-[calc(100%-var(--spacing-x8)*2)] max-w-[272px] -translate-x-1/2 -translate-y-1/2 flex-col",
  "max-h-full overflow-y-auto rounded-r5 bg-bg-layer-floating p-x5 font-sans text-fg-neutral outline-none",
  "data-[state=open]:animate-in data-[state=open]:fade-in-0",
  "motion-safe:data-[state=open]:zoom-in-130 motion-safe:data-[state=open]:[--tw-animation-duration:var(--motion-duration-d4)] motion-safe:data-[state=open]:ease-[var(--motion-ease-enter-expressive)]",
  "motion-reduce:data-[state=open]:[--tw-animation-duration:var(--motion-duration-d3)] motion-reduce:data-[state=open]:ease-[var(--motion-ease-enter)]",
  "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:[--tw-animation-duration:var(--motion-duration-d2)] data-[state=closed]:ease-[var(--motion-ease-exit)]",
  // 사라지는 100ms 동안 누름을 흘려보낸다(overlay/closing-surface.ts)
  CLOSING_INERT,
].join(" ");

// 제목 t7 20 / 27 · 700
export const ALERT_TITLE = "m-0 text-t7 font-bold text-fg-neutral";

// 설명 t5 16 / 22 — 다른 떠 있는 표면과 달리 짙은 fg-neutral(꼭 읽어야 할 말이다). 제목 아래 6, 제목이 없으면 0
export const ALERT_DESCRIPTION =
  "m-0 text-t5 font-normal text-fg-neutral [[data-slot=alert-dialog-title]+&]:mt-x1_5";

// 바닥 — 위 16, 버튼 사이 8. 버튼마다 반 폭을 바탕으로(늘어나 채운다) 글 폭보다 줄지 않는다 — 한쪽 글이 반을 넘으면
// 줄이 넘어가고 wrap-reverse 라 둘째(확정)가 위로 간다. 하나면 폭 전체
// 짝 버튼 판정은 ResponsivePair(button 폴더)가 맡는다 — 여기는 바닥 위 16 만(I-01 결정 6A)
export const ALERT_FOOTER = "pt-x4";
