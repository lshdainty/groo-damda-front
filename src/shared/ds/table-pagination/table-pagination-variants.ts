import { dsLocale } from "@/shared/ds/i18n";
/*
 * Groo Table Pagination 의 모양과 쪽 계산 — 수치 원본은 groo-design specs/components/table-pagination.yaml(값은
 * src/shared/ds/spec/table-pagination.json). 컴포넌트와 규칙은 table-pagination.tsx 머리 주석이다
 * (컴포넌트 파일은 컴포넌트만 내보낸다 — 빠른 새로 고침).
 */

// ── 모양 ─────────────────────────────────────────────────────
// 화살표 — Pagination 의 칸(40 · 모서리 8 · 누르는 영역은 위아래만 44)
export const TABLE_PAGINATION_ARROW = [
  "relative flex size-[40px] shrink-0 items-center justify-center rounded-r2 border-0 bg-transparent p-0 [&>svg]:size-[16px]",
  "before:absolute before:inset-x-0 before:inset-y-[-2px] before:content-['']",
  "[transition:background-color_var(--motion-duration-color-transition)_var(--motion-ease-easing),scale_var(--motion-duration-pressed-scale)_var(--motion-ease-pressed-scale)]",
  "focus-visible:z-[1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus-ring",
].join(" ");
// 누르면 40 → 0.95(2px 거리 축소). 모션 줄이기면 색만
export const TABLE_PAGINATION_ARROW_ENABLED =
  "cursor-pointer text-fg-neutral hover:bg-bg-layer-default-pressed active:bg-bg-layer-default-pressed active:[scale:calc(1-2/40)] motion-reduce:active:[scale:1]";
export const TABLE_PAGINATION_ARROW_DISABLED =
  "cursor-not-allowed text-fg-disabled";

// 글 — t4 · 400 · fg-neutral, 숫자 폭 고정
export const TABLE_PAGINATION_TEXT =
  "whitespace-nowrap text-t4 font-normal text-fg-neutral tabular-nums";

// 고르기 자리 — 최소 폭 96, 글만큼 넓어진다
export const TABLE_PAGINATION_SELECT_BOX = "w-max min-w-[96px] shrink-0";

// 줄 — 최소 높이 40(큰 글자에서 고르기 · 글을 따라 높아진다) · 한 줄 · 양 끝 정렬 · 사이 16, 표 아래 12(spacing-component-default). 좁아 표를 가로로
// 밀어도 표 상자의 보이는 폭에 붙어 있고(Table 의 pagination 자리), 내용 폭보다 줄지 않는다(min-w-max)
export const TABLE_PAGINATION_ROOT =
  "mt-component-default flex min-h-[40px] w-full min-w-max flex-nowrap items-center justify-between gap-x4 font-sans";

// ── 쪽 계산(SEED useTablePagination 과 같다) ───────────────────
export const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
// 범위 목록은 200개까지 모두, 넘으면 첫 · 마지막 · 지금 둘레(가운데 198)만
export const MAX_RANGE_OPTIONS = 200;
// 범위 목록의 최대 높이 — Select 기본 480 대신(SEED)
export const RANGE_LIST_MAX_HEIGHT = 240;

export const formatNumber = (n: number) => n.toLocaleString(dsLocale());
export const formatRange = (start: number, end: number) =>
  `${formatNumber(start)}-${formatNumber(end)}`;

export function clampPage(page: number, totalPages: number | undefined) {
  if (totalPages === 0) return 1;
  return totalPages === undefined
    ? Math.max(page, 1)
    : Math.min(Math.max(page, 1), totalPages);
}

export function rangeOf(page: number, pageSize: number, itemCount: number) {
  if (itemCount <= 0) return { start: 0, end: 0 };
  const start = (page - 1) * pageSize + 1;
  return { start, end: start + itemCount - 1 };
}

// 전체 수를 알 때의 범위 — 빈 표는 "0-0"
export const knownRange = (
  page: number,
  pageSize: number,
  totalItems: number,
) =>
  totalItems === 0
    ? { start: 0, end: 0 }
    : rangeOf(
        page,
        pageSize,
        Math.min(pageSize, totalItems - (page - 1) * pageSize),
      );

// 범위 목록의 쪽 — 200개까지 모두, 넘으면 첫 · 마지막 + 지금을 가운데에 둔 198(SEED createAutoPageOptions)
export function rangePages(page: number, totalPages: number) {
  if (totalPages <= MAX_RANGE_OPTIONS)
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  const windowSize = MAX_RANGE_OPTIONS - 2;
  const start = Math.min(
    Math.max(page - Math.floor((windowSize - 1) / 2), 2),
    totalPages - windowSize,
  );
  return [
    1,
    ...Array.from({ length: windowSize }, (_, i) => start + i),
    totalPages,
  ];
}
