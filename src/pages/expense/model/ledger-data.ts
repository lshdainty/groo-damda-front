import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAsset, useAssetTransfers } from "@/features/asset";
import type { AssetTransfer } from "@/entities/asset";
import type { Expense, ExpenseType, ExpenseCategory } from "@/entities/expense";
import { expenseSum, incomeSum } from "@/entities/expense";
import { useExpenses, useRangeSummary } from "@/features/expense";
import {
  activeConditionCount,
  filterSpan,
  matchesFilter,
  samePeriod,
  type FilterPeriodRange,
  type FilterValue,
} from "@/features/expense/model/filter";

/*
 * 가계부 목록의 공용 계산 — 폰(ExpenseMobile)과 데스크톱(ExpensePage)이 함께 쓴다.
 * 화면 파일에서 떼어 놓은 것이다(I-07 10 — 값 · 글 · 동작은 바꾸지 않았다).
 */

export type Filter = "all" | "income" | "expense";

export function monthRange(monthKey: string): {
  startDate: string;
  endDate: string;
} {
  const [ys, ms] = monthKey.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const lastDay = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, "0");
  return {
    startDate: `${y}-${mm}-01`,
    endDate: `${y}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function dayKey(expenseDate: string): string {
  // supports "YYYY-MM-DD" or ISO datetime; take first 10 chars
  return expenseDate.slice(0, 10);
}

/**
 * 목록에 함께 놓이는 한 행. 이체는 지출/수입이 아니므로 Expense 로 억지로 표현하지 않고
 * 표시 단계에서만 합류시킨다(통계·폼 같은 지출 전용 경로에 새지 않게).
 */
export type LedgerItem =
  | { kind: "expense"; expense: Expense }
  | { kind: "transfer"; transfer: AssetTransfer };

export const ledgerKey = (i: LedgerItem) =>
  i.kind === "expense" ? `e${i.expense.rowId}` : `t${i.transfer.rowId}`;

/** 정렬·그룹 기준 시각. 이체도 DATETIME 이라 지출과 같은 기준으로 섞인다. */
const ledgerAt = (i: LedgerItem) =>
  i.kind === "expense" ? i.expense.expenseDate : i.transfer.transferDate;

export function groupLedgerByDay(
  expenses: Expense[],
  transfers: AssetTransfer[],
): [string, LedgerItem[]][] {
  const items: LedgerItem[] = [
    ...expenses.map((e) => ({ kind: "expense", expense: e }) as LedgerItem),
    ...transfers.map((t) => ({ kind: "transfer", transfer: t }) as LedgerItem),
  ];
  const map = new Map<string, LedgerItem[]>();
  for (const i of items) {
    const k = dayKey(ledgerAt(i));
    const arr = map.get(k) ?? [];
    arr.push(i);
    map.set(k, arr);
  }
  const sortedKeys = [...map.keys()].sort((a, b) => b.localeCompare(a));
  return sortedKeys.map((k) => {
    const day = (map.get(k) ?? [])
      .slice()
      .sort((a, b) => ledgerAt(b).localeCompare(ledgerAt(a)));
    return [k, day] as [string, LedgerItem[]];
  });
}

/**
 * 필터가 볼 바깥 범위. v2 는 기간이 여러 칸이라 **최소 시작 ~ 최대 종료**를 한 번
 * 조회하고 칸별 판정은 클라이언트(`matchesFilter`)가 한다 — 칸마다 따로 부르면
 * 같은 거래가 두 번 오고 합계가 부풀어 오른다.
 */
function rangeOf(
  filterValue: FilterValue | null,
  monthKey: string,
): { startDate: string; endDate: string } {
  const span = filterValue ? filterSpan(filterValue) : null;
  if (!span) return monthRange(monthKey);
  return { startDate: span.start, endDate: span.end };
}

export function useExpenseData(
  month: string,
  filter: Filter,
  filterValue: FilterValue | null,
  assetId?: number,
  categories?: ExpenseCategory[] | null,
) {
  const { startDate, endDate } = useMemo(
    () => rangeOf(filterValue, month),
    [month, filterValue],
  );

  const [yStr, mStr] = month.split("-");
  const year = Number(yStr);
  const m = Number(mStr);

  const chipType: ExpenseType | undefined =
    filter === "income"
      ? "INCOME"
      : filter === "expense"
        ? "EXPENSE"
        : undefined;

  // 다이얼로그 필터가 적용된 상태면 types은 클라이언트에서 처리 (다중 타입 가능)
  const serverType = filterValue ? undefined : chipType;

  const expensesQ = useExpenses({
    startDate,
    endDate,
    expenseType: serverType,
    assetId,
  });
  // 월 헤더용 합계 — 현재 monthKey 의 한 달 범위
  const monthStart = `${year}-${String(m).padStart(2, "0")}-01`;
  const monthEndDay = new Date(year, m, 0).getDate();
  const monthEnd = `${year}-${String(m).padStart(2, "0")}-${String(monthEndDay).padStart(2, "0")}`;
  // 자산 필터를 합계에도 건다 — 목록·캘린더만 걸러지고 상단 수입/지출은 전체 값이었다.
  const monthlyQ = useRangeSummary(monthStart, monthEnd, assetId ?? null);
  // 그 달 거래 전체(필터와 무관) — 데스크톱 · 태블릿 작은 달력의 날마다 세기 막대와 주 달력이 센다.
  // 필터가 없으면 위 목록과 같은 요청이라 한 번만 받는다(같은 질의 키)
  // 실패는 달력 카드 자리에서 말한다(monthExpensesFailed) — 서버 원문 토스트는 끈다
  const monthExpensesQ = useExpenses(
    {
      startDate: monthStart,
      endDate: monthEnd,
      assetId,
    },
    { silent: true },
  );

  // 부모 카테고리를 고르면 자식 rowId 까지 함께 본다 — **빼고(exclude)에도 같이** 건다.
  // 한쪽만 펼치면 "식비 빼고" 가 하위 '카페' 를 못 걸러 낸다.
  const expandCats = useCallback(
    (ids: number[]): number[] => {
      if (ids.length === 0) return ids;
      const set = new Set<number>(ids);
      for (const cat of categories ?? []) {
        if (cat.parentRowId != null && ids.includes(cat.parentRowId)) {
          set.add(cat.rowId);
        }
      }
      return [...set];
    },
    [categories],
  );

  /** 화면에서 쓰는 필터 — 카테고리를 자식까지 펼쳐 둔 것. */
  const effective = useMemo<FilterValue | null>(() => {
    if (!filterValue) return null;
    return {
      ...filterValue,
      categories: {
        include: expandCats(filterValue.categories.include),
        exclude: expandCats(filterValue.categories.exclude),
      },
    };
  }, [filterValue, expandCats]);

  const filtered = useMemo(() => {
    const list = expensesQ.data ?? [];
    if (!effective) return list;
    return list.filter((e) =>
      matchesFilter(
        {
          date: (e.expenseDate ?? "").slice(0, 10),
          amount: e.amount,
          type: e.expenseType,
          // 분할 항목 카테고리까지 넣는다 — 포함은 "하나라도", 제외는 "하나라도 걸리면".
          categoryIds: [
            e.categoryRowId,
            ...(e.splitCategoryRowIds ?? []),
          ].filter((x): x is number => x != null),
          assetIds: e.assetRowId != null ? [e.assetRowId] : [],
        },
        effective,
      ),
    );
  }, [expensesQ.data, effective]);

  // 이체는 지출/수입이 아니라 자산 간 이동이라 expense 목록에 섞여 오지 않는다(별도 테이블).
  // 목록에 함께 보여주기 위해 같은 기간으로 따로 받아 화면 단에서만 합친다 —
  // 통계·예산 같은 지출 전용 경로에 이체가 새지 않게 하려는 의도적 분리.
  const transfersQ = useAssetTransfers({ startDate, endDate });

  const filteredTransfers = useMemo(() => {
    let list = transfersQ.data?.transfers ?? [];
    // 자산 필터(칩)는 보내는 쪽·받는 쪽 둘 다 매칭 — 한 건이 자산 두 개에 걸친다.
    if (assetId != null) {
      list = list.filter(
        (t) => t.fromAssetRowId === assetId || t.toAssetRowId === assetId,
      );
    }
    // 상단 칩으로 지출/수입을 고른 상태면 이체는 그 개념이 아니라 빠진다.
    if (serverType) return [];
    if (!effective) return list;
    // v1 은 카테고리를 고르면 여기서 통째로 빠져나갔다(`return []`). v2 는 그 판정을
    // 술어 하나에 맡긴다 — "모두 일치" 면 카테고리 조건에서 자연히 걸러지고,
    // "하나라도" 면 계좌·금액으로 이체가 남는다.
    return list.filter((t) =>
      matchesFilter(
        {
          date: (t.transferDate ?? "").slice(0, 10),
          amount: t.amount,
          type: null,
          categoryIds: [],
          assetIds: [t.fromAssetRowId, t.toAssetRowId].filter(
            (x): x is number => x != null,
          ),
        },
        effective,
      ),
    );
  }, [transfersQ.data, effective, serverType, assetId]);

  // 요약 — 필터가 걸려 있으면 **걸러진 목록으로** 다시 센다(환불 상계·예정 제외는
  // incomeSum/expenseSum 이 그대로 지킨다). 필터가 없으면 서버 월 요약을 쓴다.
  const filterActive = filterValue != null;
  const monthIn = filterActive
    ? incomeSum(filtered)
    : (monthlyQ.data?.totalIncome ?? 0);
  const monthOut = filterActive
    ? expenseSum(filtered)
    : (monthlyQ.data?.totalExpense ?? 0);

  return {
    expenses: filtered,
    transfers: filteredTransfers,
    monthIn,
    monthOut,
    /** 그 달 서버 요약 — 필터와 무관한 달 값(작은 달력 · 요약 카드). `monthIn` · `monthOut` 은 필터가 걸리면 거른 목록의 값이다 */
    monthTotalIn: monthlyQ.data?.totalIncome ?? 0,
    monthTotalOut: monthlyQ.data?.totalExpense ?? 0,
    /** 그 달 거래 전체(필터와 무관) — 달력 막대가 센다 */
    monthExpenses: monthExpensesQ.data ?? [],
    isLoadingMonthExpenses: monthExpensesQ.isLoading,
    /** 달력 막대를 못 받았다 — 값이 하나도 없을 때만. 목록과 같은 질의면 `isError` 가 이미 화면 전체를 대신한다 */
    monthExpensesFailed:
      monthExpensesQ.isError && monthExpensesQ.data === undefined,
    retryMonthExpenses: () => {
      void monthExpensesQ.refetch();
    },
    filterActive,
    isLoadingList: expensesQ.isLoading || transfersQ.isLoading,
    isLoadingSummary: monthlyQ.isLoading,
    // 불러오지 못했다 — 비어 있음("거래가 없어요")으로 보이면 안 된다. 화면이 실패로 그리고 다시 시도를 둔다
    // (필터가 걸리면 요약은 거른 목록으로 다시 세므로 서버 월 요약이 실패해도 상관없다)
    isError:
      expensesQ.isError ||
      transfersQ.isError ||
      (!filterActive && monthlyQ.isError),
    retry: () => {
      void expensesQ.refetch();
      void transfersQ.refetch();
      void monthlyQ.refetch();
    },
  };
}

export function useAssetFilter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get("assetId");
  const assetId = raw ? Number(raw) : undefined;
  const enabled = !!assetId && !Number.isNaN(assetId);
  const { data: asset } = useAsset(enabled ? assetId! : 0, {
    reference: true,
  });
  const clear = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("assetId");
    setSearchParams(next, { replace: true });
  };
  return {
    assetId: enabled ? assetId : undefined,
    asset: enabled ? asset : undefined,
    clear,
  };
}

/**
 * 필터 버튼 배지 — **켜진 포함 조건의 수**다(`activeConditionCount`).
 *
 * 기간은 항상 걸려 있고 '빼고' 는 포함 조건이 아니라서 세지 않는다. 다만 사람 눈에는
 * 그 둘도 "필터가 걸린 상태" 이므로, 조건이 0 이어도 기간이 여러 칸이거나 '빼고' 가
 * 있으면 1 로 쳐서 배지를 띄운다. 기간이 한 칸이어도 **보고 있는 달과 다르면** 마찬가지다 —
 * 기간만 8/10~8/20 으로 걸면 목록·합계는 바뀌는데 버튼은 그냥 "필터" 였다(QA 30 10).
 */
export function filterActiveCount(
  v: FilterValue | null,
  viewPeriod: FilterPeriodRange,
): number {
  if (!v) return 0;
  const n = activeConditionCount(v);
  if (n > 0) return n;
  const hasExclude =
    v.categories.exclude.length > 0 || v.assets.exclude.length > 0;
  const periodChanged =
    v.periods.length === 1 && !samePeriod(v.periods[0]!, viewPeriod);
  return v.periods.length > 1 || hasExclude || periodChanged ? 1 : 0;
}
