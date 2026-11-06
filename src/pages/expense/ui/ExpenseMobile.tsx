import { MonthTitle, MonthTitleStatic } from "@/shared/ui/groo/month-title";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { FunnelX, Plus, ReceiptText, SlidersHorizontal } from "lucide-react";
import { useDsText, withCommaBreaks } from "@/shared/ds/i18n";
import { ResultSection } from "@/shared/ds/result-section";
import { SwipeActionsProvider } from "@/shared/ds/swipe-actions";
import { Skeleton } from "@/shared/ds/skeleton";
import { cn } from "@/shared/lib/cn";
import { formatMonthDayDow } from "@/shared/lib/date";
import { KRW, MINUS, formatDay, isEn, minusOf } from "@/shared/lib/groo/format";
import {
  INSIGHT_SAME_MAX,
  insightDiffAmount,
} from "@/pages/expense/lib/insight";
import { monthFromQuery } from "@/pages/expense/lib/month-query";
import {
  useExpenseSwipeActions,
  type ExpenseSwipeAction,
} from "@/pages/expense/lib/use-expense-swipe-actions";
import {
  dayKeyOf,
  monthWeeks,
  pickWeek,
} from "@/pages/expense/model/month-weeks";
import { MaskAmount, WonUnit } from "@/shared/lib/groo/hide-amounts";
import {
  HIDE_AMOUNTS_MASK,
  useHideAmounts,
  wonPre,
} from "@/shared/lib/groo/hide-amounts-core";
import { useLedgerScroll } from "@/shared/ui/groo/use-ledger-scroll";
import { TransferRow } from "@/entities/asset";
import { TransferDetailDialog } from "@/widgets/expense-detail/ui/TransferDetailDialog";
import { useRangeSummary, useExpenseCategories } from "@/features/expense";
import { useAssetCurrencyOf, useAssets } from "@/features/asset";
import type { AssetTransfer } from "@/entities/asset";
import type { Expense } from "@/entities/expense";
import { FilterDialog } from "@/features/expense/ui/FilterDialog";
import {
  monthPeriodOf,
  type FilterValue,
} from "@/features/expense/model/filter";
import { countableTx, expenseSum, incomeSum } from "@/entities/expense";
import { AddTxSheet } from "@/widgets/add-tx";
import { TxDetailDialog } from "@/widgets/expense-detail/ui/TxDetailDialog";
import {
  CALENDAR_CELL_CARDS,
  INSIGHT_CARDS,
} from "@/pages/expense/model/mobile-consts";
import {
  dayKey,
  filterActiveCount,
  groupLedgerByDay,
  ledgerKey,
  monthRange,
  useAssetFilter,
  useExpenseData,
} from "@/pages/expense/model/ledger-data";
import { ExpenseSwipeRow, SwipeConfirmDialog } from "./ExpenseSwipeRow";
import {
  DayGroupSkeleton,
  FilterChipsRow,
  SummaryRows,
} from "./ExpenseMobileParts";
import {
  LedgerCell,
  LedgerCellAmt,
  LedgerCellNum,
  LedgerCellTip,
  LedgerBar,
  LedgerCalendar,
  LedgerDayDate,
  LedgerDayGroup,
  LedgerDayHead,
  LedgerDaySum,
  LedgerDivider,
  LedgerDow,
  LedgerExpand,
  LedgerHead,
  LedgerKeep,
  LedgerList,
  LedgerMonthNav,
  LedgerNavBtn,
  LedgerPin,
  LedgerPrevBtn,
  LedgerShell,
  LedgerSub,
  LedgerSumBtn,
  LedgerTotal,
  LedgerWeek,
} from "@/shared/ui/groo/ledger";

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** 칸 툴팁 폭의 반(chart 툴팁 최소 128 + 좌우 12 의 반올림) — 달력 양 끝에서 이만큼 들인다 */
const TIP_HALF_WIDTH = 84;

/** 모바일 가계부 — 캘린더 스트립 + 리스트 통합 뷰 (design tx-mobile.jsx SoT, 현대카드 모티브).
 *  탭 전환 없음: 월네비 → 총액+인사이트+[소비 요약] → 접이식 캘린더(일별 합계) → 날짜그룹 리스트. */
const TXM_PAD = (n: number) => String(n).padStart(2, "0");

function shiftMonthKey(monthKey: string, delta: number): string {
  const [yStr, mStr] = monthKey.split("-");
  let y = Number(yStr);
  let m = Number(mStr) + delta;
  while (m < 1) {
    y -= 1;
    m += 12;
  }
  while (m > 12) {
    y += 1;
    m -= 12;
  }
  return `${y}-${TXM_PAD(m)}`;
}

/** 월 라벨 — ko "7월" / en "Jul" (디자인 monthnav·prevbtn·empty 문구 공용). */
function txmMonthLabel(monthKey: string): string {
  const [y = 0, m = 1] = monthKey.split("-").map(Number);
  return isEn()
    ? new Date(y, m - 1, 1).toLocaleDateString("en", { month: "short" })
    : `${m}월`;
}

/** 요일 라벨 — formatDay 로케일 반환 재사용(2026-02-01 = 일요일). */
const dowLabelList = () =>
  Array.from(
    { length: 7 },
    (_, i) => formatDay(`2026-02-${TXM_PAD(i + 1)}`).dow,
  );

/** 폰 첫 진입 스켈레톤 — 틀(월 이동 · 요일 · 단추)은 그리고 서버 데이터 자리만 스켈레톤이다. */
export function ExpenseMobileSkeleton({ month }: { month?: string }) {
  const { t } = useTranslation("expense");
  const mk = month ?? currentMonthKey();
  const todayStr = dayKeyOf(new Date());
  // 실제 달력과 같은 주 · 같은 칸 — 이 달이면 오늘이 든 주, 아니면 첫 주. 달 밖은 빈 칸, 오는 날은 옅게
  const weeks = monthWeeks(mk);
  const week =
    weeks[
      pickWeek(weeks, todayStr.startsWith(mk) ? todayStr : null, todayStr)
    ] ?? [];
  return (
    <LedgerShell aria-busy="true">
      <div className="pt-x2">
        <LedgerMonthNav>
          <MonthTitleStatic month={mk} className="text-t6" />
          <LedgerNavBtn aria-label={t("filter.title")} className="ml-auto">
            <SlidersHorizontal />
          </LedgerNavBtn>
          <LedgerNavBtn aria-label={t("addTransaction")}>
            <Plus />
          </LedgerNavBtn>
        </LedgerMonthNav>
        <LedgerHead>
          <div className="min-w-0 flex-auto">
            <Skeleton text="t9" className="w-40" />
            <Skeleton text="t4" className="mt-x1_5 w-52 max-w-full" />
          </div>
          <LedgerSumBtn disabled>{t("txm.spendSummary")}</LedgerSumBtn>
        </LedgerHead>
        <LedgerCalendar>
          <LedgerDow labels={dowLabelList()} />
          <LedgerWeek>
            {week.map((c, i) =>
              c ? (
                <LedgerCell key={c.ds} empty>
                  <LedgerCellNum
                    dow={i}
                    future={c.ds > todayStr}
                    today={c.ds === todayStr}
                  >
                    {c.d}
                  </LedgerCellNum>
                  <Skeleton text="t1" className="w-x8" />
                </LedgerCell>
              ) : (
                <LedgerCell key={`e${i}`} empty />
              ),
            )}
          </LedgerWeek>
          <LedgerExpand aria-label={t("txm.monthCalendar")} disabled />
        </LedgerCalendar>
        <LedgerDivider />
      </div>
      <LedgerList className="-mx-global-gutter">
        <DayGroupSkeleton rows={3} />
        <DayGroupSkeleton rows={2} />
      </LedgerList>
    </LedgerShell>
  );
}

export function ExpenseMobile({ onAddTx }: { onAddTx: () => void }) {
  const { t } = useTranslation("expense");
  // 이체 줄은 보내는 · 받는 계좌 통화로 찍는다(I-13)
  const currencyOf = useAssetCurrencyOf();
  const dsT = useDsText();
  const [searchParams] = useSearchParams();
  const initialMonth = monthFromQuery(searchParams.get("month"));
  const focusTxId = Number(searchParams.get("txId")) || null;
  const [month, setMonth] = useState<string>(initialMonth);
  const { assetId, asset, clear } = useAssetFilter();
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterValue, setFilterValue] = useState<FilterValue | null>(null);
  // "소비 요약" 과 "월 달력" 은 하나만 펼친다(DESIGN.desk "원장 머리")
  const [expanded, setExpanded] = useState(false);
  const [sumOpen, setSumOpen] = useState(false);
  const toggleSummary = () => {
    setSumOpen((v) => !v);
    setExpanded(false);
  };
  const toggleCalendar = () => {
    setExpanded((v) => !v);
    setSumOpen(false);
  };
  const now = new Date();
  const todayStr = dayKeyOf(now);
  // 셀 차트형 툴팁(지출·수입) — hover 셀 기준 좌표 (사용자 결정).
  const [cellTip, setCellTip] = useState<{
    ds: string;
    left: number;
    top: number;
  } | null>(null);
  const calRef = useRef<HTMLDivElement | null>(null);
  // 스크롤 스파이 · lock — 공용 원장 훅. 머리 숨기기는 ds Scroll Auto Hide 가 맡는다(compact 는 쓰지 않는다)
  const {
    rootRef,
    pinRef,
    selected,
    setSelected,
    lock,
    scrollToDay,
    scrollToTop,
  } = useLedgerScroll({
    initialSelected: todayStr.startsWith(initialMonth) ? todayStr : null,
    // 펼친 월 달력은 펼친 채 내리기 시작하면 고른 날이 든 주로 접힌다
    expanded,
    onCollapse: () => setExpanded(false),
  });
  // 상세→편집 flow — EditableList 패턴 인라인(dayhead 형식이 달라 리스트 자체 렌더).
  const [detail, setDetail] = useState<Expense | null>(null);
  const [editing, setEditing] = useState<Expense | null>(null);
  // 스와이프 액션 — 상세 다이얼로그와 같은 뮤테이션·같은 확인 문구를 쓴다(아래
  // `useExpenseSwipeActions`). 행의 접근명만 여기서 만든다.
  const { t: tc } = useTranslation("common");

  const rowLabelOf = (e: Expense) =>
    e.merchant ?? e.description ?? e.categoryName ?? tc("transaction");

  // 지출 상세 → '환불' → 원거래를 승계한 환불 입력(수입 + 원거래 연결).
  // 이체는 지출과 별개 엔티티라 상세도 별도(수정 없이 삭제만).
  const [transferDetail, setTransferDetail] = useState<AssetTransfer | null>(
    null,
  );
  // 밀기 · ⋮ 의 삭제 — 확인창을 기다리는 동작
  const [pendingAction, setPendingAction] = useState<ExpenseSwipeAction | null>(
    null,
  );

  const categoriesQ = useExpenseCategories({ reference: true });
  const assetsQ = useAssets({ reference: true });
  // 밀면 [수정, 삭제] — 상세를 닫고 수정으로 가는 것은 상세 footer 의 수정과 같은 목적지.
  const swipeActionsFor = useExpenseSwipeActions({
    assets: assetsQ.data?.assets ?? [],
    onEdit: (e) => {
      setDetail(null);
      setEditing(e);
    },
  });
  const {
    expenses,
    transfers,
    monthIn,
    monthOut,
    isLoadingList,
    isLoadingSummary,
    isError,
    retry,
  } = useExpenseData(
    month,
    "all",
    filterValue,
    assetId,
    categoriesQ.data ?? null,
  );
  const viewPeriod = monthPeriodOf(month);
  const activeCount = filterActiveCount(filterValue, viewPeriod);

  // 인사이트 — 지난달 지출 대비 / 없으면 이번 달 최다 지출 카테고리.
  const prevRange = monthRange(shiftMonthKey(month, -1));
  const prevQ = useRangeSummary(
    prevRange.startDate,
    prevRange.endDate,
    undefined,
    { reference: true },
  );
  const curRange = monthRange(month);
  const curSummaryQ = useRangeSummary(
    curRange.startDate,
    curRange.endDate,
    undefined,
    { reference: true },
  );

  const insightHidden = useHideAmounts(INSIGHT_CARDS, "expense");
  const insight = useMemo(() => {
    if (isLoadingList || isLoadingSummary) return null;
    if (expenses.length === 0) return <>{t("txm.insightNone")}</>;
    const prevOut = prevQ.data?.totalExpense ?? 0;
    if (prevOut > 0) {
      const diff = prevOut - monthOut;
      if (Math.abs(diff) < INSIGHT_SAME_MAX) return <>{t("txm.insightSame")}</>;
      // 문장은 남기고 금액만 가린다 — 방향(덜/더)은 크기가 아니라서 그대로 둔다.
      const amount = insightHidden
        ? HIDE_AMOUNTS_MASK
        : insightDiffAmount(diff);
      return (
        <Trans
          t={t}
          i18nKey={diff > 0 ? "txm.insightLess" : "txm.insightMore"}
          values={{ amount }}
          components={{
            hl: (
              <b
                className={cn(
                  "font-bold",
                  diff > 0 ? "text-fg-brand" : "text-fg-critical",
                )}
              />
            ),
          }}
        />
      );
    }
    const top = (curSummaryQ.data?.categoryBreakdown ?? [])
      .filter((b) => b.expenseType === "EXPENSE")
      .slice()
      .sort((a, b) => b.totalAmount - a.totalAmount)[0];
    if (top) {
      return (
        <Trans
          t={t}
          i18nKey="txm.insightTopCat"
          values={{ cat: top.categoryName }}
          components={{
            hl: <b className="font-bold text-fg-brand" />,
          }}
        />
      );
    }
    return null;
  }, [
    isLoadingList,
    isLoadingSummary,
    expenses.length,
    prevQ.data,
    curSummaryQ.data,
    monthOut,
    insightHidden,
    t,
  ]);

  // 일별 합계 — 캘린더 셀 밑 금액.
  const byDay = useMemo(() => {
    const m: Record<string, { out: number; inn: number }> = {};
    // 서버 집계와 같은 규칙 — 환불된 것과 아직 안 온 건 `countableTx` 가 이미 뺀다.
    for (const e of countableTx(expenses)) {
      const k = dayKey(e.expenseDate);
      m[k] = m[k] || { out: 0, inn: 0 };
      if (e.expenseType === "EXPENSE") m[k].out += Math.abs(e.amount);
      else m[k].inn += Math.abs(e.amount);
    }
    return m;
  }, [expenses]);

  // 툴팁이 가리키는 날의 합계 — 한 번만 집는다. 값을 자리마다 다시 꺼내면
  // 부호를 붙이는 자리와 숫자를 그리는 자리가 갈려 어긋나기 쉽다.
  const tipDay = cellTip ? byDay[cellTip.ds] : undefined;

  // 캘린더 주(week) 구성.
  const weeks = useMemo(() => monthWeeks(month), [month]);
  const selWeek = pickWeek(weeks, selected, todayStr);

  const pickMonth = (next: string) => {
    setMonth(next);
    setSelected(todayStr.startsWith(next) ? todayStr : null);
    setExpanded(false);
    lock(800);
    scrollToTop();
  };
  const goMonth = (dir: -1 | 1) => pickMonth(shiftMonthKey(month, dir));

  const dowLabels = useMemo(() => dowLabelList(), []);

  const grouped = useMemo(
    () => groupLedgerByDay(expenses, transfers),
    [expenses, transfers],
  );
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  const yesterdayStr = `${yest.getFullYear()}-${TXM_PAD(yest.getMonth() + 1)}-${TXM_PAD(yest.getDate())}`;
  const relOf = (d: string) =>
    d === todayStr
      ? t("txm.today")
      : d === yesterdayStr
        ? t("txm.yesterday")
        : null;

  const focusRef = useRef<HTMLDivElement | null>(null);
  // 줄이 그려진 뒤에 옮긴다 — 이체 목록이 늦게 와서 줄이 나중에 그려지면 거래 수는 그대로라 예전엔 한 번도 옮기지 못했다
  useEffect(() => {
    if (focusTxId && !isLoadingList && focusRef.current) {
      focusRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusTxId, isLoadingList, expenses.length]);

  // 필터 활성 시 — 월선택/총액/캘린더/divider 숨기고 온전히 리스트만(사용자 결정).
  const filterActive = activeCount > 0 || !!asset;
  // 요약을 받는 중이거나 불러오지 못했다 — 0 원 줄을 그리지 않고 [소비 요약] 을 막는다
  const summaryWaiting = isLoadingSummary || isError;
  const isEmpty = expenses.length === 0 && transfers.length === 0;

  // 본문 — 불러오는 중 · 실패 · 비어 있음 · 날짜 묶음
  let body: React.ReactNode;
  if (isError) {
    body = (
      <ResultSection
        kind="failure"
        title={t("txm.loadFailed")}
        description={t("txm.loadFailedDesc")}
        primaryAction={{ label: dsT("common.retry"), onClick: retry }}
      />
    );
  } else if (isLoadingList) {
    body = (
      <div aria-busy="true">
        <DayGroupSkeleton rows={3} />
        <DayGroupSkeleton rows={2} />
      </div>
    );
  } else if (isEmpty) {
    // 걸러서 0건 · 이 달 0건 — 버튼은 없다(거래 추가는 탭 바의 + 가 맡는다)
    body = filterActive ? (
      <ResultSection
        icon={<FunnelX />}
        title={t("txm.emptyFiltered")}
        description={t("txm.emptyFilteredDesc")}
      />
    ) : (
      <ResultSection
        icon={<ReceiptText />}
        title={t("txm.emptyMonth", { month: txmMonthLabel(month) })}
        description={t("txm.emptyMonthDesc")}
      />
    );
  } else {
    body = grouped.map(([d, items]) => {
      const rel = relOf(d);
      // 일별 합계 — 이체는 자산 간 이동이라 지출/수입 어느 쪽에도 넣지 않는다.
      const dayExpenses = items.flatMap((i) =>
        i.kind === "expense" ? [i.expense] : [],
      );
      const dOut = expenseSum(dayExpenses);
      const dIn = incomeSum(dayExpenses);
      return (
        <LedgerDayGroup key={d} day={d}>
          <LedgerDayHead gutter>
            {/* 날짜 머리 — 요일 형식(올해 "10월 25일 (일)" · 다른 해 "2025년 10월 25일 (토)" · en "Sun, Oct 25"), 할 일 원장과 같은 유틸 */}
            <LedgerDayDate relative={rel}>{formatMonthDayDow(d)}</LedgerDayDate>
            {(dOut > 0 || dIn > 0) && (
              <LedgerDaySum className="num">
                {dOut > 0 && (
                  <span className="text-fg-neutral">
                    <MaskAmount card="ledger.txList" kind="expense">
                      {MINUS}
                      {wonPre()}
                      {withCommaBreaks(KRW(dOut))}
                    </MaskAmount>
                    <WonUnit card="ledger.txList" kind="expense" />
                  </span>
                )}
                {dIn > 0 && (
                  <span className="ml-x2 text-fg-brand">
                    <MaskAmount card="ledger.txList" kind="income">
                      +{wonPre()}
                      {withCommaBreaks(KRW(dIn))}
                    </MaskAmount>
                    <WonUnit card="ledger.txList" kind="income" />
                  </span>
                )}
              </LedgerDaySum>
            )}
          </LedgerDayHead>
          <div>
            {items.map((item) => {
              // 지출·이체는 다른 테이블이라 rowId 가 겹칠 수 있다 — key·포커스는 종류까지 합쳐 판별.
              const isFocus =
                item.kind === "expense" && focusTxId === item.expense.rowId;
              return item.kind === "expense" ? (
                <ExpenseSwipeRow
                  key={ledgerKey(item)}
                  expense={item.expense}
                  rowRef={isFocus ? focusRef : undefined}
                  highlighted={isFocus}
                  rowLabel={rowLabelOf(item.expense)}
                  // 시스템이 만든 거래(매도 실현손익·이체 이자)는 원본을 지워야 사라진다 —
                  // 상세 다이얼로그가 버튼을 감추는 것과 같은 조건으로 액션 자체를 없앤다.
                  actions={
                    item.expense.autoSource != null
                      ? []
                      : swipeActionsFor(item.expense)
                  }
                  onOpen={(ex) => setDetail(ex)}
                  onAsk={setPendingAction}
                />
              ) : (
                // 이체 행은 감싸지 않는다 — 앱도 제외한다. 줄 · 누름 바탕은 화면 끝까지
                <TransferRow
                  key={ledgerKey(item)}
                  gutter
                  transfer={item.transfer}
                  currencyOf={currencyOf}
                  onClick={(tr) => setTransferDetail(tr)}
                />
              );
            })}
          </div>
        </LedgerDayGroup>
      );
    });
  }

  return (
    <SwipeActionsProvider>
      <LedgerShell ref={rootRef}>
        {/* 머리 — 월 이동 줄 · 주 달력은 늘 남고(페이지 전체를 조절하는 줄 — 한 덩어리), 총액 · 인사이트 · 소비 요약만 내리면 숨고
            올리면 드러난다(Scroll Auto Hide). 목록을 내리면 고른 날이 맨 위 날짜 묶음을 따라간다(스크롤 스파이) */}
        <LedgerBar>
          {/* 월 네비 + 필터/추가 */}
          <LedgerMonthNav>
            {!filterActive && (
              <>
                <MonthTitle
                  month={month}
                  onChange={pickMonth}
                  className="text-t6"
                />
              </>
            )}
            {/* 걸린 조건은 아래 칩 줄이 말한다 — 단추에 개수 배지 · 켜짐 틴트를 두지 않는다 */}
            <LedgerNavBtn
              aria-label={t("filter.title")}
              onClick={() => setFilterOpen(true)}
              className="ml-auto"
            >
              <SlidersHorizontal />
            </LedgerNavBtn>
            <LedgerNavBtn aria-label={t("addTransaction")} onClick={onAddTx}>
              <Plus />
            </LedgerNavBtn>
          </LedgerMonthNav>
        </LedgerBar>
        <LedgerPin ref={pinRef}>
          {/* 거르기 중 칩 줄은 주 달력 자리에서 남는다(Keep) — 무엇이 걸러져 보이는지 말하는 페이지 전체 조절 줄이라, 숨기면 거른 채라는
              걸 잊고 "거래가 이것뿐" 으로 읽는다. 이때 총액 · 요약 · 달력은 그리지 않으므로 숨는 부분이 없다 */}
          {filterActive && (
            <LedgerKeep>
              <FilterChipsRow
                filterValue={filterValue}
                onChange={(v) =>
                  setFilterValue(
                    v && filterActiveCount(v, viewPeriod) > 0 ? v : null,
                  )
                }
                assetName={asset?.assetName}
                onClearAsset={clear}
                categories={categoriesQ.data ?? []}
                assets={assetsQ.data?.assets ?? []}
              />
            </LedgerKeep>
          )}

          {/* 총액 + 인사이트 + 소비 요약. 필터 활성 시 숨김. 불러오지 못했어도 틀(머리 · 주 달력)은 그린다 */}
          {!filterActive && (
            <>
              <LedgerHead>
                <div className="min-w-0 flex-auto">
                  <LedgerTotal className="num">
                    {isError ? null : isLoadingSummary ? (
                      <Skeleton text="t9" className="w-40" />
                    ) : (
                      <>
                        <MaskAmount card="ledger.monthSummary" kind="expense">
                          {wonPre()}
                          {withCommaBreaks(KRW(monthOut))}
                        </MaskAmount>
                        <WonUnit card="ledger.monthSummary" kind="expense" />
                      </>
                    )}
                  </LedgerTotal>
                  {isError ? null : isLoadingSummary ? (
                    <Skeleton text="t4" className="mt-x1_5 w-52 max-w-full" />
                  ) : (
                    insight && <LedgerSub>{insight}</LedgerSub>
                  )}
                </div>
                <LedgerSumBtn
                  aria-expanded={sumOpen && !isError}
                  disabled={summaryWaiting}
                  onClick={toggleSummary}
                >
                  {t("txm.spendSummary")}
                </LedgerSumBtn>
              </LedgerHead>

              {sumOpen && !isError && (
                <SummaryRows
                  loading={isLoadingSummary}
                  incomeLabel={t("income")}
                  expenseLabel={t("expense")}
                  totalLabel={t("txDetail.sumLabel")}
                  monthIn={monthIn}
                  monthOut={monthOut}
                />
              )}

              {/* 캘린더 — 접힘: 선택 주 1줄 / 펼침: 월 전체. 필터 적용 시 숨김(리스트만, 사용자 결정). 숨지 않고 남는다(Keep) — 펼친 달력도 */}
              <LedgerKeep>
                <LedgerCalendar ref={calRef}>
                  <LedgerDow labels={dowLabels} />
                  {(expanded ? weeks : [weeks[selWeek] ?? []]).map((w, wi) => (
                    <LedgerWeek key={wi}>
                      {w.map((c, i) => {
                        if (!c) return <LedgerCell key={`e${i}`} empty />;
                        const isSel = c.ds === selected;
                        const data = byDay[c.ds];
                        return (
                          <LedgerCell
                            key={c.ds}
                            selected={isSel}
                            onClick={() => {
                              setSelected(c.ds);
                              if (data) {
                                lock(800);
                                scrollToDay(c.ds);
                              }
                            }}
                            onMouseEnter={(e) => {
                              if (!data || !calRef.current) return;
                              const cell =
                                e.currentTarget.getBoundingClientRect();
                              const cal =
                                calRef.current.getBoundingClientRect();
                              // 툴팁은 칸 가운데 위에 뜨되 달력 밖으로 잘리지 않게 양 끝에서 반 폭만큼 들인다
                              const center =
                                cell.left - cal.left + cell.width / 2;
                              setCellTip({
                                ds: c.ds,
                                left: Math.min(
                                  Math.max(center, TIP_HALF_WIDTH),
                                  cal.width - TIP_HALF_WIDTH,
                                ),
                                top: cell.top - cal.top,
                              });
                            }}
                            onMouseLeave={() => setCellTip(null)}
                          >
                            <LedgerCellNum
                              dow={i % 7}
                              future={c.ds > todayStr}
                              today={c.ds === todayStr}
                              selected={isSel}
                            >
                              {c.d}
                            </LedgerCellNum>
                            {/* 지출·수입 병기(각 줄) — 색은 아래 리스트와 동일(사용자 결정). 빼기는 U+2212. */}
                            {data && data.out > 0 && (
                              <LedgerCellAmt tone="expense">
                                <MaskAmount
                                  card={CALENDAR_CELL_CARDS}
                                  kind="expense"
                                  mask="••"
                                >
                                  {MINUS}
                                  {KRW(data.out)}
                                </MaskAmount>
                              </LedgerCellAmt>
                            )}
                            {data && data.inn > 0 && (
                              <LedgerCellAmt tone="income">
                                <MaskAmount
                                  card={CALENDAR_CELL_CARDS}
                                  kind="income"
                                  mask="••"
                                >
                                  +{KRW(data.inn)}
                                </MaskAmount>
                              </LedgerCellAmt>
                            )}
                            {!data &&
                              (isLoadingList ? (
                                <Skeleton text="t1" className="w-x8" />
                              ) : (
                                <LedgerCellAmt />
                              ))}
                          </LedgerCell>
                        );
                      })}
                    </LedgerWeek>
                  ))}
                  <LedgerExpand
                    aria-label={t("txm.monthCalendar")}
                    expanded={expanded}
                    onClick={toggleCalendar}
                  />
                  {/* 차트형 셀 툴팁 — chart 툴팁 값 그대로(지출 chart-red · 수입 chart-blue, 머리는 날짜 "10월 21일 (목)"). */}
                  {cellTip && tipDay && (
                    <LedgerCellTip
                      left={cellTip.left}
                      top={cellTip.top}
                      title={`${formatDay(cellTip.ds).md} (${formatDay(cellTip.ds).dow})`}
                      rows={[
                        {
                          name: t("expense"),
                          color: "var(--color-chart-red)",
                          value: tipDay.out,
                          node: (
                            <>
                              <MaskAmount
                                card={CALENDAR_CELL_CARDS}
                                kind="expense"
                              >
                                {minusOf(tipDay.out)}
                                {wonPre()}
                                {KRW(Math.abs(tipDay.out))}
                              </MaskAmount>
                              <WonUnit
                                card={CALENDAR_CELL_CARDS}
                                kind="expense"
                              />
                            </>
                          ),
                        },
                        {
                          name: t("income"),
                          color: "var(--color-chart-blue)",
                          value: tipDay.inn,
                          node: (
                            <>
                              <MaskAmount
                                card={CALENDAR_CELL_CARDS}
                                kind="income"
                              >
                                +{wonPre()}
                                {KRW(tipDay.inn)}
                              </MaskAmount>
                              <WonUnit
                                card={CALENDAR_CELL_CARDS}
                                kind="income"
                              />
                            </>
                          ),
                        },
                      ]}
                    />
                  )}
                </LedgerCalendar>

                <LedgerDivider />
              </LedgerKeep>
            </>
          )}
        </LedgerPin>

        {/* 거래 리스트 — 날짜 그룹 */}
        <LedgerList className="-mx-global-gutter">{body}</LedgerList>

        {!filterActive && !isError && (
          <LedgerPrevBtn onClick={() => goMonth(-1)}>
            {t("txm.prevMonthBtn", {
              month: txmMonthLabel(shiftMonthKey(month, -1)),
            })}
          </LedgerPrevBtn>
        )}

        {detail && !editing && (
          <TxDetailDialog
            expense={detail}
            mobile
            onClose={() => setDetail(null)}
          />
        )}
        {editing && (
          <AddTxSheet
            expense={editing}
            mobile
            onClose={() => setEditing(null)}
          />
        )}
        {transferDetail && (
          <TransferDetailDialog
            transfer={transferDetail}
            mobile
            onClose={() => setTransferDetail(null)}
          />
        )}
        {filterOpen && (
          <FilterDialog
            initial={filterValue}
            defaultPeriod={viewPeriod}
            categories={categoriesQ.data ?? []}
            assets={assetsQ.data?.assets ?? []}
            onClose={() => setFilterOpen(false)}
            onApply={(v) => {
              setFilterValue(v);
              setFilterOpen(false);
            }}
          />
        )}
        <SwipeConfirmDialog
          action={pendingAction}
          onClose={() => setPendingAction(null)}
        />
      </LedgerShell>
    </SwipeActionsProvider>
  );
}
