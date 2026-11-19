import { dsLocale } from "@/shared/ds/i18n";
/*
 * Groo Pagination 의 모양과 칸 배열 규칙 — 수치 원본은 groo-design specs/components/pagination.yaml(값은
 * src/shared/ds/spec/pagination.json). 컴포넌트와 규칙은 pagination.tsx 머리 주석이다
 * (컴포넌트 파일은 컴포넌트만 내보낸다 — 빠른 새로 고침).
 */

// ── 칸 수 · 칸 배열 ──────────────────────────────────────────
export type PaginationSlots = 7 | 9;
export type PaginationChangeReason = "page-item" | "previous" | "next";

/** 칸 하나 — 쪽 번호 · 이전 · 다음(누르면 갈 쪽) · 생략 · 빈 칸(끝 쪽의 화살표 자리) */
export type PaginationItem =
  | { type: "page"; page: number }
  | { type: "previous"; page: number }
  | { type: "next"; page: number }
  | { type: "ellipsis"; page?: undefined }
  | { type: "empty"; page?: undefined };

const range = (start: number, end: number): PaginationItem[] =>
  Array.from({ length: end - start + 1 }, (_, i) => ({
    type: "page",
    page: start + i,
  }));

const ELLIPSIS: PaginationItem = { type: "ellipsis" };

// 번호 · 생략 칸(화살표 둘을 뺀 칸) — SEED usePagination 의 createItems · createCompactItems 와 같은 식
function middleItems(
  page: number,
  total: number,
  slots: PaginationSlots,
): PaginationItem[] {
  const available = slots - 2;
  if (total <= available) return range(1, total);
  if (available === 5) {
    if (page <= 3) return [...range(1, 4), ELLIPSIS];
    if (page >= total - 2) return [ELLIPSIS, ...range(total - 3, total)];
    return [ELLIPSIS, ...range(page - 1, page + 1), ELLIPSIS];
  }
  const siblings = Math.floor((available - 5) / 2); // 9칸이면 1
  const edge = available - 2; // 앞 · 뒤 구간의 번호 수 — 9칸이면 5
  const threshold = edge - siblings; // 9칸이면 4
  if (page <= threshold)
    return [...range(1, edge), ELLIPSIS, { type: "page", page: total }];
  if (page >= total - threshold + 1)
    return [
      { type: "page", page: 1 },
      ELLIPSIS,
      ...range(total - edge + 1, total),
    ];
  return [
    { type: "page", page: 1 },
    ELLIPSIS,
    ...range(page - siblings, page + siblings),
    ELLIPSIS,
    { type: "page", page: total },
  ];
}

/**
 * 칸 배열 — 앞뒤 화살표(끝 쪽이면 빈 칸) + 번호 · 생략. 1쪽 이하면 빈 배열(넘김 줄을 그리지 않는다).
 * page 는 1 ~ totalPages 로 맞춘다. slots 는 화살표를 포함한 칸 수(480 이상 9 · 미만 7). 앱도 같은 규칙을 쓴다.
 */
export function paginationItems(
  page: number,
  totalPages: number,
  slots: PaginationSlots = 9,
): PaginationItem[] {
  const total = Number.isFinite(totalPages) ? Math.floor(totalPages) : 0;
  if (total <= 1) return [];
  const p = Math.min(
    Math.max(Number.isFinite(page) ? Math.floor(page) : 1, 1),
    total,
  );
  const n: PaginationSlots = slots === 7 ? 7 : 9;
  return [
    p > 1 ? { type: "previous", page: p - 1 } : { type: "empty" },
    ...middleItems(p, total, n),
    p < total ? { type: "next", page: p + 1 } : { type: "empty" },
  ];
}

export const formatNumber = (n: number) => n.toLocaleString(dsLocale());

// ── 모양 ─────────────────────────────────────────────────────
// 넘김 줄 — 목록 아래 가운데, 목록 끝 → 줄 24
export const PAGINATION_ROOT = "mt-x6 flex justify-center";
// 칸을 사이 없이 잇는다(9칸 360 · 7칸 280). gap 0 을 적어 둔다 — 스펙 값이 0 이다
export const PAGINATION_ROW = "flex items-center gap-0";

// 칸 — 40 × 40 · 모서리 8, 누르는 영역은 위아래만 44(::before 2 씩). 키보드 포커스에만 바깥 2px 링 — 이웃 칸 위로 올린다
export const PAGINATION_CELL = [
  "relative flex size-[40px] shrink-0 items-center justify-center rounded-r2 border-0 bg-transparent p-0 font-sans no-underline",
  "before:absolute before:inset-x-0 before:inset-y-[-2px] before:content-['']",
  "[transition:background-color_var(--motion-duration-color-transition)_var(--motion-ease-easing),scale_var(--motion-duration-pressed-scale)_var(--motion-ease-pressed-scale)]",
  "focus-visible:z-[1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus-ring",
].join(" ");
// 누를 수 있는 칸 — 호버(마우스 기기) · 누름 바탕 + 2px 거리 축소(40 → 0.95). 모션 줄이기면 색만
export const PAGINATION_CELL_ENABLED =
  "cursor-pointer text-fg-neutral active:[scale:calc(1-2/40)] motion-reduce:active:[scale:1]";
export const PAGINATION_CELL_OTHER =
  "hover:bg-bg-layer-default-pressed active:bg-bg-layer-default-pressed";
// 지금 쪽 — 짙은 채움(bg-neutral-inverted) + 반전 글자. 브랜드 색이 아니다
export const PAGINATION_CELL_CURRENT =
  "bg-bg-neutral-inverted text-fg-neutral-inverted hover:bg-bg-neutral-inverted-pressed active:bg-bg-neutral-inverted-pressed";
// 막힌 칸 — 전용 색, 바탕 · 축소 없음(지금 쪽은 bg-disabled — 흐리게 하지 않는다)
export const PAGINATION_CELL_DISABLED = "cursor-not-allowed text-fg-disabled";
export const PAGINATION_CELL_DISABLED_CURRENT = "bg-bg-disabled";

// 번호 — t4-static · 700 · 숫자 폭 고정, 칸을 넘으면 말줄임. 칸 안 글이라 글자 크기 설정을 따르지 않는다(pagination.md)
export const PAGINATION_LABEL =
  "block min-w-0 max-w-full truncate text-t4-static font-bold tabular-nums";

// 생략 · 빈 칸 — 40 상자(생략은 점 셋 16, 누르지 않는다)
export const PAGINATION_ELLIPSIS =
  "flex size-[40px] shrink-0 items-center justify-center text-fg-neutral [&>svg]:size-[16px]";
export const PAGINATION_EMPTY = "size-[40px] shrink-0";
