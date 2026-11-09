import { loadFailed } from "@/shared/api";
import { useEffect, useMemo, useState } from "react";
import { Receipt, Search } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChipRadio, ChipRadioGroup } from "@/shared/ds/chip";
import { ResultSection } from "@/shared/ds/result-section";
import { ScrollAutoHide } from "@/shared/ds/scroll-auto-hide";
import { Skeleton } from "@/shared/ds/skeleton";
import { cn } from "@/shared/lib/cn";
import { useShellScroller } from "@/shared/lib/groo/shell-scroller";
import { formatMonthDayDow, todayLocalKey } from "@/shared/lib/date";
import {
  LedgerDayDate,
  LedgerDayGroup,
  LedgerDayHead,
  LedgerDayTotals,
  LedgerList,
} from "@/shared/ui/groo/ledger";
import { PageHead } from "@/shared/ui/groo/page-head";
import {
  ExpenseRow,
  expenseSum,
  incomeSum,
  type Expense,
} from "@/entities/expense";
import { useSearchExpenses } from "@/features/expense/model/useExpenses";
import { TxDetailDialog } from "@/widgets/expense-detail/ui/TxDetailDialog";
import {
  AdvancedFilter,
  isIdle,
  toSearchParams,
  useSearchCondition,
  type SearchType,
} from "@/widgets/transaction-search";

/** 한 글자마다 서버를 부르지 않는다 — 앱과 같은 350ms */
function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return v;
}

/**
 * 거래 검색(17-3a C) — 폰은 상단 바 제목 자리의 검색칸 + 고급 필터 아이콘, 데스크톱은 머리 왼쪽 검색칸(Enter 로 이 화면)이 입력이다.
 * 조건은 주소가 원본이다(`?q=&type=&min=&max=&from=&to=`). 칩 줄(전체 · 지출 · 수입)은 스크롤 상자 맨 위의 Scroll Auto Hide —
 * 내리면 숨고 올리면 드러난다. 결과 행은 가계부 목록과 같은 ExpenseRow, 날짜 그룹은 최신이 위(서버 정렬).
 */
export function SearchPage() {
  const { t } = useTranslation("common");
  const { t: tl } = useTranslation("layout");
  const { t: te } = useTranslation("expense");
  const { t: tDs } = useTranslation("ds");
  const { mobile } = useOutletContext<{ mobile: boolean }>();
  const { condition, update } = useSearchCondition();
  const debounced = useDebounced(condition, 350);
  const idle = isIdle(debounced);
  // 실패는 이 자리 Result Section 이 말한다 — 서버 원문 토스트는 끈다
  const query = useSearchExpenses(toSearchParams(debounced), { silent: true });
  const [detail, setDetail] = useState<Expense | null>(null);

  // 스크롤 상자는 셸의 본문 스크롤 주체(폰은 문서, 아니면 main) — 칩 줄이 이 상자 맨 위에서 숨고 드러난다.
  // 효과로 ref 를 채우면 자식(ScrollAutoHide)의 효과가 먼저 돌아 production 에서 null 을 보고 빠진다(N1) — 읽는 순간 찾는 ref 를 넘긴다
  const scrollRef = useShellScroller();

  const groups = useMemo(() => {
    const by = new Map<string, Expense[]>();
    for (const e of query.data ?? []) {
      const d = e.expenseDate?.slice(0, 10);
      if (!d) continue;
      by.set(d, [...(by.get(d) ?? []), e]);
    }
    return [...by.entries()].sort(([a], [b]) => (a < b ? 1 : -1));
  }, [query.data]);

  // 오늘 · 어제 붙임 — 가계부 원장(ExpenseMobile relOf)과 같은 규칙 · 같은 글
  const today = todayLocalKey();
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  const yesterday = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, "0")}-${String(yest.getDate()).padStart(2, "0")}`;
  const relOf = (d: string) =>
    d === today
      ? te("txm.today")
      : d === yesterday
        ? te("txm.yesterday")
        : null;

  const body = (() => {
    if (idle)
      return (
        <ResultSection
          size="large"
          icon={<Search />}
          title={t("searchEmptyHint")}
        />
      );
    if (loadFailed(query))
      // 그 자리 실패 + [다시 시도](같은 조건으로 다시) — 서버 글은 내지 않는다(B2a 실패 규칙)
      return (
        <ResultSection
          kind="failure"
          title={t("searchFailed")}
          primaryAction={{
            label: tDs("common.retry"),
            onClick: () => void query.refetch(),
            loading: query.isFetching,
          }}
        />
      );
    if (query.isLoading || query.isFetching)
      return (
        <div className="flex flex-col gap-x6 py-x4" aria-busy="true">
          {[3, 2].map((rows) => (
            <div key={rows} className="flex flex-col gap-x3">
              <Skeleton className="h-4 w-24" />
              {Array.from({ length: rows }, (_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ))}
        </div>
      );
    if (groups.length === 0)
      return <ResultSection icon={<Receipt />} title={t("searchNoResults")} />;
    return (
      <LedgerList>
        {groups.map(([d, items]) => {
          const dOut = expenseSum(items);
          const dIn = incomeSum(items);
          return (
            <LedgerDayGroup key={d} day={d}>
              <LedgerDayHead>
                {/* 날짜 머리 — 가계부 원장과 같은 요일 형식(올해 "11월 5일 (목)" · 다른 해 "2025년 11월 5일 (수)") + " · 오늘 · 어제" */}
                <LedgerDayDate relative={relOf(d)}>
                  {formatMonthDayDow(d)}
                </LedgerDayDate>
                {/* 그날 지출 · 수입 — 가계부 원장과 같은 부품(따로 · "원" 포함 · 수입 파란 글 · 자르지 않음) */}
                <LedgerDayTotals out={dOut} inn={dIn} />
              </LedgerDayHead>
              <div>
                {items.map((e) => (
                  <ExpenseRow key={e.rowId} expense={e} onClick={setDetail} />
                ))}
              </div>
            </LedgerDayGroup>
          );
        })}
      </LedgerList>
    );
  })();

  return (
    <div className={cn("flex flex-1 flex-col", !mobile && "page")}>
      {!mobile && (
        <PageHead
          title={tl("search")}
          actions={
            <AdvancedFilter
              placement="title"
              condition={condition}
              onApply={update}
            />
          }
        />
      )}
      <ScrollAutoHide
        scrollContainerRef={scrollRef}
        // 폰은 문서가 스크롤 — 머리 바로 아래에 붙는다(768 이상은 본문 상자 맨 위 = 0)
        style={{ top: "var(--shell-top, 0px)" }}
        className={cn(
          // 머리(z-sticky)보다 낮아야 한다 — 문서가 스크롤하는 폰에서 숨는 칩 줄이 머리 위로 비쳐 보이면 안 된다
          "z-30 py-x1_5",
          mobile ? "bg-surface-default px-global-gutter" : "bg-bg-page",
        )}
      >
        <ChipRadioGroup
          aria-label={t("searchTypeGroup")}
          layout={mobile ? "scroll" : "wrap"}
          bleed={mobile}
          value={condition.type}
          onValueChange={(v) => update({ type: v as SearchType })}
        >
          <ChipRadio variant="outlineStrong" size="medium" value="all">
            {t("searchTypeAll")}
          </ChipRadio>
          <ChipRadio variant="outlineStrong" size="medium" value="EXPENSE">
            {t("searchTypeExpense")}
          </ChipRadio>
          <ChipRadio variant="outlineStrong" size="medium" value="INCOME">
            {t("searchTypeIncome")}
          </ChipRadio>
        </ChipRadioGroup>
      </ScrollAutoHide>
      <div
        className={cn("flex flex-1 flex-col", mobile && "px-global-gutter")}
        aria-live="polite"
      >
        {body}
      </div>
      {detail && (
        <TxDetailDialog
          expense={detail}
          mobile={mobile}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
