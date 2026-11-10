/*
 * Groo Table 의 모양 — 수치 원본은 groo-design specs/components/table.yaml(값은 src/shared/ds/spec/table.json).
 * 컴포넌트와 규칙은 table.tsx 머리 주석이다(컴포넌트 파일은 컴포넌트만 내보낸다 — 빠른 새로 고침).
 */

// 모든 칸 — 아래 선 1px · 좌우 16(첫 칸 앞 · 끝 칸 뒤 24) · 14 / 20 · 세로 가운데.
// 줄 높이를 칸 높이 그대로 41 · 45 · 72 로 두려고 선은 칸의 아래 테두리다(표가 border-separate)
export const TABLE_CELL = [
  "border-b border-solid border-stroke-neutral-subtle px-x4 align-middle font-sans text-t4 leading-5 text-fg-neutral",
  "first:pl-x6 last:pr-x6",
].join(" ");

// 머리 칸 — 위아래 10 · 500 · 한 줄. 붙은 머리는 카드 면과 같은 바탕으로 지나가는 줄을 가린다
export const TABLE_HEAD_CELL = "py-x2_5 font-medium whitespace-nowrap";
export const TABLE_HEAD_STICKY = "sticky top-0 z-[1] bg-bg-layer-default";

// 본문 칸 — 위아래 12 · 400. 칸 안의 인라인 블록(배지 · 이름 링크)은 줄 위에 맞춘다 — 글자 기준선에 맞추면 줄이 45 를 넘는다.
// 썸네일 · 두 줄 칸이 있는 표는 최소 72(선 1 포함) — 칸은 위아래 12 를 지키고 내용을 세로 가운데에 둔다. 내용이 72 를 넘으면(긴 두 줄 글)
// 줄이 자라되 위아래 12 가 줄 선에 붙지 않게 지킨다(table.md 줄 높이 · 2026-11-09). 표 칸에서는 height 가 곧 최소 높이다 — 내용이 넘으면 칸이
// 자란다. min-height 는 표 칸에 먹지 않아(크로미움 계측: min-h-[72px] 는 줄이 67 로 줄었다) 쓰지 않는다.
// Image Frame 48 썸네일은 48 + 24 + 1 = 73 이라 72 를 넘는다 — 판단 대기라 표에 새로 두지 않는다
export const TABLE_BODY_CELL = "py-x3 font-normal [&>*]:align-top";
export const TABLE_BODY_RICH = "h-[72px] py-x3";
// Image Frame 48 썸네일을 담는 칸만 위아래 0(사용자 결정 2026-11-10 14C) — 48 + 24 + 선 1 = 73 이라 72 를 넘으므로 높이가 먼저다
export const TABLE_BODY_THUMBNAIL = "py-0";

export const TABLE_ALIGN = {
  start: "text-start",
  end: "text-end tabular-nums",
} as const;

// 정렬 버튼 — 머리 칸의 여백을 버튼이 가진다(칸 어디를 눌러도 정렬). 누르는 영역은 위아래로 44 까지(::before). 링은 안쪽
export const TABLE_SORT_BUTTON = [
  "relative flex w-full cursor-pointer items-center gap-x1_5 border-0 bg-transparent px-x4 py-x2_5 font-[inherit] text-[length:inherit] leading-[inherit] text-fg-neutral",
  "[th:first-child>&]:pl-x6 [th:last-child>&]:pr-x6",
  "before:absolute before:inset-x-0 before:-inset-y-0.5 before:content-['']",
  "[transition:background-color_var(--motion-duration-color-transition)_var(--motion-ease-easing)]",
  "hover:bg-bg-layer-default-pressed active:bg-bg-layer-default-pressed",
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-stroke-focus-ring",
].join(" ");

// 누르는 줄 — 줄 전체 바탕(선은 그대로), 축소 없음(표의 줄 · 칸은 이웃과 붙어 있어 줄이면 흔들린다)
export const TABLE_ROW =
  "[transition:background-color_var(--motion-duration-color-transition)_var(--motion-ease-easing)]";
export const TABLE_ROW_PRESSABLE =
  "cursor-pointer hover:bg-bg-layer-default-pressed active:bg-bg-layer-default-pressed";

// 줄 안의 이름 링크 · 버튼 — 안쪽 2px 링이 글자에 닿지 않게 둘레 여백을 두고 그만큼 바깥 여백으로 되돌린다
export const TABLE_ROW_HEADER_ACTION = [
  "-mx-x1 -my-x0_5 inline-block cursor-pointer rounded-r1 align-top border-0 bg-transparent px-x1 py-x0_5 text-start font-[inherit] text-[length:inherit] leading-[inherit] text-fg-neutral no-underline",
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-stroke-focus-ring",
].join(" ");

// 체크 · ⋮ 의 누르는 영역 44 — 보이는 상자 둘레로(Checkmark 는 relative)
export const TABLE_HIT_44 =
  "before:absolute before:left-1/2 before:top-1/2 before:size-[44px] before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']";

// 일괄 작업 바 — bg-brand-weak 한 값 · 48 · 모서리 12 · 왼쪽 16 · 오른쪽 8 · 표 위 8
export const TABLE_BULK_BAR =
  "mb-x2 flex min-h-[48px] items-center gap-x2 rounded-r3 bg-bg-brand-weak pl-x4 pr-x2 font-sans";

// 줄 한 칸 상태 — 칸은 좌우 24 만(위아래는 Result Section 의 16 — 사이트 그림처럼 제 여백만)
export const TABLE_STATUS_CELL =
  "border-b border-solid border-stroke-neutral-subtle px-x6 py-0";
