import { useEffect, useMemo, useRef, useState } from "react";
import { Receipt, Search } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChipRadio, ChipRadioGroup } from "@/shared/ds/chip";
import { ResultSection } from "@/shared/ds/result-section";
import { ScrollAutoHide } from "@/shared/ds/scroll-auto-hide";
import { Skeleton } from "@/shared/ds/skeleton";
import { cn } from "@/shared/lib/cn";
import { KRW, formatDay, minusOf } from "@/shared/lib/groo/format";
import {
  LedgerDayDate,
  LedgerDayGroup,
  LedgerDayHead,
  LedgerDaySum,
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
  const { mobile } = useOutletContext<{ mobile: boolean }>();
  const { condition, update } = useSearchCondition();
  const debounced = useDebounced(condition, 350);
  const idle = isIdle(debounced);
  const query = useSearchExpenses(toSearchParams(debounced));
  const [detail, setDetail] = useState<Expense | null>(null);

  // 스크롤 상자는 셸의 main — 칩 줄이 이 상자 맨 위에서 숨고 드러난다
  const scrollRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    scrollRef.current = document.getElementById("main");
  }, []);

  const groups = useMemo(() => {
    const by = new Map<string, Expense[]>();
    for (const e of query.data ?? []) {
      const d = e.expenseDate?.slice(0, 10);
      if (!d) continue;
      by.set(d, [...(by.get(d) ?? []), e]);
    }
    return [...by.entries()].sort(([a], [b]) => (a < b ? 1 : -1));
  }, [query.data]);

  const body = (() => {
    if (idle)
      return (
        <ResultSection
          size="large"
          icon={<Search />}
          title={t("searchEmptyHint")}
        />
      );
    if (query.isError)
      return <ResultSection kind="failure" title={t("searchFailed")} />;
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
          const { dow } = formatDay(d);
          const [yy, mm, dd] = d.split("-");
          const dOut = expenseSum(items);
          const dIn = incomeSum(items);
          return (
            <LedgerDayGroup key={d} day={d}>
              <LedgerDayHead>
                <LedgerDayDate>
                  {(yy ?? "").slice(2)}. {Number(mm)}. {Number(dd)}({dow})
                </LedgerDayDate>
                <LedgerDaySum className="num">
                  {dOut > 0 && (
                    <span className="text-fg-neutral">
                      {minusOf(dOut)}
                      {KRW(dOut)}
                    </span>
                  )}
                  {dIn > 0 && (
                    <span className="ml-x2 text-fg-brand">+{KRW(dIn)}</span>
                  )}
                </LedgerDaySum>
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
        className={cn(
          "z-(--z-sticky) py-x1_5",
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
