import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { Select, SelectItem } from "@/shared/ds/select";

import {
  DEFAULT_PAGE_SIZE_OPTIONS,
  RANGE_LIST_MAX_HEIGHT,
  TABLE_PAGINATION_ARROW,
  TABLE_PAGINATION_ARROW_DISABLED,
  TABLE_PAGINATION_ARROW_ENABLED,
  TABLE_PAGINATION_ROOT,
  TABLE_PAGINATION_SELECT_BOX,
  TABLE_PAGINATION_TEXT,
  clampPage,
  formatNumber,
  formatRange,
  knownRange,
  rangeOf,
  rangePages,
} from "./table-pagination-variants";
import { useDsText } from "@/shared/ds/i18n";

/*
 * Groo Table Pagination — 구조는 SEED Table Pagination(2026-10-04). 수치 원본은 groo-design
 * specs/components/table-pagination.yaml(값은 src/shared/ds/spec/table-pagination.json). groo-design
 * recipes/shadcn/components/ui/table-pagination.tsx 를 첫 판으로 가져왔다 — 모양 · 쪽 계산은 table-pagination-variants.ts 다
 * (컴포넌트 파일은 컴포넌트만 내보낸다 — 빠른 새로 고침). 고르기 둘은 Select medium(select), 이전 · 다음은 Pagination 의 화살표 칸이다.
 *
 *   TablePagination   데이터 표 아래의 쪽 넘김 한 줄 — role="group" · aria-label="표 페이지 탐색"
 *     totalItems      전체 수를 알 때 — 범위 고르기 + "/ 총 N개"
 *     hasPreviousPage · hasNextPage · currentPageItemCount   전체 수를 모를 때 — 범위는 글로만("11-20")
 *     value · defaultValue({ page, pageSize }, 기본 { 1, 10 }) · onValueChange(value, { reason })
 *                     reason "previous" · "next" · "page-range" · "page-size" · "constraint"(줄이 줄어 지금 범위가 없어져 옮겼을 때)
 *     pageSizeOptions 줄 수 — 기본 [10, 25, 50](3 ~ 4개를 넘지 않는다)
 *     scrollTarget    표 상자 — 넘기면 그 위 끝이 보이게 스크롤한다
 *     disabled        막힌 줄 — 고르기 · 화살표 모두
 *
 * 줄 수를 바꾸면 첫 범위로 돌아간다. 줄이 줄어 지금 범위가 없어지면 마지막 범위로 옮긴다("Page 3 of 2" 가 되지 않게 — reason "constraint").
 * 범위 목록은 200개까지 모두, 넘으면 첫 · 마지막 · 지금 둘레(가운데 198)만 둔다. 하나뿐이면(빈 표 "0-0" · 한 범위) 범위 고르기를 막는다.
 * 이전 · 다음은 끝에서 숨기지 않고 막는다 — aria-disabled 라 초점이 그 자리에 남는다(SEED 는 disabled 라 초점이 떨어진다).
 * 넘기면(이전 · 다음 · 범위 · 줄 수) 표(scrollTarget)의 위 끝이 보이게 스크롤하고 숨은 상태 글(role="status")로
 *   "11-20, 총 237개"(전체를 모르면 "11-20")를 한 번 알린다. 초점은 누른 칸(고르기 · 화살표)에 그대로 둔다.
 *
 * 레시피와 다른 자리 — useMemo 를 걷었고(React Compiler), 효과 안 setState 를 걷었다: 상태 글은 값이 바뀐 렌더에서 바뀐 쪽을
 * 보고(저장해 둔 이전 값과 견주는 렌더 중 갱신) 바꾸고, 표 맨 위로 스크롤은 넘기는 손길(commit)에서 한다. 값이 바깥에서 바뀐 경우
 * (제어)에도 상태 글은 알리지만 스크롤은 하지 않는다. 줄이 줄어 범위가 없어졌을 때의 "constraint" 알림만 효과에서 부른다.
 *
 * 모양: 한 줄 40 · 줄바꿈 없음 · 양 끝 정렬, 왼쪽 묶음 ↔ 오른쪽 묶음 · 범위 묶음 ↔ 화살표 16, 고르기 ↔ 글 8, 표 아래 12
 *   (spacing-component-default). 좁은 화면에서 표를 가로로 밀어도 줄은 표 상자의 보이는 폭에 붙어 있다(Table 의 pagination 자리) — 줄은 내용 폭보다 줄지 않는다.
 *   고르기는 Select medium(트리거 40 · 최소 폭 96) — 화면 폭과 상관없이 medium 이다(Select 의 "1280 미만 large 52" 규칙의 예외 —
 *   사용자 결정 2026-10-08). 범위 목록은 최대 높이 240(Select 기본 480 대신 — SEED). 글은 t4 14 / 19 · 400 · fg-neutral, 수는 세 자리마다 쉼표.
 *   화살표는 Pagination 의 칸 그대로 — 40 × 40 · 아이콘 16 · 모서리 8, 누르는 영역은 위아래만 44(같은 예외), 호버 · 누름
 *   bg-layer-default-pressed + 2px 거리 축소(40 → 0.95), 키보드 포커스에만 바깥 2px 링, 막히면 fg-disabled.
 * 이름: 고르기 "페이지당 표시 개수" · "표시 범위", 화살표 "이전 페이지" · "다음 페이지"(SEED 문구). 영어를 쓰지 않는다.
 */

export interface TablePaginationValue {
  /** 1부터 시작하는 지금 범위 */
  page: number;
  /** 한 번에 보는 줄 수 */
  pageSize: number;
}

export type TablePaginationChangeReason =
  "previous" | "next" | "page-range" | "page-size" | "constraint";

export interface TablePaginationChangeDetails {
  reason: TablePaginationChangeReason;
}

type TablePaginationBaseProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "defaultValue" | "onChange" | "children"
> & {
  value?: TablePaginationValue;
  defaultValue?: TablePaginationValue;
  onValueChange?: (
    value: TablePaginationValue,
    details: TablePaginationChangeDetails,
  ) => void;
  /** 줄 수 — 기본 [10, 25, 50] */
  pageSizeOptions?: readonly number[];
  /** 표 상자 — 넘기면 그 위 끝이 보이게 스크롤한다 */
  scrollTarget?: React.RefObject<HTMLElement | null>;
  disabled?: boolean;
};

export type TablePaginationProps = TablePaginationBaseProps &
  (
    | {
        /** 전체 수(0 이상) — 알면 범위 고르기 + "/ 총 N개" */
        totalItems: number;
        hasPreviousPage?: never;
        hasNextPage?: never;
        currentPageItemCount?: never;
      }
    | {
        totalItems?: undefined;
        /** 전체 수를 모를 때 — 서버가 알려 주는 앞 · 뒤 범위가 있는지 */
        hasPreviousPage: boolean;
        hasNextPage: boolean;
        /** 지금 범위에 실제로 든 줄 수 — 없으면 줄 수(pageSize), 줄 수보다 크면 줄 수 */
        currentPageItemCount?: number;
      }
  );

const DEFAULT_VALUE: TablePaginationValue = { page: 1, pageSize: 10 };

const TablePagination = React.forwardRef<HTMLDivElement, TablePaginationProps>(
  (props, ref) => {
    const dsT = useDsText();
    const {
      totalItems,
      hasPreviousPage: hasPreviousProp,
      hasNextPage: hasNextProp,
      currentPageItemCount,
      value: valueProp,
      defaultValue = DEFAULT_VALUE,
      onValueChange,
      pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
      scrollTarget,
      disabled = false,
      className,
      ...rest
    } = props;

    const [inner, setInner] =
      React.useState<TablePaginationValue>(defaultValue);
    const controlled = valueProp !== undefined;
    const raw = controlled ? valueProp : inner;
    const pageSize = Math.max(Math.floor(raw.pageSize) || 1, 1);
    const known = totalItems !== undefined;
    const total = known ? Math.max(Math.floor(totalItems), 0) : undefined;
    const totalPages =
      total === undefined ? undefined : Math.ceil(total / pageSize);
    const page = clampPage(Math.floor(raw.page) || 1, totalPages);

    const commit = (
      next: TablePaginationValue,
      reason: TablePaginationChangeReason,
    ) => {
      if (!controlled) setInner(next);
      onValueChange?.(next, { reason });
      // 넘기면 표 맨 위로 — 줄이 줄어 옮긴 것(constraint)은 사용자가 넘긴 것이 아니라 스크롤하지 않는다
      if (reason !== "constraint")
        scrollTarget?.current?.scrollIntoView?.({ block: "start" });
    };

    // 줄이 줄어 지금 범위가 없어졌다 — 마지막 범위로 옮기고 한 번만 알린다
    const constraintRef = React.useRef<string | null>(null);
    React.useEffect(() => {
      const rawPage = Math.floor(raw.page) || 1;
      if (rawPage === page) {
        constraintRef.current = null;
        return;
      }
      const key = `${rawPage}:${pageSize}:${page}`;
      if (constraintRef.current === key) return;
      constraintRef.current = key;
      commit({ page, pageSize }, "constraint");
    });

    // 범위 · 앞뒤
    let range: { start: number; end: number };
    let hasPrevious: boolean;
    let hasNext: boolean;
    if (total !== undefined && totalPages !== undefined) {
      range = knownRange(page, pageSize, total);
      hasPrevious = total > 0 && page > 1;
      hasNext = total > 0 && page < totalPages;
    } else {
      range = rangeOf(
        page,
        pageSize,
        Math.min(currentPageItemCount ?? pageSize, pageSize),
      );
      hasPrevious = page > 1 && !!hasPreviousProp;
      hasNext = !!hasNextProp;
    }

    const sizeOptions = [...new Set([...pageSizeOptions, pageSize])].sort(
      (a, b) => a - b,
    );
    const rangeOptions =
      total === undefined || totalPages === undefined
        ? []
        : [
            ...new Set([
              ...rangePages(page, totalPages).filter((p) => p <= totalPages),
              page,
            ]),
          ]
            .sort((a, b) => a - b)
            .map((p) => ({ page: p, ...knownRange(p, pageSize, total) }));
    const rangeSelectDisabled = disabled || rangeOptions.length <= 1;

    // 넘겼다 — 범위를 한 번 알린다. 이전에 본 쪽 · 줄 수와 다르면 렌더 중에 글을 바꾼다
    const statusText =
      total !== undefined
        ? dsT("tablePagination.summary", {
            range: formatRange(range.start, range.end),
            total: formatNumber(total),
          })
        : formatRange(range.start, range.end);
    const key = `${page}:${pageSize}`;
    const [seenKey, setSeenKey] = React.useState(key);
    const [message, setMessage] = React.useState("");
    if (seenKey !== key) {
      setSeenKey(key);
      setMessage(statusText);
    }

    const goTo = (next: number, reason: "previous" | "next" | "page-range") => {
      if (disabled) return;
      const target = clampPage(next, totalPages);
      if (target === page) return;
      commit({ page: target, pageSize }, reason);
    };

    const arrow = (which: "previous" | "next") => {
      const blocked =
        disabled || (which === "previous" ? !hasPrevious : !hasNext);
      return (
        <button
          type="button"
          aria-label={dsT(
            which === "previous" ? "pagination.previous" : "pagination.next",
          )}
          aria-disabled={blocked || undefined}
          data-slot={`table-pagination-${which}`}
          className={cn(
            TABLE_PAGINATION_ARROW,
            blocked
              ? TABLE_PAGINATION_ARROW_DISABLED
              : TABLE_PAGINATION_ARROW_ENABLED,
          )}
          onClick={() => {
            if (blocked) return;
            goTo(which === "previous" ? page - 1 : page + 1, which);
          }}
        >
          {which === "previous" ? (
            <ChevronLeft aria-hidden />
          ) : (
            <ChevronRight aria-hidden />
          )}
        </button>
      );
    };

    return (
      <div
        ref={ref}
        role="group"
        aria-label={dsT("tablePagination.label")}
        aria-disabled={disabled || undefined}
        data-slot="table-pagination"
        className={cn(TABLE_PAGINATION_ROOT, className)}
        {...rest}
      >
        <div
          data-slot="table-pagination-page-size"
          className="flex shrink-0 items-center gap-x2"
        >
          <div className={TABLE_PAGINATION_SELECT_BOX}>
            <Select
              size="medium"
              aria-label={dsT("tablePagination.pageSize")}
              value={String(pageSize)}
              disabled={disabled}
              onValueChange={(v) => {
                const next = Number(v);
                if (
                  !Number.isSafeInteger(next) ||
                  next < 1 ||
                  next === pageSize
                )
                  return;
                commit({ page: 1, pageSize: next }, "page-size");
              }}
            >
              {sizeOptions.map((n) => (
                <SelectItem
                  key={n}
                  value={String(n)}
                  label={dsT("tablePagination.sizeOption", {
                    count: formatNumber(n),
                  })}
                />
              ))}
            </Select>
          </div>
          <span
            data-slot="table-pagination-suffix"
            className={TABLE_PAGINATION_TEXT}
          >
            {dsT("tablePagination.perPage")}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-x4">
          {total !== undefined ? (
            <div
              data-slot="table-pagination-range"
              className="flex shrink-0 items-center gap-x2"
            >
              <div className={TABLE_PAGINATION_SELECT_BOX}>
                <Select
                  size="medium"
                  aria-label={dsT("tablePagination.range")}
                  value={String(page)}
                  disabled={rangeSelectDisabled}
                  listMaxHeight={RANGE_LIST_MAX_HEIGHT}
                  onValueChange={(v) => {
                    const next = Number(v);
                    if (Number.isSafeInteger(next)) goTo(next, "page-range");
                  }}
                >
                  {rangeOptions.map((o) => (
                    <SelectItem
                      key={o.page}
                      value={String(o.page)}
                      label={formatRange(o.start, o.end)}
                    />
                  ))}
                </Select>
              </div>
              <span
                data-slot="table-pagination-total"
                className={TABLE_PAGINATION_TEXT}
              >
                {dsT("tablePagination.of", { total: formatNumber(total) })}
              </span>
            </div>
          ) : (
            <span
              data-slot="table-pagination-range"
              className={TABLE_PAGINATION_TEXT}
            >
              {formatRange(range.start, range.end)}
            </span>
          )}
          <div className="flex shrink-0 items-center">
            {arrow("previous")}
            {arrow("next")}
          </div>
        </div>
        {/* 넘기면 한 번 알린다 — 처음부터 빈 채로 있어야 읽힌다 */}
        <span
          role="status"
          data-slot="table-pagination-status"
          className="sr-only"
        >
          {message}
        </span>
      </div>
    );
  },
);
TablePagination.displayName = "TablePagination";

export { TablePagination };
