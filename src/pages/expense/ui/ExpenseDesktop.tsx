import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card } from "@/shared/ds/card";
import { useWideSurface } from "@/shared/ds/overlay";
import { Skeleton } from "@/shared/ds/skeleton";
import { useSnackbar } from "@/shared/ds/snackbar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/shared/ds/alert-dialog";
import { PageHead } from "@/shared/ui/groo/page-head";
import { money } from "@/shared/lib/groo/format";
import {
  HIDE_AMOUNTS_MASK,
  useHideAmounts,
} from "@/shared/lib/groo/hide-amounts-core";
import { formatMonthShort } from "@/shared/lib/date";
import type { Expense } from "@/entities/expense";
import {
  closedCycleSpan,
  expenseSum,
  incomeSum,
  type ClosedCycleSpan,
} from "@/entities/expense";
import { editAssetPath, type AssetTransfer } from "@/entities/asset";
import {
  useBulkDeleteExpenses,
  useBulkMarkFixed,
  useExpenseCategories,
} from "@/features/expense";
import { useAssets } from "@/features/asset";
import { FilterBar } from "@/features/expense/ui/FilterBar";
import {
  hasActiveFilter,
  monthPeriodOf,
  periodMonthBounds,
  type FilterValue,
} from "@/features/expense/model/filter";
import { TxDetailDialog } from "@/widgets/expense-detail/ui/TxDetailDialog";
import { TransferDetailDialog } from "@/widgets/expense-detail/ui/TransferDetailDialog";
import { monthFromQuery } from "@/pages/expense/lib/month-query";
import {
  clampMonth,
  dailyTotals,
  todayKey,
} from "@/pages/expense/model/calendar-model";
import {
  groupLedgerByDay,
  useAssetFilter,
  useExpenseData,
} from "@/pages/expense/model/ledger-data";
import { BulkBar } from "./desktop/BulkBar";
import { BulkDeleteDialog } from "./desktop/BulkDeleteDialog";
import { ListCard } from "./desktop/ListCard";
import { MiniCalendar } from "./desktop/MiniCalendar";
import { SummaryCard } from "./desktop/SummaryCard";

/** 한 번에 지우거나 고정으로 표시할 수 있는 건수 — 서버 상한 */
const BULK_LIMIT = 500;

/** 화면 틀 — 제목 줄(h1 "가계부") 아래 24, 좌우 여백 32, 본문 폭은 768 ~ 1279 최대 720 · 1280 이상 최대 1040 가운데(4A, medium 밀도) */
function Frame({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation("expense");
  return (
    <div
      data-slot="expense-desktop"
      className="px-[var(--layout-margin)] pb-screen-bottom pt-nav-to-title"
    >
      <div className="mx-auto w-full max-w-[var(--layout-max-low)] lg:max-w-[var(--layout-max-medium)]">
        <PageHead
          title={t("title")}
          style={{ marginBottom: "var(--spacing-x6)" }}
        />
        {children}
      </div>
    </div>
  );
}

/** 첫 진입 스켈레톤 — 화면 틀(제목 · 카드 둘)은 그리고 서버 데이터 자리만 스켈레톤이다 */
export function ExpenseDesktopSkeleton() {
  const wide = useWideSurface();
  const side = (
    <Card aria-hidden className="p-x6">
      <Skeleton text="t6" className="w-40" />
      <Skeleton text="t4" className="mt-x4 w-full" />
      <Skeleton text="t4" className="mt-x2 w-full" />
    </Card>
  );
  const list = (
    <Card aria-hidden className="p-x6">
      <Skeleton text="t5" className="w-32" />
      <Skeleton text="t4" className="mt-x4 w-full" />
      <Skeleton text="t4" className="mt-x2 w-full" />
    </Card>
  );
  return (
    <Frame>
      {wide ? (
        <div className="grid grid-cols-[336px_minmax(0,1fr)] gap-x6">
          {side}
          {list}
        </div>
      ) : (
        <div className="flex flex-col gap-x4">
          {side}
          {list}
        </div>
      )}
    </Frame>
  );
}

/**
 * 가계부 — 데스크톱(1280 이상: 왼쪽 작은 달력 + 오른쪽 날짜 묶음 목록) · 태블릿(768 ~ 1279: 위 요약 카드 + 아래 목록).
 * 같은 트리에서 폭만 다르다(짝 2 — I-07 24 ~ 39). 달 하나 = 한 쪽: 달 이동이 쪽 넘김이고 주소의 `?month=` 에 적는다(뒤로 가기로 앞 달).
 * 필터 기간이 걸리면(Q5-C) 작은 달력은 기간의 첫 달을 보이고 ‹ › 는 기간 안에서만 — 목록 · 요약은 기간 전체다.
 */
export function ExpenseDesktop() {
  const { t } = useTranslation("expense");
  const { t: tc } = useTranslation("common");
  const navigate = useNavigate();
  const wide = useWideSurface();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlMonth = monthFromQuery(searchParams.get("month"));
  const focusTxId = Number(searchParams.get("txId")) || null;
  const [filterValue, setFilterValue] = useState<FilterValue | null>(null);
  const { assetId, asset, clear: clearAsset } = useAssetFilter();
  const categoriesQ = useExpenseCategories({ reference: true });
  const assetsQ = useAssets({ reference: true });

  // 기간이 걸렸으면 달력은 그 기간 안의 달만 본다
  const bounds = periodMonthBounds(filterValue);
  const month = clampMonth(urlMonth, bounds);
  const data = useExpenseData(
    month,
    "all",
    filterValue,
    assetId,
    categoriesQ.data ?? null,
  );
  const grouped = useMemo(
    () => groupLedgerByDay(data.expenses, data.transfers),
    [data.expenses, data.transfers],
  );
  const lineCount = grouped.reduce((n, [, items]) => n + items.length, 0);
  const byDay = useMemo(
    () => dailyTotals(data.monthExpenses),
    [data.monthExpenses],
  );
  const today = todayKey();
  const filtered = hasActiveFilter(filterValue) || assetId != null;

  // ── 고르기 모드 ──
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<ReadonlySet<number>>(new Set());
  const selectable = useMemo(() => {
    const m = new Map<number, Expense>();
    for (const e of data.expenses) if (e.autoSource == null) m.set(e.rowId, e);
    return m;
  }, [data.expenses]);
  // 보이지 않는 줄을 고른 채 두지 않는다(목록이 바뀌어 사라진 것은 뺀다)
  const chosen = useMemo(
    () => [...picked].flatMap((id) => selectable.get(id) ?? []),
    [picked, selectable],
  );
  const chosenIds = chosen.map((e) => e.rowId);
  const chosenSum = incomeSum(chosen) - expenseSum(chosen);
  const overLimit = chosen.length > BULK_LIMIT;
  const clearPicked = () => setPicked(new Set());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const bulkFixed = useBulkMarkFixed();
  const bulkDelete = useBulkDeleteExpenses();
  const snackbar = useSnackbar();
  const hideAmount = useHideAmounts("ledger.txList", "net");

  // ── 달 · 필터를 바꾸면 고른 것을 모두 푼다(모드는 그대로) ──
  const goMonth = (m: string) => {
    clearPicked();
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev);
      n.set("month", m);
      n.delete("txId");
      return n;
    });
    document.getElementById("main")?.scrollTo?.({ top: 0 });
  };
  // 기간이 걸려 있으면 달 고르기도 그 기간의 달 안으로 모은다(‹ › 가 있을 때 막던 것과 같은 범위)
  const pickMonth = (m: string) => goMonth(clampMonth(m, bounds));
  const changeFilter = (next: FilterValue | null) => {
    clearPicked();
    setFilterValue(next);
    const nb = periodMonthBounds(next);
    // 기간을 새로 걸면 작은 달력은 기간의 첫 달로
    if (nb && (nb.first !== bounds?.first || nb.last !== bounds?.last))
      goMonth(nb.first);
  };
  const firstChip = useRef<HTMLButtonElement | null>(null);
  const clearAll = () => {
    clearPicked();
    setFilterValue(null);
    clearAsset();
    requestAnimationFrame(() => firstChip.current?.focus());
  };

  // ── 날 누르기 · 들어온 거래로 옮기기 ──
  const listRef = useRef<HTMLDivElement | null>(null);
  const scrollToDay = (ds: string) => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-day-group="${ds}"]`,
    );
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    el.scrollIntoView({
      block: "start",
      behavior: reduce?.matches ? "auto" : "smooth",
    });
  };
  const focusRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (focusTxId && !data.isLoadingList && focusRef.current) {
      focusRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusTxId, data.isLoadingList, data.expenses.length]);

  // ── 상세 · 수정 · 이체 상세 (여는 자리만 — 시트 안 모양은 거래 시트 몫) ──
  const [detail, setDetail] = useState<Expense | null>(null);
  const [transferDetail, setTransferDetail] = useState<AssetTransfer | null>(
    null,
  );

  // ── 일괄 동작 ──
  // 바가 사라지면 초점이 갈 곳을 잃는다 — [완료](고르기 모드 단추)로 보낸다(I-07 34)
  const actionRef = useRef<HTMLElement | null>(null);
  const focusAction = () =>
    requestAnimationFrame(() => actionRef.current?.focus());
  const clearPickedAndFocus = () => {
    clearPicked();
    focusAction();
  };
  const markFixed = async (ids: number[] = chosenIds) => {
    try {
      const res = await bulkFixed.mutateAsync({
        ids,
        isFixed: true,
        silent: true,
      });
      snackbar.show({
        message: t("bulk.fixedDone", { count: res.updatedCount }),
      });
      clearPickedAndFocus();
    } catch {
      // 실패하면 고른 것을 그대로 두고 critical 스낵바 + [다시 시도](같은 요청을 바로)
      snackbar.show({
        message: t("bulk.fixedFailed"),
        tone: "critical",
        action: { label: tc("retry"), onClick: () => void markFixed(ids) },
      });
    }
  };
  const assets = useMemo(() => assetsQ.data?.assets ?? [], [assetsQ.data]);
  const closedInfo = useMemo(() => {
    let span: ClosedCycleSpan | null = null;
    const payAccounts = new Set<number>();
    let closedCards = 0;
    const cards = new Set<number>();
    for (const e of chosen) {
      const a = assets.find((x) => x.rowId === e.assetRowId);
      if (a?.assetType !== "CREDIT_CARD") continue;
      const s = closedCycleSpan(
        e.expenseDate,
        e.installmentMonths,
        a.cardClosedThrough,
      );
      if (!s) continue;
      if (!cards.has(a.rowId)) {
        cards.add(a.rowId);
        closedCards += 1;
        if (a.paymentAssetRowId != null) payAccounts.add(a.paymentAssetRowId);
      }
      span = s === "partial" || span === "partial" ? "partial" : "closed";
    }
    // [잔액 고치기] 는 닫힌 회차 카드가 하나이고 결제계좌가 있을 때만(Q7-A)
    const fixTarget =
      closedCards === 1 && payAccounts.size === 1 ? [...payAccounts][0]! : null;
    return { span, fixTarget };
  }, [chosen, assets]);
  // 삭제가 끝난 뒤 환급이 있으면 알림 창(Alert Dialog single)을 먼저 띄우고, 닫으면 스낵바를 띄운다(I-28 D4 B).
  // 열림(boolean)과 내용(금액)을 나눈다 — 닫히는 동안(사라지는 모션) 내용을 지우면 "0원이 돌아왔어요" 가 비친다.
  // 내용은 다음에 열 때까지 마지막 값을 그대로 둔다.
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundNotice, setRefundNotice] = useState<{
    amount: number;
    after: () => void;
  } | null>(null);
  // 확정한 삭제를 실행한다 — 실패하면 확인창을 닫고 critical 스낵바 + [다시 시도](다시 묻지 않고 같은 삭제를 바로)
  const runDelete = async (ids: number[]) => {
    let res: Awaited<ReturnType<typeof bulkDelete.mutateAsync>>;
    try {
      res = await bulkDelete.mutateAsync(ids);
    } catch {
      setDeleteOpen(false);
      snackbar.show({
        message: t("bulk.deleteFailed"),
        tone: "critical",
        action: { label: tc("retry"), onClick: () => void runDelete(ids) },
      });
      return;
    }
    setDeleteOpen(false);
    clearPickedAndFocus();
    const refunded = res.refundedAmount ?? 0;
    const fixTarget = closedInfo.fixTarget;
    const deletedCount = res.deletedCount;
    // 삭제 띠: "N건을 삭제했어요." + (닫힌 회차 카드면) [잔액 고치기] — 액션 조건은 환급과 무관하다
    const showSnack = () =>
      snackbar.show({
        message: t("bulk.deleted", { count: deletedCount }),
        ...(fixTarget != null
          ? {
              action: {
                label: t("closedCycle.fixBalance"),
                onClick: () => navigate(editAssetPath(fixTarget)),
              },
            }
          : {}),
      });
    if (refunded > 0) {
      setRefundNotice({ amount: refunded, after: showSnack });
      setRefundOpen(true);
    } else showSnack();
  };
  const confirmDelete = () => runDelete(chosenIds);
  const closeRefundNotice = () => {
    if (!refundOpen) return;
    const after = refundNotice?.after;
    setRefundOpen(false);
    after?.();
  };

  const [y = 1970, m = 1] = month.split("-").map(Number);
  const monthLabel = formatMonthShort(new Date(y, m - 1, 1));
  const calendarProps = {
    month,
    onPickMonth: pickMonth,
    today,
    byDay,
    loading: data.isLoadingMonthExpenses,
    monthIn: data.monthTotalIn,
    monthOut: data.monthTotalOut,
    summaryLoading: data.isLoadingSummary,
    onPickDay: scrollToDay,
    failed: data.monthExpensesFailed && !data.isError,
    onRetry: data.retryMonthExpenses,
  };
  const filterBar = (
    <FilterBar
      value={filterValue}
      onChange={changeFilter}
      categories={categoriesQ.data ?? []}
      assets={assets}
      wide={wide}
      viewPeriod={monthPeriodOf(month)}
      assetName={asset?.assetName}
      onClearAsset={() => {
        clearPicked();
        clearAsset();
      }}
      onClearAll={clearAll}
      firstChipRef={firstChip}
    />
  );
  const listCard = (
    <div ref={listRef}>
      <ListCard
        groups={grouped}
        count={lineCount}
        out={data.monthOut}
        inn={data.monthIn}
        loading={data.isLoadingList}
        failed={data.isError}
        onRetry={data.retry}
        filtered={filtered}
        monthLabel={monthLabel}
        today={today}
        focusTxId={focusTxId}
        focusRef={focusRef}
        selecting={selecting}
        actionRef={actionRef}
        onToggleSelecting={() => {
          setSelecting((v) => !v);
          clearPicked();
        }}
        selected={picked}
        onSelect={(id, on) =>
          setPicked((prev) => {
            const next = new Set(prev);
            if (on) next.add(id);
            else next.delete(id);
            return next;
          })
        }
        onOpenExpense={setDetail}
        onOpenTransfer={setTransferDetail}
        bulkBar={
          selecting ? (
            <BulkBar
              count={chosen.length}
              sum={chosenSum}
              overLimit={overLimit}
              busy={bulkFixed.isPending}
              onMarkFixed={() => void markFixed()}
              onDelete={() => setDeleteOpen(true)}
              onClear={clearPickedAndFocus}
            />
          ) : null
        }
      />
    </div>
  );

  return (
    <Frame>
      {wide ? (
        <div className="grid grid-cols-[336px_minmax(0,1fr)] items-start gap-x-x6">
          <div className="[@media(min-height:720px)]:sticky [@media(min-height:720px)]:top-x5">
            <MiniCalendar {...calendarProps} />
          </div>
          <div className="flex min-w-0 flex-col gap-y-x3">
            {filterBar}
            {listCard}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-y-x4">
          <SummaryCard {...calendarProps} />
          <div className="flex flex-col gap-y-x3">
            {filterBar}
            {listCard}
          </div>
        </div>
      )}

      <BulkDeleteDialog
        open={deleteOpen}
        count={chosen.length}
        sum={chosenSum}
        monthLabel={monthLabel}
        closedSpan={closedInfo.span}
        onClose={() => setDeleteOpen(false)}
        onConfirm={confirmDelete}
      />
      <AlertDialog
        open={refundOpen}
        onOpenChange={(o) => {
          if (!o) closeRefundNotice();
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>{t("bulk.refundTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("bulk.refundMessage", {
              // 금액 가리기가 켜져 있으면 가린다(앞 확인창과 같은 카드 · 종류)
              amount: hideAmount
                ? HIDE_AMOUNTS_MASK
                : money(refundNotice?.amount ?? 0),
            })}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogAction variant="neutralSolid">
              {tc("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {transferDetail && (
        <TransferDetailDialog
          transfer={transferDetail}
          mobile={false}
          onClose={() => setTransferDetail(null)}
        />
      )}
      {detail && (
        <TxDetailDialog
          expense={detail}
          mobile={false}
          onClose={() => setDetail(null)}
        />
      )}
    </Frame>
  );
}
