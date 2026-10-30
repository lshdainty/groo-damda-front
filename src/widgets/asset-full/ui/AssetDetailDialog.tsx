import { useMemo, useRef, useState } from "react";
import {
  blockNonDigitKey,
  parseAmount,
  sanitizeAmountInput,
} from "@/shared/lib/groo/amount";
import { AssetTradeDialog } from "./AssetTradeDialog";
import { useAssetTrades, useDeleteTrade } from "@/features/asset";
import type { TradeType } from "@/entities/asset";
import { useNavigate } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Pencil,
  SlidersHorizontal,
  Target,
  Zap,
  Trash2,
  Undo2,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import {
  AssetLogo,
  HOLDING_UNIT_KEY,
  editAssetPath,
  formatQty,
  qtyNumber,
  type Asset,
  type AssetHolding,
} from "@/entities/asset";
import type { Expense } from "@/entities/expense";
import { isRefundedTx, isScheduledTx } from "@/entities/expense";
import {
  useAssetBalanceTrend,
  useAssets,
  useCancelCardPayment,
  useInstallmentPayoff,
  useCardBilling,
  usePayCard,
  useInvestValuation,
  holdingsOf,
  useAssetTransfers,
  useUpdateAsset,
} from "@/features/asset";
import type { AssetTransfer, InstallmentDue } from "@/entities/asset";
import { useLivePrices } from "@/features/stock/model/useLivePrices";
import { useMyFeatures } from "@/features/subscription/model/useSubscription";
import { useStockSymbolName } from "@/features/stock/model/useStockMaster";
import { useCardPerformance } from "@/features/card-performance";
import { useSearchExpenses } from "@/features/expense";
import { ConfirmDialog, ModalShell } from "@/shared/ui/groo/dialogs";
import { ModalFooter } from "@/shared/ui/groo/modal-footer";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { ModalViewFooter } from "@/shared/ui/groo/modal-footer";
import { Button } from "@/shared/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { ExpenseRow } from "@/entities/expense";
import { TransferRow } from "@/entities/asset";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/shared/ui/chart";
import {
  KRW,
  wonPrefix,
  MINUS,
  money,
  formatChartAxis,
  isEn,
  formatDay,
  formatChangeRate,
} from "@/shared/lib/groo/format";
import { useAxisWidth } from "@/shared/lib/groo/axisWidth";
import { DateGroupHeader } from "@/shared/ui/date-group-header";
import { niceAxis } from "@/shared/lib/groo/chartAxis";
import { getPaletteByColor } from "@/shared/lib/groo/chart-palette";
import { assetTypeLabel } from "@/entities/asset";
import {
  HideForce,
  HideUnit,
  MaskAmount,
  WonUnit,
} from "@/shared/lib/groo/hide-amounts";
import { wonPre, useHideAmounts } from "@/shared/lib/groo/hide-amounts-core";
import { HideAmountsUnlockDialog } from "@/widgets/account-settings/ui/HideAmountsUnlockDialog";
import { Skeleton as SkeletonBase } from "@/shared/ui/skeleton";

type BalanceTooltipProps = {
  active?: boolean;
  payload?: {
    value?: number;
    payload?: { label?: string; weekStart?: string };
  }[];
  seriesLabel: string;
};

function BalanceTooltip({ active, payload, seriesLabel }: BalanceTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const first = payload[0];
  const val = Number(first?.value ?? 0);
  const label = first?.payload?.label ?? "";
  const weekStart = first?.payload?.weekStart ?? "";
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-tile)",
        boxShadow: "var(--shadow-md)",
        padding: "8px 12px",
        fontSize: "var(--text-caption)",
        minWidth: 140,
      }}
    >
      <div
        style={{
          fontSize: "var(--text-badge)",
          color: "var(--fg-tertiary)",
          fontWeight: "600",
          marginBottom: 4,
        }}
      >
        {label}
        {weekStart && (
          <span style={{ marginLeft: 6 }}>· {weekStart.slice(5)}</span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "var(--radius-xs)",
            background: "var(--color-balance)",
          }}
        />
        <span
          style={{
            fontSize: "var(--text-badge)",
            color: "var(--fg-secondary)",
          }}
        >
          {seriesLabel}
        </span>
        <span
          className="num"
          style={{
            marginLeft: "auto",
            fontSize: "var(--text-caption)",
            fontWeight: "700",
          }}
        >
          <MaskAmount card="asset.detail">
            {wonPre()}
            {KRW(val)}
          </MaskAmount>
          <WonUnit card="asset.detail" />
        </span>
      </div>
    </div>
  );
}

type AssetGroup = "account" | "card" | "invest";

const groupOf = (asset: Asset): AssetGroup => {
  if (asset.assetType === "CREDIT_CARD" || asset.assetType === "CHECK_CARD")
    return "card";
  if (asset.assetType === "INVESTMENT") return "invest";
  return "account";
};

/** 'yyyy-MM-dd' → 'M.d' 표기 — app _fmtDate 미러. */
function fmtBillingDate(iso: string): string {
  const [, mm, dd] = iso.split("-");
  if (mm == null || dd == null) return iso;
  const m = parseInt(mm, 10);
  const d = parseInt(dd, 10);
  if (!Number.isFinite(m) || !Number.isFinite(d)) return iso;
  return `${m}.${d}`;
}

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// 카드 월 실적 배지 — design card-detail.jsx 신판(달성/잔여 요약). 실적 무관 카드면 숨김.
// 달성: cat-green 10% tint 배경(다크 스왑) / 미달: sunken. 아이콘 30 원(surface).
/** 자산 상세의 한 행. 이체는 지출/수입이 아니라 자산 간 이동이라 별도 종류로 둔다. */
type AssetLedgerItem =
  | { kind: "expense"; at: string; expense: Expense }
  | { kind: "transfer"; at: string; transfer: AssetTransfer };

function CardPerfBadge({ assetRowId }: { assetRowId: number }) {
  const { t } = useTranslation("asset");
  const ym = currentYearMonth();
  const { data: p, isLoading } = useCardPerformance(assetRowId, ym);
  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginTop: 14,
          padding: "12px 13px",
          borderRadius: "var(--radius-lg)",
          background: "var(--bg-sunken)",
        }}
      >
        <SkeletonBase className="h-[30px] w-[30px] rounded-full shrink-0" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <SkeletonBase className="h-4 w-32 mb-1" />
          <SkeletonBase className="h-3 w-40" />
        </div>
      </div>
    );
  }
  if (!p || !p.isRequired || p.requiredAmount == null) return null;
  const done = p.isAchieved;
  const pct = Math.trunc(Math.min(Math.max(p.achievementRate, 0), 1.5) * 100);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginTop: 14,
        padding: "12px 13px",
        borderRadius: "var(--radius-lg)",
        background: done
          ? "var(--color-chart-green-subtle)"
          : "var(--bg-sunken)",
      }}
    >
      <span
        style={{
          width: 30,
          height: 30,
          borderRadius: "var(--radius-pill)",
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-surface)",
          color: done ? "var(--color-chart-green)" : "var(--fg-secondary)",
        }}
      >
        {done ? (
          <Check size={15} strokeWidth={3} />
        ) : (
          <Target size={15} strokeWidth={1.9} />
        )}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "var(--text-label-sm)",
            fontWeight: "700",
            color: "var(--fg-primary)",
          }}
        >
          {done
            ? t("assetDetail.perfDone")
            : t("assetDetail.perfRemain", {
                amount: money(p.remainingAmount ?? 0),
              })}
        </div>
        <div
          className="num"
          style={{
            fontSize: "var(--text-caption)",
            color: "var(--fg-tertiary)",
            marginTop: 2,
          }}
        >
          <MaskAmount card="asset.detail" mask="•••">
            {wonPre()}
            {KRW(p.currentAmount)}
          </MaskAmount>
          {" / "}
          <MaskAmount card="asset.detail" mask="•••">
            {wonPre()}
            {KRW(p.requiredAmount)}
          </MaskAmount>
          <WonUnit card="asset.detail" /> · {pct}%
        </div>
      </div>
    </div>
  );
}

// 결제 회차(청구월) 항목 — 예정 1건 + 과거 결제 완료 이력.
type CardStatement = {
  key: string;
  label: string;
  scheduled: boolean;
  amount: number;
  periodStart: string | null;
  periodEnd: string | null;
  paymentDate: string;
  /**
   * 그 회차의 할부 회차분 — 예정 회차는 청구 구성, 닫힌 회차는 거래 날짜가 앞 달이라
   * 이용 내역에 안 나오는 회차분(24차 8). 옛 서버의 과거 회차엔 없다.
   */
  installments?: InstallmentDue[];
  /** 예정 회차의 일시불 순사용액 — 할부 구성 아래 줄. 회차마다 제 값이다(다음 회차도). */
  lumpSum?: number | null;
  /** 예정 회차에 이미 낸 돈(선결제) — 할부 구성 아래 차감 줄. */
  alreadyPaid?: number | null;
  /**
   * 닫힌 회차 — 앱이 결제계좌에서 실제로 뺀 순 금액(D10). 머리 금액(`amount`)은 지금 기록
   * 합이라 둘이 다르면 머리 아래 한 줄로 말한다. 옛 서버의 과거 회차엔 없다.
   */
  paid?: number;
  /** 카드 등록 전 회차 — 실제와 안 맞을 수 있다는 주의(R4). */
  preRegistration?: boolean;
};

/**
 * 카드 상세 본문 — design card-detail.jsx 신판(현대카드 결제정보 패턴) 토큰 스냅.
 * 회차 히어로(기간 선택 시트) / 결제일·이용 기간 행 / 액션 2타일 /
 * 한도 사용 게이지·실적 배지 / 이용 내역(정렬 칩 + 날짜 그룹). CREDIT_CARD 전용.
 */
function CardDetailBody({
  asset,
  mobile,
  onEdit,
}: {
  asset: Asset;
  mobile: boolean;
  onEdit?: () => void;
}) {
  const { t } = useTranslation("asset");
  const { t: tc } = useTranslation("common");
  const navigate = useNavigate();
  const { data: billing, isLoading } = useCardBilling(asset.rowId);
  const payCard = usePayCard();
  const [confirmPay, setConfirmPay] = useState(false);
  // 부분 선결제 — 기본값은 남은 청구액 전액. 고치면 그만큼만 내고 나머지는 결제일에 빠진다.
  const [payAmount, setPayAmount] = useState("");
  // null = 아직 고르지 않음 → 다가오는 회차(결제가 임박한 쪽)를 기본으로 잡는다.
  // 다음 회차가 맨 위에 오므로 0 을 기본으로 두면 아직 쌓이는 중인 회차가 먼저 열린다.
  const [stIdx, setStIdx] = useState<number | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [sort, setSort] = useState<"recent" | "amount" | "category">("recent");

  const statements: CardStatement[] = useMemo(() => {
    const out: CardStatement[] = [];
    // 다음 회차(지금 쌓이는 이용분)가 맨 위 — 최신순. 결제일이 지나기 전에도 이번 달 내역이 보인다.
    if (billing?.nextCycle) {
      const n = billing.nextCycle;
      out.push({
        key: `next-${n.paymentDate}`,
        label: formatDay(n.paymentDate).md,
        scheduled: true,
        amount: n.amount,
        periodStart: n.periodStart,
        periodEnd: n.periodEnd,
        paymentDate: n.paymentDate,
        installments: n.installments ?? [],
        lumpSum: n.lumpSumAmount,
        alreadyPaid: n.alreadyPaidAmount,
      });
    }
    if (billing?.nextPaymentDate) {
      out.push({
        key: `up-${billing.nextPaymentDate}`,
        label: formatDay(billing.nextPaymentDate).md,
        scheduled: true,
        amount: billing.upcomingAmount,
        periodStart: billing.upcomingPeriodStart,
        periodEnd: billing.upcomingPeriodEnd,
        paymentDate: billing.nextPaymentDate,
        installments: billing.upcomingInstallments ?? [],
        lumpSum: billing.upcomingLumpSumAmount,
        alreadyPaid: billing.upcomingAlreadyPaidAmount,
      });
    }
    // 과거 회차 — 서버가 닫힌 회차를 내려 주면 그대로 쓴다. 결제 기록이 없는 회차(0원이라
    // 건너뜀·카드 등록 전)도 기록용 거래가 있으면 들어 있다. 머리 금액은 **지금 기록 합**이다
    // (D10) — 결제 뒤에 거래를 지우거나 고쳐 써도 통장은 그대로라(D1) 실제로 나간 돈과
    // 갈릴 수 있고, 그때는 머리 아래 한 줄로 말한다. 옛 서버면 결제한 금액 + 기록만 남긴
    // 금액이다(그때는 기록이 결제보다 적을 수 없었다).
    if (billing?.closedCycles) {
      for (const c of billing.closedCycles) {
        out.push({
          key: `c-${c.periodStart}`,
          label: formatDay(c.paymentDate).md,
          scheduled: false,
          amount: c.recordedAmount ?? c.paidAmount + c.recordedOnlyAmount,
          paid: c.paidAmount,
          periodStart: c.periodStart,
          periodEnd: c.periodEnd,
          paymentDate: c.paymentDate,
          installments: c.installmentDues ?? [],
          preRegistration: c.preRegistration,
        });
      }
      return out;
    }
    // 옛 서버 — 결제월별 합산: 같은 달에 여러 번(선결제 등) 결제해도 월 1행(사용자 결정).
    // 라벨은 정규 결제일(paymentDay, 말일 보정), 기간은 결제월의 전월 1일~말일(백엔드 회차 규칙 미러).
    const pad2 = (n: number) => String(n).padStart(2, "0");
    const byMonth = new Map<string, { amount: number; latest: string }>();
    for (const b of billing?.history ?? []) {
      if (b.status !== "COMPLETED") continue;
      const ym = b.paymentDate.slice(0, 7);
      const cur = byMonth.get(ym);
      if (cur) {
        cur.amount += b.billingAmount;
        if (b.paymentDate > cur.latest) cur.latest = b.paymentDate;
      } else {
        byMonth.set(ym, { amount: b.billingAmount, latest: b.paymentDate });
      }
    }
    for (const [ym, g] of byMonth) {
      const [y, m] = ym.split("-").map(Number);
      if (!y || !m) continue;
      const lastDay = new Date(y, m, 0).getDate();
      const day = Math.min(
        billing?.paymentDay ?? Number(g.latest.slice(8, 10)),
        lastDay,
      );
      const paymentDate = `${ym}-${pad2(day)}`;
      const py = m === 1 ? y - 1 : y;
      const pm = m === 1 ? 12 : m - 1;
      const pLast = new Date(py, pm, 0).getDate();
      out.push({
        key: `m-${ym}`,
        label: formatDay(paymentDate).md,
        scheduled: false,
        amount: g.amount,
        periodStart: `${py}-${pad2(pm)}-01`,
        periodEnd: `${py}-${pad2(pm)}-${pad2(pLast)}`,
        paymentDate,
      });
    }
    return out;
  }, [billing]);
  const activeIdx =
    stIdx ??
    Math.max(
      0,
      statements.findIndex((s) => s.key.startsWith("up-")),
    );
  const st =
    statements[Math.min(activeIdx, Math.max(0, statements.length - 1))] ?? null;

  // 기간 선택 시트 — 연도별 그룹(최신순 유지)
  const byYear = useMemo(() => {
    const g = new Map<string, { s: CardStatement; i: number }[]>();
    statements.forEach((s, i) => {
      const y = s.paymentDate.slice(0, 4);
      if (!g.has(y)) g.set(y, []);
      g.get(y)!.push({ s, i });
    });
    return [...g.entries()];
  }, [statements]);

  // 한도 사용 — 현재 미결제 잔액(총 부채) 기준
  const limit = asset.creditLimit ?? 0;
  const used = Math.abs(asset.balance);
  // 실사용률 그대로 — 한도의 20배를 썼으면 2000% 로 보인다(사용자 결정).
  // 100 으로 눌러 두면 목록(실퍼센트)과 다른 숫자가 나오고, 얼마나 넘겼는지도
  // 안 보인다. 바 채움만 아래에서 100% 로 캡한다(넘치면 그릴 수 없다).
  const limitPct = limit > 0 ? Math.round((used / limit) * 100) : 0;
  const limitWarn = limitPct >= 80;

  const paymentDay = billing?.paymentDay ?? asset.paymentDay ?? null;
  const cancelPayment = useCancelCardPayment();
  const installmentPayoff = useInstallmentPayoff(asset.rowId);
  // 정리/되돌리기 확인 대상 — null 이면 닫힘. undo 는 이미 상환된 회차의 되돌리기.
  const [payoffTarget, setPayoffTarget] = useState<{
    due: InstallmentDue;
    undo: boolean;
  } | null>(null);
  /**
   * 되돌릴 수 있는 가장 최근 결제.
   *
   * <p>결제는 실행하면 되돌릴 길이 없었다 — 그 이체는 청구와 묶여 있어 잠가 뒀고
   * 취소 경로도 없었다. 잘못 눌렀을 때 바로 무를 수 있게 마지막 한 건을 짚어 준다.
   *
   * <p>결제일이 지난 회차(닫힌 회차)의 결제와 환급이 나간 회차의 결제는 서버가 취소를
   * 막는다(D6) — 무르면 이미 끝난 회차에 빚이 되살아나거나 돌려준 돈이 통장에 남는다.
   * 그런 결제는 고르지 않는다. 닫힌 회차는 카드의 `cardClosedThrough`(회차 말일 ≤ 그 값)
   * 와 서버가 내려 준 닫힌 회차 목록 둘 다로 가른다.
   */
  const closedThrough = asset.cardClosedThrough ?? null;
  const lastPayment = useMemo(() => {
    const history = billing?.history ?? [];
    const closedStarts = new Set(
      (billing?.closedCycles ?? []).map((c) => c.periodStart),
    );
    const refundedStarts = new Set(
      history.filter((b) => b.status === "REFUNDED").map((b) => b.periodStart),
    );
    const cancelable = history.filter(
      (b) =>
        b.status === "COMPLETED" &&
        !(closedThrough != null && b.periodEnd <= closedThrough) &&
        !closedStarts.has(b.periodStart) &&
        !refundedStarts.has(b.periodStart),
    );
    if (cancelable.length === 0) return null;
    return cancelable.reduce((a, b) => (b.paymentDate > a.paymentDate ? b : a));
  }, [billing, closedThrough]);
  const [confirmCancelPay, setConfirmCancelPay] = useState(false);
  // 지금 결제는 예정 회차에서만 — 닫힌 회차를 보는 중엔 감춘다(D10).
  const showPayNow = !(st != null && !st.scheduled);
  const actionTiles = (showPayNow ? 1 : 0) + 1 + (lastPayment ? 1 : 0);
  const periodText =
    st?.periodStart && st?.periodEnd
      ? `${fmtBillingDate(st.periodStart)} ~ ${fmtBillingDate(st.periodEnd)}`
      : null;

  // 이용 내역 — 선택 회차의 청구 기간(전월 1일~말일)만 조회(사용자 결정).
  // 기간 미확정(폴백 회차)이면 기간 조건 없이 카드 전체에서 최근순.
  const { data: usageAll } = useSearchExpenses(
    st?.periodStart && st?.periodEnd
      ? {
          assetId: asset.rowId,
          startDate: st.periodStart,
          endDate: st.periodEnd,
        }
      : { assetId: asset.rowId },
  );
  const usageTx: Expense[] = useMemo(
    () =>
      [...(usageAll ?? [])].sort((a, b) =>
        b.expenseDate.localeCompare(a.expenseDate),
      ),
    [usageAll],
  );

  const sorted = useMemo(() => {
    const list = [...usageTx];
    if (sort === "amount")
      return list.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    if (sort === "category")
      return list.sort((a, b) =>
        (a.categoryName ?? "").localeCompare(b.categoryName ?? ""),
      );
    return list;
  }, [usageTx, sort]);

  // 날짜 그룹(최근순 뷰)
  const usageGroups = useMemo(() => {
    const m = new Map<string, Expense[]>();
    for (const tx of usageTx) {
      const k = tx.expenseDate.slice(0, 10);
      const arr = m.get(k);
      if (arr) arr.push(tx);
      else m.set(k, [tx]);
    }
    return [...m.entries()];
  }, [usageTx]);

  const openPay = () => {
    setPayAmount(
      String(st?.scheduled ? st.amount : (billing?.upcomingAmount ?? 0)),
    );
    setConfirmPay(true);
  };

  const payAmountNum = parseAmount(payAmount);
  // 고른 회차가 예정 회차면 그 회차의 예정액이 상한 — 다음 회차를 미리 낼 수도 있다.
  const upcoming = st?.scheduled ? st.amount : (billing?.upcomingAmount ?? 0);
  const payAmountValid = payAmountNum > 0 && payAmountNum <= upcoming;
  // 고른 회차 기준 — 다가오는 회차를 다 낸 뒤 다음 회차를 골라도 낼 수 있어야 한다.
  const canPay = upcoming > 0 && !payCard.isPending;
  // 돈은 잔액에 잡힌 빚까지만 움직인다(서버 payoff 캡). 청구액이 그보다 크면 차액은
  // 청구 기록만 남고 계좌에서 안 빠진다 — 완료만 보고 빠진 줄 아는 일이 없게 미리 알린다.
  const cardDebt = Math.max(0, -asset.balance);
  const payMoveNote =
    billing?.paymentAssetRowId == null
      ? t("assetDetail.payNoAccountNote")
      : cardDebt < payAmountNum
        ? t("assetDetail.payMoveNote", { amount: money(cardDebt) })
        : null;

  const handlePay = () => {
    if (!payAmountValid) return;
    payCard.mutate(
      {
        id: asset.rowId,
        amount: payAmountNum,
        paymentDate: st?.scheduled ? st.paymentDate : undefined,
      },
      {
        onSuccess: () => {
          setConfirmPay(false);
        },
        onError: () => {
          setConfirmPay(false);
          toast.error(t("assetDetail.toastPayFail"));
        },
      },
    );
  };

  const viewAll = () => navigate(`/desk/expense?assetId=${asset.rowId}`);

  if (isLoading) {
    // 실렌더(아래 히어로) 미러 — 회차 라벨+chevron / 금액 / 결제일 행 / 빠른 액션 타일.
    // 액션 타일까지 자리를 잡아야 데이터가 오는 순간 아래가 통째로 밀리지 않는다.
    return (
      <>
        <div style={{ padding: "2px 2px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <SkeletonBase className="h-6 w-32" />
            <SkeletonBase className="h-6 w-6 rounded-full shrink-0" />
          </div>
          {/* 금액 display-md — 실렌더 marginTop 10 */}
          <SkeletonBase className="h-9 w-44" style={{ marginTop: 10 }} />
        </div>
        <div style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 2px",
            }}
          >
            <SkeletonBase className="h-4 shrink-0" style={{ width: 68 }} />
            <SkeletonBase className="h-4 w-28" />
            <SkeletonBase className="h-3 w-24 ml-auto" />
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            margin: "14px 0 4px",
          }}
        >
          {[0, 1].map((i) => (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                padding: "14px 4px",
                background: "var(--bg-sunken)",
                borderRadius: "var(--radius-lg)",
              }}
            >
              <SkeletonBase className="h-[30px] w-[30px] rounded-[var(--radius-md)]" />
              <SkeletonBase className="h-3 w-12" />
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      {/* 결제 예정 히어로 — 회차 선택 */}
      <div style={{ padding: "2px 2px 16px" }}>
        <button
          type="button"
          onClick={() => setPickOpen(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            background: "transparent",
            border: 0,
            padding: 0,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <span
            style={{
              fontSize: "var(--text-title-lg)",
              fontWeight: "700",
              color: "var(--fg-primary)",
              letterSpacing: "-0.02em",
            }}
          >
            {st?.label ?? "—"}
          </span>
          {st?.scheduled && (
            <span
              style={{
                fontSize: "var(--text-badge)",
                fontWeight: "700",
                color: "var(--fg-secondary)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-pill)",
                padding: "2px 9px",
              }}
            >
              {t("assetDetail.scheduledTag")}
            </span>
          )}
          <span
            style={{
              width: 24,
              height: 24,
              borderRadius: "var(--radius-pill)",
              background: "var(--bg-sunken)",
              color: "var(--fg-secondary)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ChevronDown size={14} strokeWidth={2.4} />
          </span>
        </button>
        <div
          className="num"
          style={{
            fontSize: "var(--text-display-md)",
            fontWeight: "800",
            letterSpacing: "-0.03em",
            marginTop: 10,
            color: "var(--fg-primary)",
          }}
        >
          <MaskAmount card="asset.detail">
            {wonPre()}
            {KRW(st?.amount ?? 0)}
          </MaskAmount>
          {!isEn() && (
            <HideUnit>
              <span style={{ fontSize: "var(--text-title-lg)", marginLeft: 1 }}>
                원
              </span>
            </HideUnit>
          )}
        </div>
        {/* 앱이 한 푼도 안 뺀 회차(결제계좌 없음·카드 등록 전·전부 기록용)에 "결제 완료" 를
            달면 돈이 나간 것으로 읽힌다 — "기록 회차" 로 부른다(24차 7). 옛 서버의 과거
            회차는 결제 기록으로만 그려지므로(`paid` 없음) 결제 완료 그대로다. */}
        {st &&
          !st.scheduled &&
          (st.paid === 0 ? (
            <div
              data-testid="record-cycle-label"
              style={{
                fontSize: "var(--text-caption)",
                color: "var(--fg-secondary)",
                fontWeight: "600",
                marginTop: 6,
              }}
            >
              {t("assetDetail.recordCycle")}
            </div>
          ) : (
            <div
              style={{
                fontSize: "var(--text-caption)",
                color: "var(--color-chart-green)",
                fontWeight: "600",
                marginTop: 6,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Check size={13} strokeWidth={3} /> {t("assetDetail.paidDone")}
            </div>
          ))}
        {/* 머리 금액(지금 기록 합)과 실제로 계좌에서 나간 돈이 다를 때만 한 줄(D10) — 결제 뒤에
            적은 거래는 기록만 늘고, 지우거나 환불한 거래는 기록만 준다. 문장은 남기고 금액만
            가린다(금액 가리기).
            낸 돈이 0 인 회차는 "기록 회차" 라벨이 이미 다 말한다 — "계좌에서 나간 돈은
            0원이에요…" 를 또 붙이면 같은 말을 두 번 한다(QA 26차). */}
        {st &&
          !st.scheduled &&
          st.paid != null &&
          st.paid !== 0 &&
          st.amount !== st.paid && (
            <div
              data-testid="recorded-diff-note"
              style={{
                fontSize: "var(--text-caption)",
                color: "var(--fg-secondary)",
                marginTop: 6,
              }}
            >
              {st.amount > st.paid ? (
                <Trans
                  t={t}
                  i18nKey="assetDetail.recordedMoreNote"
                  values={{
                    paid: money(st.paid),
                    diff: money(st.amount - st.paid),
                  }}
                  components={{
                    amt: <MaskAmount card="asset.detail">{""}</MaskAmount>,
                  }}
                />
              ) : (
                <Trans
                  t={t}
                  i18nKey="assetDetail.recordedLessNote"
                  values={{
                    recorded: money(st.amount),
                    paid: money(st.paid),
                  }}
                  components={{
                    amt: <MaskAmount card="asset.detail">{""}</MaskAmount>,
                  }}
                />
              )}
            </div>
          )}
        {st && !st.scheduled && st.preRegistration && (
          <div
            data-testid="pre-registration-note"
            style={{
              fontSize: "var(--text-caption)",
              color: "var(--fg-tertiary)",
              marginTop: 4,
            }}
          >
            {t("assetDetail.preRegistrationNote")}
          </div>
        )}
      </div>

      {/* 결제일 · 카드 이용 기간 */}
      {paymentDay != null && (
        <div style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 2px",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: "var(--text-label-sm)",
                color: "var(--fg-tertiary)",
                minWidth: 68,
                flexShrink: 0,
              }}
            >
              {t("assetDetail.paymentDateLabel")}
            </span>
            <span
              className="num"
              style={{
                fontSize: "var(--text-body-sm)",
                fontWeight: "600",
                color: "var(--fg-primary)",
              }}
            >
              {t("assetDetail.billedMonthly", { day: paymentDay })}
            </span>
            {periodText && (
              <span
                className="num"
                style={{
                  marginLeft: "auto",
                  fontSize: "var(--text-caption)",
                  color: "var(--fg-tertiary)",
                }}
              >
                {t("assetDetail.usagePeriod", { period: periodText })}
              </span>
            )}
          </div>
        </div>
      )}
      {/* 결제일이 없는 옛 신용카드 — 서버는 이제 결제일을 필수로 받는다(D8). 그 카드는 늘
          열린 회차로 보이니 결제일 행 자리에서 넣으라고 말하고, 누르면 그 카드의 수정 폼으로
          간다(앱 `assetPaymentDayMissing` 과 같은 글자·같은 자리). 호스트가 [수정]을 쥐고
          있으면 그걸 쓴다 — 설정의 관리 화면은 주소를 거치지 않고 폼을 연다. */}
      {paymentDay == null && (
        <div
          data-testid="payment-day-missing"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 2px",
            }}
          >
            <span
              style={{
                fontSize: "var(--text-label-sm)",
                color: "var(--fg-tertiary)",
                minWidth: 68,
                flexShrink: 0,
              }}
            >
              {t("assetDetail.paymentDateLabel")}
            </span>
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={onEdit ?? (() => navigate(editAssetPath(asset.rowId)))}
            >
              {t("assetDetail.paymentDayMissing")} <ChevronRight size={12} />
            </Button>
          </div>
        </div>
      )}

      {/* 이번 회차 구성 — 할부가 있을 때만. 예정액이 이용 내역 합과 다른 이유(과거 할부의
          이번 회차분)를 이 자리에서 설명한다. 다가오는 회차에서만 그린다 — 청구 이력엔
          합계만 남아 과거 회차의 구성은 서버가 모른다. */}
      {st?.scheduled && (st.installments?.length ?? 0) > 0 && (
        <div
          style={{
            borderTop: "1px solid var(--border-subtle)",
            padding: "14px 2px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {st.installments!.map((due) => (
            <div
              key={due.expenseRowId}
              style={{ display: "flex", alignItems: "flex-start", gap: 12 }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "var(--text-body-sm)",
                    fontWeight: "600",
                    color: "var(--fg-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {due.merchant ??
                    due.description ??
                    t("assetDetail.installmentFallback")}
                </div>
                <div
                  className="num"
                  style={{
                    marginTop: 2,
                    fontSize: "var(--text-caption)",
                    color: "var(--fg-tertiary)",
                  }}
                >
                  {t("assetDetail.installmentSeq", {
                    seq: due.sequence,
                    total: due.installmentMonths,
                  })}
                  {" · "}
                  <MaskAmount card="asset.detail" mask="•••">
                    {t("assetDetail.installmentPrincipal", {
                      amount: money(due.principalAmount),
                    })}
                  </MaskAmount>
                  {due.recordOnly && ` · ${tc("recordOnly")}`}
                </div>
                {/* 정리/되돌리기 — 상환하면 남은 원금이 이 회차에 몰리므로 두 상태가 같은 자리를 쓴다. */}
                <div style={{ marginTop: 4 }}>
                  {due.paidOff ? (
                    <span
                      style={{
                        fontSize: "var(--text-caption)",
                        display: "inline-flex",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          color: "var(--color-fg-positive)",
                          fontWeight: "600",
                        }}
                      >
                        {t("assetDetail.installmentPaidOffBadge")}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPayoffTarget({ due, undo: true })}
                        style={{
                          border: 0,
                          background: "none",
                          padding: 0,
                          cursor: "pointer",
                          color: "var(--fg-tertiary)",
                          textDecoration: "underline",
                          fontSize: "var(--text-caption)",
                        }}
                      >
                        {t("assetDetail.installmentPayoffUndo")}
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPayoffTarget({ due, undo: false })}
                      style={{
                        border: 0,
                        background: "none",
                        padding: 0,
                        cursor: "pointer",
                        color: "var(--fg-brand)",
                        fontWeight: "600",
                        fontSize: "var(--text-caption)",
                      }}
                    >
                      {t("assetDetail.installmentPayoff")}
                    </button>
                  )}
                </div>
              </div>
              <span
                className="num"
                style={{
                  fontSize: "var(--text-body-sm)",
                  fontWeight: "700",
                  color: "var(--fg-primary)",
                  flexShrink: 0,
                }}
              >
                <MaskAmount card="asset.detail">{money(due.amount)}</MaskAmount>
              </span>
            </div>
          ))}
          {/* 고른 회차의 값 — 다음 회차를 볼 때 다가오는 회차의 일시불·선결제를 보여 주던 자리. */}
          {(st.lumpSum ?? 0) !== 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span
                style={{
                  flex: 1,
                  fontSize: "var(--text-caption)",
                  color: "var(--fg-tertiary)",
                }}
              >
                {t("assetDetail.lumpSumLabel")}
              </span>
              <span
                className="num"
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "var(--fg-secondary)",
                }}
              >
                <MaskAmount card="asset.detail">
                  {money(st.lumpSum!)}
                </MaskAmount>
              </span>
            </div>
          )}
          {(st.alreadyPaid ?? 0) > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span
                style={{
                  flex: 1,
                  fontSize: "var(--text-caption)",
                  color: "var(--fg-tertiary)",
                }}
              >
                {t("assetDetail.alreadyPaidLabel")}
              </span>
              <span
                className="num"
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "var(--fg-secondary)",
                }}
              >
                <MaskAmount card="asset.detail">
                  {MINUS}
                  {money(st.alreadyPaid!)}
                </MaskAmount>
              </span>
            </div>
          )}
        </div>
      )}

      {/* 닫힌 회차의 할부 회차분 — 거래 날짜가 앞 달이라 아래 이용 내역에는 안 나오는데
          머리 금액에는 들어 있다. 그 차이를 이 자리에서 한 줄씩 설명한다(24차 8). 결제가 끝난
          회차라 정리·되돌리기는 없다. */}
      {st && !st.scheduled && (st.installments?.length ?? 0) > 0 && (
        <div
          data-testid="closed-installments"
          style={{
            borderTop: "1px solid var(--border-subtle)",
            padding: "14px 2px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {st.installments!.map((due) => (
            <div
              key={due.expenseRowId}
              style={{ display: "flex", alignItems: "flex-start", gap: 12 }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "var(--text-body-sm)",
                    fontWeight: "600",
                    color: "var(--fg-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {due.merchant ??
                    due.description ??
                    t("assetDetail.installmentFallback")}
                </div>
                <div
                  className="num"
                  style={{
                    marginTop: 2,
                    fontSize: "var(--text-caption)",
                    color: "var(--fg-tertiary)",
                  }}
                >
                  {t("assetDetail.installmentSeq", {
                    seq: due.sequence,
                    total: due.installmentMonths,
                  })}
                  {/* 원금 — 다가오는 회차 줄·앱과 같은 모양(사용자 결정 2026-09-22). */}
                  {" · "}
                  <MaskAmount card="asset.detail" mask="•••">
                    {t("assetDetail.installmentPrincipal", {
                      amount: money(due.principalAmount),
                    })}
                  </MaskAmount>
                  {due.recordOnly && ` · ${tc("recordOnly")}`}
                </div>
              </div>
              <span
                className="num"
                style={{
                  fontSize: "var(--text-body-sm)",
                  fontWeight: "700",
                  color: "var(--fg-primary)",
                  flexShrink: 0,
                }}
              >
                <MaskAmount card="asset.detail">{money(due.amount)}</MaskAmount>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 빠른 액션 — 그리는 타일 수만큼 열을 나눈다(지금 결제는 예정 회차에서만, 결제
          취소는 되돌릴 결제가 있을 때만). */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${actionTiles}, 1fr)`,
          gap: 8,
          margin: "14px 0 4px",
        }}
      >
        {/* 지금 결제 — 결제가 끝난 회차를 보는 중엔 감춘다(24차 7). 그 화면에서 누르면
            보던 회차가 아니라 다가오는 회차가 결제돼 무엇을 내는지 헷갈린다. */}
        {showPayNow && (
          <button
            type="button"
            disabled={!canPay}
            onClick={openPay}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              padding: "14px 4px",
              background: "var(--bg-sunken)",
              border: 0,
              borderRadius: "var(--radius-lg)",
              cursor: canPay ? "pointer" : "not-allowed",
              fontFamily: "inherit",
              fontSize: "var(--text-caption)",
              fontWeight: "600",
              color: "var(--fg-primary)",
              opacity: canPay ? 1 : 0.55,
            }}
          >
            <span
              style={{
                width: 30,
                height: 30,
                borderRadius: "var(--radius-md)",
                background: "var(--bg-surface)",
                color: "var(--fg-secondary)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Zap size={15} strokeWidth={1.9} />
            </span>
            <span>{t("assetDetail.payNow")}</span>
          </button>
        )}
        <button
          type="button"
          onClick={onEdit}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            padding: "14px 4px",
            background: "var(--bg-sunken)",
            border: 0,
            borderRadius: "var(--radius-lg)",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: "var(--text-caption)",
            fontWeight: "600",
            color: "var(--fg-primary)",
          }}
        >
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: "var(--radius-md)",
              background: "var(--bg-surface)",
              color: "var(--fg-secondary)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SlidersHorizontal size={15} strokeWidth={1.9} />
          </span>
          <span>{t("assetDetail.limitSettings")}</span>
        </button>
        {/* 결제 취소 — 실수로 누른 결제를 무른다. 이체·잔액·청구가 함께 되돌아간다. */}
        {lastPayment && (
          <button
            type="button"
            disabled={cancelPayment.isPending}
            onClick={() => setConfirmCancelPay(true)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              padding: "14px 4px",
              background: "var(--bg-sunken)",
              border: 0,
              borderRadius: "var(--radius-lg)",
              cursor: cancelPayment.isPending ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              fontSize: "var(--text-caption)",
              fontWeight: "600",
              color: "var(--fg-primary)",
              opacity: cancelPayment.isPending ? 0.55 : 1,
            }}
          >
            <span
              style={{
                width: 30,
                height: 30,
                borderRadius: "var(--radius-md)",
                background: "var(--bg-surface)",
                color: "var(--fg-secondary)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Undo2 size={15} strokeWidth={1.9} />
            </span>
            <span>{t("assetDetail.cancelPayment")}</span>
          </button>
        )}
      </div>

      {/* 한도 사용 · 실적 */}
      {limit > 0 && (
        <div
          style={{
            borderTop: "1px solid var(--border-subtle)",
            marginTop: 18,
            paddingTop: 18,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h4
              style={{
                margin: 0,
                fontSize: "var(--text-body-sm)",
                fontWeight: "700",
                letterSpacing: "-0.01em",
                color: "var(--fg-primary)",
              }}
            >
              {t("assetDetail.limitUsage")}
            </h4>
            <span
              className="num"
              style={{
                marginLeft: "auto",
                fontSize: "var(--text-label-sm)",
                fontWeight: "700",
                color: limitWarn ? "var(--color-chart-red)" : "var(--fg-brand)",
              }}
            >
              {t("assetDetail.limitPctUsed", { pct: limitPct })}
            </span>
          </div>
          <div
            style={{
              height: 8,
              borderRadius: "var(--radius-pill)",
              background: "var(--bg-sunken)",
              overflow: "hidden",
              margin: "11px 0 7px",
            }}
          >
            <div
              style={{
                width: `${Math.min(100, limitPct)}%`,
                height: "100%",
                borderRadius: "var(--radius-pill)",
                background: limitWarn
                  ? "var(--color-chart-red)"
                  : "var(--bg-brand)",
              }}
            />
          </div>
          <div
            className="num"
            style={{
              display: "flex",
              fontSize: "var(--text-caption)",
              color: "var(--fg-tertiary)",
            }}
          >
            <span>
              {t("assetDetail.limitOf", {
                used: money(used),
                limit: money(limit),
              })}
            </span>
            <span style={{ marginLeft: "auto" }}>
              {t("assetDetail.limitRemain", {
                amount: money(Math.max(0, limit - used)),
              })}
            </span>
          </div>
          <button
            type="button"
            onClick={onEdit}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              marginTop: 12,
              padding: "8px 13px",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-pill)",
              background: "transparent",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "var(--text-caption)",
              fontWeight: "700",
              color: "var(--fg-primary)",
            }}
          >
            <Pencil size={12} strokeWidth={2.2} /> {t("assetDetail.limitEdit")}
          </button>
          <CardPerfBadge assetRowId={asset.rowId} />
        </div>
      )}
      {limit <= 0 && <CardPerfBadge assetRowId={asset.rowId} />}

      {/* 이용 내역 — 정렬 칩 + 날짜 그룹 리스트 */}
      <div
        style={{
          borderTop: "1px solid var(--border-subtle)",
          marginTop: 18,
          paddingTop: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <h4
            style={{
              margin: 0,
              fontSize: "var(--text-body-sm)",
              fontWeight: "700",
              color: "var(--fg-primary)",
            }}
          >
            {t("assetDetail.usageHistory")}{" "}
            {sorted.length > 0 && (
              <span className="num" style={{ color: "var(--fg-brand)" }}>
                {sorted.length}
              </span>
            )}
          </h4>
          <button
            type="button"
            onClick={viewAll}
            style={{
              marginLeft: "auto",
              background: "transparent",
              border: 0,
              color: "var(--fg-secondary)",
              cursor: "pointer",
              fontSize: "var(--text-label-sm)",
              fontWeight: "600",
              display: "inline-flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            {t("assetDetail.viewAll")} <ChevronRight size={12} />
          </button>
        </div>
        {/* 정렬 — 통계 페이지와 동일한 pills 탭(공용, 사용자 결정) */}
        <div style={{ margin: "12px 0 2px" }}>
          <Tabs
            value={sort}
            onValueChange={(v) =>
              v && setSort(v as "recent" | "amount" | "category")
            }
          >
            <TabsList variant="pills" size="sm">
              <TabsTrigger value="recent">
                {t("assetDetail.sortRecent")}
              </TabsTrigger>
              <TabsTrigger value="amount">
                {t("assetDetail.sortAmount")}
              </TabsTrigger>
              <TabsTrigger value="category">
                {t("assetDetail.sortCategory")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {sorted.length === 0 ? (
          <div
            style={{
              padding: "28px 0",
              textAlign: "center",
              color: "var(--fg-tertiary)",
              fontSize: "var(--text-label-sm)",
            }}
          >
            {t("assetDetail.noUsage")}
          </div>
        ) : sort === "recent" ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              paddingTop: 16,
            }}
          >
            {usageGroups.map(([d, items]) => {
              const { md, dow } = formatDay(d);
              // 환불된 거래는 행으로는 남되(취소선) 일 합계에선 뺀다 — 환불한 11,000 뿐인
              // 날의 머리가 −11,000 으로 떴다(23차 8).
              const counted = items.filter((tx) => !isRefundedTx(tx));
              const out = counted
                .filter((tx) => tx.expenseType === "EXPENSE")
                .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
              const inn = counted
                .filter((tx) => tx.expenseType === "INCOME")
                .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
              return (
                <div key={d}>
                  <DateGroupHeader
                    date={md}
                    weekday={dow}
                    expense={out}
                    income={inn}
                  />
                  {items.map((tx) => (
                    <ExpenseRow key={tx.rowId} expense={tx} />
                  ))}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ paddingTop: 6 }}>
            {sorted.map((tx) => (
              <ExpenseRow key={tx.rowId} expense={tx} />
            ))}
          </div>
        )}
      </div>

      {/* 기간 선택 시트 */}
      {pickOpen && (
        <ModalShell
          title={t("assetDetail.periodPick")}
          onClose={() => setPickOpen(false)}
          size="md"
          mobile={mobile}
        >
          {byYear.map(([y, rows]) => (
            <div key={y} style={{ display: "flex", gap: 14, paddingTop: 6 }}>
              <div
                className="num"
                style={{
                  width: 52,
                  flexShrink: 0,
                  fontSize: "var(--text-body-md)",
                  fontWeight: "700",
                  color: "var(--fg-primary)",
                  paddingTop: 15,
                }}
              >
                {y}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {rows.map(({ s, i }, ri) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => {
                      setStIdx(i);
                      setPickOpen(false);
                    }}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "15px 2px",
                      background: "transparent",
                      border: 0,
                      borderTop:
                        ri === 0 ? "none" : "1px solid var(--border-subtle)",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      textAlign: "left",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "var(--text-body-md)",
                        fontWeight: i === activeIdx ? "700" : "500",
                        color: "var(--fg-primary)",
                      }}
                    >
                      {s.label}
                      {s.scheduled ? ` (${t("assetDetail.scheduledTag")})` : ""}
                    </span>
                    <span
                      className="num"
                      style={{
                        marginLeft: "auto",
                        fontSize: "var(--text-label-sm)",
                        color: "var(--fg-tertiary)",
                      }}
                    >
                      <MaskAmount card="asset.detail">
                        {wonPre()}
                        {KRW(s.amount)}
                      </MaskAmount>
                      <WonUnit card="asset.detail" />
                    </span>
                    {i === activeIdx && (
                      <Check
                        size={16}
                        color="var(--fg-brand)"
                        strokeWidth={2.6}
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </ModalShell>
      )}

      {payoffTarget && (
        <ConfirmDialog
          title={
            payoffTarget.undo
              ? t("assetDetail.installmentPayoffUndo")
              : t("assetDetail.installmentPayoff")
          }
          message={
            payoffTarget.undo
              ? t("assetDetail.installmentPayoffUndoConfirm")
              : t("assetDetail.installmentPayoffConfirm", {
                  amount: money(payoffTarget.due.amount),
                })
          }
          confirmLabel={
            payoffTarget.undo
              ? t("assetDetail.installmentPayoffUndo")
              : t("assetDetail.installmentPayoff")
          }
          loading={installmentPayoff.isPending}
          onCancel={() => {
            if (!installmentPayoff.isPending) setPayoffTarget(null);
          }}
          onConfirm={() => {
            installmentPayoff.mutate(
              {
                expenseId: payoffTarget.due.expenseRowId,
                undo: payoffTarget.undo,
              },
              { onSuccess: () => setPayoffTarget(null) },
            );
          }}
        />
      )}

      {confirmPay && (
        <ModalShell
          title={t("assetDetail.payNow")}
          onClose={() => {
            if (!payCard.isPending) setConfirmPay(false);
          }}
          mobile={mobile}
          size="sm"
          footer={
            <ModalFooter
              onCancel={() => {
                if (!payCard.isPending) setConfirmPay(false);
              }}
              cancelLabel={tc("cancel")}
              onSave={handlePay}
              saveLabel={t("assetDetail.payAction")}
              saving={payCard.isPending}
              saveDisabled={!payAmountValid}
            />
          }
        >
          <div className="flex flex-col gap-4">
            <p
              style={{
                fontSize: "var(--text-body-sm)",
                color: "var(--fg-secondary)",
                lineHeight: 1.7,
                margin: 0,
              }}
            >
              <Trans
                i18nKey="assetDetail.payConfirm"
                ns="asset"
                values={{ amount: money(upcoming) }}
                components={{ strong: <strong /> }}
              />
              {(st?.paymentDate ?? billing?.nextPaymentDate)
                ? ` ${t("assetDetail.paymentDateNote", { date: st?.paymentDate ?? billing?.nextPaymentDate })}`
                : ""}
            </p>
            {payMoveNote && (
              <p
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "var(--color-fg-warning)",
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {payMoveNote}
              </p>
            )}

            {/* 부분 선결제 — 일부만 내면 나머지는 결제일에 정상적으로 빠진다. */}
            <div className="flex flex-col gap-2">
              <Label>{t("assetDetail.payAmount")}</Label>
              <Input
                className="num"
                value={payAmount}
                onChange={(e) =>
                  setPayAmount(sanitizeAmountInput(e.target.value))
                }
                onKeyDown={blockNonDigitKey}
                inputMode="numeric"
              />
              {payAmountNum > 0 && payAmountNum < upcoming && (
                <p className="text-xs text-[var(--fg-tertiary)]">
                  {t("assetDetail.payRemainder", {
                    amount: money(upcoming - payAmountNum),
                  })}
                </p>
              )}
            </div>
          </div>
        </ModalShell>
      )}
      {confirmCancelPay && lastPayment && (
        <ConfirmDialog
          title={t("assetDetail.cancelPayment")}
          message={t("assetDetail.cancelPaymentConfirm", {
            date: formatDay(lastPayment.paymentDate).md,
            amount: `${wonPrefix()}${KRW(lastPayment.billingAmount)}`,
          })}
          confirmLabel={t("assetDetail.cancelPayment")}
          danger
          loading={cancelPayment.isPending}
          onCancel={() => {
            if (!cancelPayment.isPending) setConfirmCancelPay(false);
          }}
          onConfirm={() => {
            cancelPayment.mutate(lastPayment.rowId, {
              onSuccess: () => {
                setConfirmCancelPay(false);
              },
              onError: () => setConfirmCancelPay(false),
            });
          }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// 투자 상세 — 보유 종목 리스트 (design dialogs.jsx split24 AssetDetailDialog invest 분기 미러)
//   연동(linked) 항목: 종목명 · "N주 · 현재가 X 연동" · 평가액 · 등락%
//   수동(manual) 항목: 이름 · "직접 입력" · 평가액
//   행 클릭 → 편집 다이얼로그(종목 추가/수정은 편집에서).
// ---------------------------------------------------------------------------
function HoldingRow({
  holding,
  price,
  unitKrw,
  prevUnitKrw,
  live,
  first,
  onTrade,
}: {
  holding: AssetHolding;
  /** 원표기 견적 — 라벨 표시용. 환산값은 아래 두 prop 으로 받는다. */
  price: { price: number; currency: string } | null;
  /** 1주 원화 환산가. 환율을 못 구했으면 null */
  unitKrw: number | null;
  /** 전일 종가의 원화 환산가. 없으면 등락을 감춘다 */
  prevUnitKrw: number | null;
  live: boolean;
  first: boolean;
  onTrade?: (type: TradeType) => void;
}) {
  const { t } = useTranslation("asset");
  const { data: masterName } = useStockSymbolName(
    holding.linked ? (holding.tossSymbol ?? "") : "",
  );
  const name = holding.linked
    ? (masterName ?? holding.tossSymbol ?? "")
    : (holding.holdingName ?? "");

  // 수량은 정밀도 때문에 문자열로 온다 — 표시·미리보기 계산에서만 숫자로 푼다(저장은 서버 몫).
  const qty = qtyNumber(holding.quantity) ?? 0;
  let value: number | null = null;
  let changePct: number | null = null;
  let priceLabel: string | null = null;
  if (holding.linked) {
    if (live && price) {
      if (unitKrw != null) value = Math.round(unitKrw * qty);
      // 통화를 하나로 가정하지 않는다 — 나무를 붙이며 JPY·HKD·CNY 가 들어왔다.
      priceLabel =
        price.currency === "KRW"
          ? money(price.price)
          : price.currency === "USD"
            ? `$${price.price.toLocaleString()}`
            : `${price.price.toLocaleString()} ${price.currency}`;
      if (unitKrw != null && prevUnitKrw != null && prevUnitKrw > 0) {
        changePct =
          Math.round(((unitKrw - prevUnitKrw) / prevUnitKrw) * 10000) / 100;
      }
    }
  } else {
    value = holding.holdingValue ?? 0;
  }

  // 수량 표기는 문자열을 그대로 다듬는다 — 코인은 8자리까지(0.00012345 BTC 가 0 으로 보이지 않게).
  const qtyLabel = formatQty(holding.quantity, holding.holdingType ?? "STOCK");
  // 미연동도 수량을 적어뒀으면 함께 보여준다 — 단위는 유형을 따른다(주/g/개).
  const manualQty =
    !holding.linked && qty > 0
      ? `${qtyLabel}${t(HOLDING_UNIT_KEY[holding.holdingType ?? "STOCK"])}`
      : null;
  const sub = holding.linked
    ? live && priceLabel
      ? t("holdings.linkedSub", { n: qtyLabel, price: priceLabel })
      : t("holdings.linkedPending", { n: qtyLabel })
    : manualQty
      ? `${manualQty} · ${t("holdings.manualSub")}`
      : t("holdings.manualSub");

  // 행 자체는 누르는 자리가 아니다. 종목을 고치는 건 하단 [수정] 로만 들어간다 —
  // 매수·매도 버튼 옆에서 행을 누르면 편집이 열려, 어디를 눌렀는지에 따라 다른 일이
  // 벌어졌다. 앱도 버튼 둘만 두고 편집은 하단에서 받는다(사용자 결정).
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 0",
        borderTop: first ? "none" : "1px solid var(--border-subtle)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "var(--text-label-sm)",
            fontWeight: 600,
            letterSpacing: "-0.01em",
          }}
        >
          {name}
        </div>
        <div
          className="num"
          style={{
            fontSize: "var(--text-badge)",
            color: "var(--fg-tertiary)",
            marginTop: 2,
          }}
        >
          {sub}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div
          className="num"
          style={{ fontSize: "var(--text-label-sm)", fontWeight: 700 }}
        >
          {value != null ? (
            <>
              <MaskAmount card="asset.detail">
                {wonPre()}
                {KRW(value)}
              </MaskAmount>
              <WonUnit card="asset.detail" />
            </>
          ) : (
            "—"
          )}
        </div>
        {changePct != null && (
          <div
            className="num"
            style={{
              fontSize: "var(--text-badge)",
              fontWeight: 600,
              marginTop: 2,
              color:
                changePct >= 0 ? "var(--status-danger-fg)" : "var(--fg-brand)",
            }}
          >
            {formatChangeRate(changePct, { sign: "always" })}
          </div>
        )}
      </div>
      {/* 매수·매도 — 이 종목에 대한 사건. 종목이 정해진 자리라 다시 고를 필요가 없다.
          brand 색을 빼고 본문 톤으로 둔다 — 행마다 파란 글씨 둘이 서면 금액보다 먼저
          눈에 들어와, 정작 봐야 할 평가액이 뒤로 밀린다(앱 정합). */}
      {onTrade && (
        <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
          <Button variant="ghost" size="xs" onClick={() => onTrade("BUY")}>
            {t("trade.entryBuy")}
          </Button>
          <Button variant="ghost" size="xs" onClick={() => onTrade("SELL")}>
            {t("trade.entrySell")}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * 거래 내역 — 매수·매도가 언제 얼마에 있었는지. 실현손익도 함께 보여 준다.
 * 취소하면 예수금·보유 수량·원가가 거래 전으로 되돌아간다.
 */
function TradeHistory({ assetRowId }: { assetRowId: number }) {
  const { t } = useTranslation("asset");
  const { data: trades } = useAssetTrades(assetRowId);
  const deleteMut = useDeleteTrade();
  // 브라우저 confirm 은 앱 테마를 안 따르고 문구도 못 꾸민다 — 프로젝트 다이얼로그를 쓴다.
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  if (!trades || trades.length === 0) {
    return null;
  }
  return (
    <div style={{ marginTop: 14 }}>
      <h3
        style={{
          fontSize: "var(--text-label-sm)",
          fontWeight: 700,
          margin: "0 0 6px",
        }}
      >
        {t("trade.history")}
      </h3>
      {trades.map((tr) => (
        <div
          key={tr.rowId}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 0",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <span
            style={{
              fontSize: "var(--text-badge)",
              fontWeight: 700,
              color:
                tr.tradeType === "SELL"
                  ? "var(--fg-brand)"
                  : "var(--status-danger-fg)",
            }}
          >
            {tr.tradeType === "SELL" ? t("trade.sell") : t("trade.buy")}
          </span>
          <span
            className="truncate"
            style={{ fontSize: "var(--text-body-sm)", minWidth: 0, flex: 1 }}
          >
            {tr.holdingKey}
          </span>
          <span
            className="num"
            style={{
              fontSize: "var(--text-badge)",
              color: "var(--fg-tertiary)",
            }}
          >
            {tr.quantity} · {tr.tradeDate.slice(0, 10)}
          </span>
          <span
            className="num"
            style={{ fontSize: "var(--text-body-sm)", fontWeight: 700 }}
          >
            {money(tr.amount)}
          </span>
          {tr.realizedPl != null && tr.realizedPl !== 0 && (
            <span
              className="num"
              style={{
                fontSize: "var(--text-badge)",
                fontWeight: 700,
                color:
                  tr.realizedPl > 0 ? "var(--fg-income)" : "var(--fg-expense)",
              }}
            >
              {tr.realizedPl > 0 ? "+" : "−"}
              {KRW(Math.abs(tr.realizedPl))}
            </span>
          )}
          <Button
            variant="ghost"
            size="xs"
            aria-label={t("trade.deleted")}
            onClick={() => setConfirmDelete(tr.rowId)}
          >
            <Trash2 size={13} />
          </Button>
        </div>
      ))}

      {confirmDelete != null && (
        <ConfirmDialog
          title={t("trade.deleteTitle")}
          message={t("trade.deleteConfirm")}
          confirmLabel={t("trade.deleteAction")}
          danger
          loading={deleteMut.isPending}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() =>
            deleteMut.mutate(confirmDelete, {
              onSuccess: () => {
                setConfirmDelete(null);
              },
            })
          }
        />
      )}
    </div>
  );
}

function HoldingsSection({ asset, mobile }: { asset: Asset; mobile: boolean }) {
  const { t } = useTranslation("asset");
  // 매수·매도는 종목마다 연다 — 어떤 종목인지 정해진 채로 들어가야 다시 고를 일이 없다.
  const [trade, setTrade] = useState<{
    type: TradeType;
    holding: AssetHolding;
  } | null>(null);
  const { data: features } = useMyFeatures();
  const live =
    (features?.features?.includes("SECURITIES") ?? false) &&
    (features?.connectedBrokers?.length ?? 0) > 0;
  const hs = holdingsOf(asset);
  const symbols = useMemo(
    () => [
      ...new Set(
        hs
          .filter((h) => h.linked && h.tossSymbol)
          .map((h) => h.tossSymbol as string),
      ),
    ],
    [hs],
  );
  const active = live && symbols.length > 0;
  const activeSymbols = useMemo(
    () => (active ? symbols : []),
    [active, symbols],
  );
  // 증권사 무관 경로 + 통화별 환율. 목록(useInvestValuation)과 같은 훅이라 총액과
  // 종목별 금액이 한 화면에서 어긋나지 않는다.
  const prices = useLivePrices(activeSymbols, active);

  return (
    <div
      style={{
        borderTop: "1px solid var(--border-subtle)",
        padding: "14px 0 6px",
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <h2
          style={{
            fontSize: "var(--text-label-md)",
            fontWeight: 700,
            margin: 0,
          }}
        >
          {t("holdings.sectionTitle")}{" "}
          <span className="num" style={{ color: "var(--fg-brand)" }}>
            {hs.length}
          </span>
        </h2>
      </div>
      {hs.map((h, i) => (
        <HoldingRow
          key={h.rowId ?? `${h.tossSymbol ?? h.holdingName ?? ""}-${i}`}
          holding={h}
          price={
            h.linked && h.tossSymbol
              ? (prices.quoteOf(h.tossSymbol) ?? null)
              : null
          }
          unitKrw={
            h.linked && h.tossSymbol ? prices.unitKrw(h.tossSymbol) : null
          }
          prevUnitKrw={
            h.linked && h.tossSymbol ? prices.prevUnitKrw(h.tossSymbol) : null
          }
          live={live}
          first={i === 0}
          onTrade={(type) => setTrade({ type, holding: h })}
        />
      ))}
      {hs.length === 0 && (
        <div
          style={{
            padding: "20px 0",
            fontSize: "var(--text-label-sm)",
            color: "var(--fg-tertiary)",
            textAlign: "center",
          }}
        >
          {t("holdings.emptyDetail")}
        </div>
      )}

      {/* 거래 내역 — 언제 사고 팔았는지, 얼마가 남았는지. 취소도 여기서. */}
      <TradeHistory assetRowId={asset.rowId} />

      {trade && (
        <AssetTradeDialog
          asset={asset}
          holding={trade.holding}
          defaultType={trade.type}
          mobile={mobile}
          onClose={() => setTrade(null)}
        />
      )}
    </div>
  );
}

/**
 * 투자 자산의 라이브 평가 — 시세×수량. 투자가 아니면 `null`.
 *
 * 컴포넌트에서 떼어 낸 이유는 하나다. `useInvestValuation` 은 배열을 받는데 그 배열을
 * 매 렌더 새로 만들면 훅 안의 memo 가 통째로 무효화되고 `useLivePrices` 까지 연쇄한다.
 * 그래서 `useMemo` 로 붙잡아야 하는데, 컴파일러는 **커스텀 훅에 넘긴 배열이 그 훅에서
 * 변형되지 않는다는 걸 증명할 수 없어** 이 memo 를 보존하지 못한다
 * (`react-hooks/preserve-manual-memoization`). 그러면 이걸 품은 함수가 통째로 최적화에서
 * 빠지는데, 700 줄짜리 다이얼로그가 통째로 빠지느니 이 작은 훅만 빠지는 게 낫다.
 */
function useAssetLiveValuation(asset: Asset, isInv: boolean) {
  const investAssets = useMemo(() => (isInv ? [asset] : []), [isInv, asset]);
  const investValMap = useInvestValuation(investAssets);
  return isInv ? (investValMap.get(asset.rowId) ?? null) : null;
}

/**
 * 이 자산에 걸린 최근 내역 — 지출·수입과 이체를 한 줄기로 합쳐 날짜별로 묶는다.
 *
 * 여기도 같은 이유로 갈라 뒀다 — `relatedItems` 는 sort 로 배열을 제자리 정렬하고
 * `relatedGroups` 는 그걸 받아 Map 에 담는데, 컴파일러는 이 둘의 memo 를 보존하지
 * 못한다. 걷어 내면 다이얼로그를 열 때마다 전체 거래를 다시 훑는다.
 */
function useAssetLedger(asset: Asset, isCheckLinked: boolean) {
  const { data: relatedAll, isLoading: relatedLoading } = useSearchExpenses({
    assetId: asset.rowId,
  });
  // 이체는 expense 가 아니라 asset_transfer 라 따로 받아 합친다. 한 건이 자산 두 개에 걸치므로
  // 이 자산이 보내는 쪽인지 받는 쪽인지로 걸러낸다(서버 필터는 기간만 지원).
  const { data: transfersAll } = useAssetTransfers();
  // "최근" 은 지나간 것이다. 반복거래가 미리 만들어 둔 미래분을 그대로 두면 날짜
  // 내림차순에서 맨 위를 차지해, 정작 최근 거래가 12건 밖으로 밀려난다.
  // 예정분은 전체 보기(가계부)에서 "예정" 표시와 함께 본다(사용자 결정).
  const relatedItems = useMemo(() => {
    const rows: AssetLedgerItem[] = [
      ...(relatedAll ?? [])
        .filter((e) => !isScheduledTx(e.expenseDate))
        .map(
          (e) =>
            ({
              kind: "expense",
              at: e.expenseDate,
              expense: e,
            }) as AssetLedgerItem,
        ),
      ...(transfersAll?.transfers ?? [])
        .filter(
          (t) =>
            (t.fromAssetRowId === asset.rowId ||
              t.toAssetRowId === asset.rowId) &&
            !isScheduledTx(t.transferDate),
        )
        .map(
          (t) =>
            ({
              kind: "transfer",
              at: t.transferDate,
              transfer: t,
            }) as AssetLedgerItem,
        ),
    ];
    const sorted = rows.sort((a, b) => b.at.localeCompare(a.at));
    // 연결계좌형 체크카드는 "이번 달 뭐 썼나" 가 목적이라 당월(1일~말일) 전체를 다 보여준다
    // — 12건 컷을 두면 월말엔 월초 내역이 잘려 합계와 목록이 어긋난다. 그 밖에는 최근 12건.
    if (isCheckLinked) {
      const ym = currentYearMonth();
      return sorted.filter((r) => r.at.slice(0, 7) === ym);
    }
    return sorted.slice(0, 12);
  }, [relatedAll, transfersAll, asset.rowId, isCheckLinked]);

  // 가계부 메인 리스트 미러 — 날짜별 그룹(최신순), 헤더에 일 지출/수입 합계.
  const relatedGroups = useMemo(() => {
    const m = new Map<string, AssetLedgerItem[]>();
    for (const item of relatedItems) {
      const k = item.at.slice(0, 10);
      const arr = m.get(k);
      if (arr) arr.push(item);
      else m.set(k, [item]);
    }
    return [...m.entries()];
  }, [relatedItems]);
  return { relatedLoading, relatedItems, relatedGroups };
}

export function AssetDetailDialog({
  asset: assetProp,
  onClose,
  onEdit,
  onDelete,
  mobile,
}: {
  asset: Asset;
  onClose: () => void;
  onEdit?: (asset: Asset) => void;
  /**
   * 삭제 — 자산을 지울 수 있는 화면만 넘긴다(계좌·카드 관리). 자산 페이지처럼
   * 훑어보는 상세에서 켜면 목록으로 돌아갈 수도 없는 자리에서 자산이 사라진다.
   * 데스크탑은 `leftSlot`(금액 가리기)이 좌측을 쥐고 목록 행에 삭제 아이콘이 있어
   * 모바일에서만 그린다.
   */
  onDelete?: (asset: Asset) => void;
  mobile: boolean;
}) {
  const { t } = useTranslation("asset");
  const { t: tc } = useTranslation("common");
  // 여는 쪽은 클릭 시점의 asset 을 상태에 박아 넘긴다 — 열려 있는 동안 매수·취소가
  // 일어나면 리스트 쿼리는 새 값인데 prop 은 옛 스냅샷이라 수량·평가액이 낡은 채
  // 남는다. 같은 자산을 쿼리에서 다시 찾아 산 값을 쓴다.
  const { data: liveAssets } = useAssets();
  const asset =
    liveAssets?.assets.find((a) => a.rowId === assetProp.rowId) ?? assetProp;
  const navigate = useNavigate();
  // 이 자산만 가려 둔 경우도 함께 본다 — 화면 카드와 합집합이다.
  const assetHidden = asset.isAmountHidden === "Y";
  const hidden = useHideAmounts("asset.detail") || assetHidden;

  // footer 버튼은 **이 자산**을 켜고 끈다(예전엔 설정 화면으로 보내기만 했다).
  // 그래서 라벨·아이콘은 화면 상태(`hidden`)가 아니라 **자산 플래그**를 따른다 —
  // 카드로 가려진 상태에서 "금액 표시" 라고 적어 놓으면 눌러도 안 보여 고장으로 읽힌다.
  const updateAsset = useUpdateAsset();
  const [unlockOpen, setUnlockOpen] = useState(false);
  const applyHidden = (next: "Y" | "N") =>
    updateAsset.mutate({
      id: asset.rowId,
      // 이름·종류를 함께 싣는 건 폼 타입이 필수로 요구해서다. 서버 PUT 은 "키가 없으면
      // 유지" 라 굳이 보낼 필요는 없지만, **지금 값 그대로** 보내므로 아무것도 안 바뀐다.
      data: {
        assetName: asset.assetName,
        assetType: asset.assetType,
        isAmountHidden: next,
      },
    });
  const handleHideToggle = () => {
    // 켜는 건 그냥, 푸는 건 본인 확인을 거친다 — 카드 가리기와 같은 규칙
    // (`HideAmountsSection`). 잠그는 쪽에 마찰을 두면 아무도 안 쓴다.
    if (assetHidden) setUnlockOpen(true);
    else applyHidden("Y");
  };

  const group = groupOf(asset);
  const isCard = group === "card";
  const isInv = group === "invest";

  // 차트 기간: 3m/6m/1y → 12/24/52주
  const [period, setPeriod] = useState<"3m" | "6m" | "1y">("3m");
  const weeks = period === "3m" ? 12 : period === "6m" ? 24 : 52;
  const { data: trendData, isLoading: trendLoading } = useAssetBalanceTrend(
    asset.rowId,
    weeks,
  );
  const chartData = useMemo(
    () =>
      (trendData ?? []).map((p, i) => ({
        label: t("assetDetail.weekLabel", { n: i + 1 }),
        weekStart: p.weekStart,
        balance: p.balance,
      })),
    [trendData, t],
  );
  // Y축: 0기준 nice 눈금 (앱 asset_detail niceAxis 정합). 음수 잔액(대출)도 0 아래로 확장.
  const yAxis = useMemo(() => {
    const vals = chartData.map((d) => d.balance);
    return niceAxis(Math.min(0, ...vals), Math.max(0, ...vals));
  }, [chartData]);
  const yAxisWidth = useAxisWidth(
    yAxis.ticks.map((v) => (hidden ? "••••" : formatChartAxis(v))),
  );
  // 툴팁 자리 — recharts 는 눈금 폭을 뺀 그리는 자리 안에만 가두는데, 글자 크기가 커지면 그 자리가
  // 툴팁보다 좁아져 오른쪽이 잘렸다. 차트 상자 전체 안으로 좌우를 밀어 넣는다(chart.md 툴팁: 화면 끝에서 안으로).
  const chartBoxRef = useRef<HTMLDivElement>(null);
  const [tipX, setTipX] = useState<number | undefined>(undefined);
  const placeTip = (s: { activeCoordinate?: { x: number } }) => {
    const box = chartBoxRef.current;
    const cx = s.activeCoordinate?.x;
    if (!box || cx == null) return;
    const tip = box.querySelector<HTMLElement>(".recharts-tooltip-wrapper > *");
    const w = box.clientWidth;
    const tw = tip?.offsetWidth ?? 0;
    let x = cx + 12;
    if (x + tw > w) x = cx - 12 - tw;
    setTipX(Math.max(0, Math.min(x, w - tw)));
  };
  const periodLabel =
    period === "3m"
      ? t("assetDetail.weekLabel", { n: 12 })
      : period === "6m"
        ? t("assetDetail.weekLabel", { n: 24 })
        : t("assetDetail.weekLabel", { n: 52 });
  const seriesLabel = isCard
    ? t("assetDetail.seriesUsage")
    : isInv
      ? t("assetDetail.seriesValuation")
      : t("assetDetail.seriesBalance");

  const color = getPaletteByColor(asset.color).color;
  const chartConfig: ChartConfig = {
    balance: { label: seriesLabel, color },
  };

  /**
   * 헤드라인 금액 — 카드만 절대값이다.
   *
   * <p>카드 잔액은 <b>미결제 사용액이 음수</b>라는 규약이라, 화면에는 "얼마 썼나" 로 뒤집어
   * 보여 준다. 그 밖의 자산은 음수가 정상 상태다 — 마이너스 통장, 잔액을 실제와 맞추지
   * 않은 계좌, 지출이 잔고를 넘긴 현금. 여기서 abs() 를 씌우면 −5,000 이 "5,000원" 으로
   * 보여 목록·편집 폼과 어긋난다.
   */
  const heroBalance = isCard ? Math.abs(asset.balance) : asset.balance;

  // 투자 자산 — holdings 라이브 평가(시세×수량+수동합)로 헤로 금액을 덮어쓰고 등락 표시.
  const investVal = useAssetLiveValuation(asset, isInv);

  // 라이브 평가는 '보유분'만 — 예수금을 더해야 계좌 총액이다.
  const investCash = isInv ? (asset.cashBalance ?? 0) : 0;
  const investHolding =
    investVal != null ? investVal.value : (asset.holdingBalance ?? 0);
  // CREDIT_CARD 는 신판 카드 상세 본문(CardDetailBody) — 회차 히어로가 금액을 담당.
  const isCredit = asset.assetType === "CREDIT_CARD";
  // 연결계좌형 체크카드 — 결제가 계좌에서 즉시 빠져 잔액이 늘 0 이다. 히어로는 잔액 대신
  // "이번 달 사용액"(서버 계산 당월 합계), 내역은 당월 1일~말일 전체를 보여준다(사용자 결정).
  // 미연결 체크카드는 잔액이 실제로 쌓이므로 일반 계좌처럼 잔액·최근 내역 그대로다.
  const isCheckLinked =
    asset.assetType === "CHECK_CARD" && asset.paymentAssetRowId != null;
  // 투자도 예수금이 마이너스일 수 있다(기록용 앱이라 막지 않는다) — 부호를 살린다.
  const heroAmount =
    investVal != null
      ? investCash + investVal.value
      : isCheckLinked
        ? (asset.monthlyUsedAmount ?? 0)
        : heroBalance;

  const { relatedLoading, relatedItems, relatedGroups } = useAssetLedger(
    asset,
    isCheckLinked,
  );

  const title = isCard
    ? t("assetDetail.titleCard")
    : isInv
      ? t("assetDetail.titleInvest")
      : t("assetDetail.titleAccount");
  const valueLabel = isCheckLinked
    ? t("assetDetail.valueCheckCard")
    : isCard
      ? t("assetDetail.valueCard")
      : isInv
        ? t("assetDetail.seriesValuation")
        : t("assetDetail.seriesBalance");

  const viewAll = () => {
    onClose();
    navigate(`/desk/expense?assetId=${asset.rowId}`);
  };

  // 모바일은 [삭제][수정](spec drawer.md: 상세 = 삭제·수정). 금액 가리기는 카드
  // 우상단 눈 버튼과 계정 > 보안에도 있어 여기서 뺀다. 데스크탑·태블릿은 [금액 가리기][수정] 이고,
  // 관리 화면에서 열었으면(onDelete) 목록 줄에 연필 · 휴지통 · ⋮ 를 두지 않으므로(좁은 줄 ⋮ 원칙, 10-25)
  // 지우는 길이 여기 [삭제] 다. 상세가 페이지가 되는 17-3 에서 머리 ⋯ 로 옮겨 간다.
  const Footer = (
    <ModalViewFooter
      leftSlot={
        mobile ? undefined : (
          <div className="flex items-center gap-x2">
            {/* 아이콘을 본문 콘텐츠 열에 맞춘다 — flush ghost 는 텍스트 버튼이라 hover 에
              배경 없이 글자색으로만 반응한다(spec button.md Edge flush · dialog.md footer). */}
            <Button
              variant="ghost"
              flush="left"
              onClick={handleHideToggle}
              type="button"
            >
              {assetHidden ? <Eye size={16} /> : <EyeOff size={16} />}
              {assetHidden
                ? t("assetDetail.showAmounts")
                : t("assetDetail.hideAmounts")}
            </Button>
            {onDelete && (
              <Button
                variant="dangerSoft"
                type="button"
                onClick={() => onDelete(asset)}
              >
                {tc("delete")}
              </Button>
            )}
          </div>
        )
      }
      onDelete={mobile && onDelete ? () => onDelete(asset) : undefined}
      onEdit={onEdit ? () => onEdit(asset) : undefined}
    />
  );

  return (
    <>
      {/* 이 자산이 숨김이면 상세 안의 금액을 전부 가린다 — 히어로·예수금·카드 청구·
        할부·보유종목이 하위 컴포넌트에 흩어져 있어 자리마다 force= 를 달면 새기 쉽다. */}
      <HideForce value={assetHidden}>
        <ModalShell
          title={title}
          onClose={onClose}
          size="lg"
          footer={Footer}
          mobile={mobile}
        >
          {/* Hero — 플랫(design 신판): 이름 행 + 구분선 + 잔액. 신용카드는 이름 행만
          (회차 히어로가 금액 담당 — CardDetailBody). */}
          <div style={{ marginBottom: isCredit ? 0 : 18 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                paddingBottom: 14,
                marginBottom: isCredit ? 0 : 14,
                borderBottom: isCredit
                  ? "none"
                  : "1px solid var(--border-subtle)",
              }}
            >
              <AssetLogo asset={asset} size={48} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "var(--text-body-lg)",
                    fontWeight: "700",
                    letterSpacing: "-0.012em",
                  }}
                >
                  {asset.assetName}
                </div>
                <div
                  style={{
                    fontSize: "var(--text-label-sm)",
                    color: "var(--fg-tertiary)",
                    marginTop: 2,
                  }}
                >
                  {/* 투자 — design: "투자 · 보유 N종목 · 메모" */}
                  {isInv
                    ? [
                        assetTypeLabel(asset.assetType, asset.balance),
                        t("holdings.countLabel", {
                          n: holdingsOf(asset).length,
                        }),
                        asset.memo,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : [
                        asset.institution,
                        assetTypeLabel(asset.assetType, asset.balance),
                        asset.memo,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                </div>
              </div>
            </div>
            {!isCredit && (
              <>
                <div
                  style={{
                    fontSize: "var(--text-badge)",
                    color: "var(--fg-tertiary)",
                    fontWeight: "600",
                    letterSpacing: "0.04em",
                    marginBottom: 4,
                  }}
                >
                  {valueLabel}
                </div>
                <div
                  className="num"
                  style={{
                    fontSize: "var(--text-display-md)",
                    fontWeight: "800",
                    letterSpacing: "-0.022em",
                    color: "var(--fg-primary)",
                  }}
                >
                  <MaskAmount card="asset.detail">
                    {heroAmount < 0 ? "−" : ""}
                    {wonPre()}
                    {KRW(heroAmount, { abs: true })}
                  </MaskAmount>
                  {!isEn() && (
                    <HideUnit>
                      <span
                        style={{
                          fontSize: "var(--text-body-lg)",
                          marginLeft: 2,
                        }}
                      >
                        원
                      </span>
                    </HideUnit>
                  )}
                </div>
                {/* 예수금·평가금액 — 실제 증권 계좌처럼 나눠 보여 준다(예수금이 있을 때만). */}
                {isInv && investCash !== 0 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginTop: 8,
                      fontSize: "var(--text-label-sm)",
                      color: "var(--fg-tertiary)",
                    }}
                  >
                    <span className="num">
                      {t("holdings.cashBalance")}{" "}
                      <MaskAmount card="asset.detail">
                        {KRW(investCash)}
                      </MaskAmount>
                    </span>
                    <span className="dot-sep" />
                    <span className="num">
                      {t("holdings.holdingBalance")}{" "}
                      <MaskAmount card="asset.detail">
                        {KRW(investHolding)}
                      </MaskAmount>
                    </span>
                  </div>
                )}

                {/* 투자 등락 — design: "+N% · 오늘 ±N원" (+빨강/−파랑 국내 통념) */}
                {investVal?.changePct != null && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginTop: 8,
                      fontSize: "var(--text-label-sm)",
                    }}
                  >
                    <span
                      className="num"
                      style={{
                        fontWeight: 700,
                        color:
                          investVal.changePct >= 0
                            ? "var(--status-danger-fg)"
                            : "var(--fg-brand)",
                      }}
                    >
                      {formatChangeRate(investVal.changePct, {
                        sign: "always",
                      })}
                    </span>
                    {investVal.changeAmt != null && (
                      <span
                        className="num"
                        style={{ color: "var(--fg-tertiary)" }}
                      >
                        {t("holdings.todayChange", {
                          sign: investVal.changeAmt >= 0 ? "+" : "−",
                          amount: KRW(Math.abs(investVal.changeAmt)),
                        })}
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* 보유 종목 — design invest 상세: 연동/수동 항목 리스트 (행 클릭 → 편집) */}
          {/* 종목 수정은 하단 [수정] 로만 — 목록 행은 매수·매도 버튼만 받는다. */}
          {isInv && <HoldingsSection asset={asset} mobile={mobile} />}

          {/* 신용카드 — 신판 카드 상세 본문(회차·한도·실적·이용 내역 일체) */}
          {isCredit && (
            <CardDetailBody
              asset={asset}
              mobile={mobile}
              onEdit={onEdit ? () => onEdit(asset) : undefined}
            />
          )}

          {/* 체크카드 — 실적 배지만(청구 회차 없음) */}
          {isCard && !isCredit && (
            <div style={{ marginBottom: 18 }}>
              <CardPerfBadge assetRowId={asset.rowId} />
            </div>
          )}

          {!isCredit && (
            <>
              {/* Balance trend chart — 연결계좌형 체크카드는 잔액이 늘 0 이라 평평한 0 선뿐이다.
          차트만 빼고 내역은 그대로 둔다. */}
              {!isCheckLinked && (
                <div style={{ marginBottom: 18 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      marginBottom: 10,
                    }}
                  >
                    <h4
                      style={{
                        fontSize: "var(--text-label-sm)",
                        fontWeight: "700",
                        margin: 0,
                      }}
                    >
                      {t("assetDetail.recentTrend", {
                        period: periodLabel,
                        label: isCard
                          ? t("assetDetail.trendUsage")
                          : isInv
                            ? t("assetDetail.trendValuation")
                            : t("assetDetail.trendBalance"),
                      })}
                    </h4>
                    <Tabs
                      value={period}
                      onValueChange={(v) => setPeriod(v as "3m" | "6m" | "1y")}
                      className="ml-auto"
                    >
                      <TabsList variant="pill" size="sm">
                        <TabsTrigger value="3m">
                          {t("assetDetail.period3m")}
                        </TabsTrigger>
                        <TabsTrigger value="6m">
                          {t("assetDetail.period6m")}
                        </TabsTrigger>
                        <TabsTrigger value="1y">
                          {t("assetDetail.period1y")}
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                  {trendLoading ? (
                    <SkeletonBase className="h-[160px] w-full rounded-md" />
                  ) : chartData.length === 0 ? (
                    <div
                      style={{
                        height: 160,
                        background: "var(--bg-sunken)",
                        borderRadius: "var(--radius-tile)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--fg-tertiary)",
                        fontSize: "var(--text-label-sm)",
                      }}
                    >
                      {t("assetDetail.noData")}
                    </div>
                  ) : (
                    <div ref={chartBoxRef}>
                      <ChartContainer
                        config={chartConfig}
                        className="aspect-auto w-full"
                        style={{ height: 160 }}
                      >
                        <AreaChart
                          data={chartData}
                          onMouseMove={placeTip}
                          onMouseLeave={() => setTipX(undefined)}
                          margin={{ top: 10, right: 12, left: 0, bottom: 4 }}
                        >
                          <defs>
                            <linearGradient
                              id={`asset-balance-fill-${asset.rowId}`}
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="var(--color-balance)"
                                stopOpacity={0.28}
                              />
                              <stop
                                offset="100%"
                                stopColor="var(--color-balance)"
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            vertical={false}
                            stroke="var(--border-subtle)"
                            strokeDasharray="3 3"
                          />
                          <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            tick={{
                              fontSize: "var(--text-badge)",
                              fill: "var(--fg-tertiary)",
                            }}
                            tickMargin={6}
                            interval="preserveStartEnd"
                            minTickGap={18}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            domain={[yAxis.min, yAxis.max]}
                            ticks={yAxis.ticks}
                            // 금액 숨기기 시 Y축도 마스킹 (앱 정합 — '••••' 4점)
                            tickFormatter={(v: number) =>
                              hidden ? "••••" : formatChartAxis(v)
                            }
                            tick={{
                              fontSize: "var(--text-badge)",
                              fill: "var(--fg-tertiary)",
                            }}
                            width={yAxisWidth}
                          />
                          <ChartTooltip
                            cursor={{
                              stroke: "var(--fg-tertiary)",
                              strokeWidth: 1,
                              strokeDasharray: "3 3",
                            }}
                            position={tipX == null ? undefined : { x: tipX }}
                            allowEscapeViewBox={{ x: true }}
                            content={
                              <BalanceTooltip seriesLabel={seriesLabel} />
                            }
                          />
                          <Area
                            type="monotone"
                            dataKey="balance"
                            stroke="var(--color-balance)"
                            strokeWidth={2}
                            fill={`url(#asset-balance-fill-${asset.rowId})`}
                            dot={{
                              r: 4,
                              fill: "var(--color-balance)",
                              stroke: "var(--bg-surface)",
                              strokeWidth: 1.5,
                            }}
                            activeDot={{
                              r: 5.5,
                              fill: "var(--color-balance)",
                              stroke: "var(--bg-surface)",
                              strokeWidth: 2,
                            }}
                          />
                        </AreaChart>
                      </ChartContainer>
                    </div>
                  )}
                </div>
              )}

              {/* Recent tx */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <h4
                    style={{
                      fontSize: "var(--text-label-sm)",
                      fontWeight: "700",
                      margin: 0,
                    }}
                  >
                    {isCheckLinked
                      ? t("assetDetail.monthTx")
                      : t("assetDetail.recentTx")}
                    {relatedItems.length > 0 ? ` (${relatedItems.length})` : ""}
                  </h4>
                  <button
                    type="button"
                    className="all"
                    style={{
                      marginLeft: "auto",
                      background: "transparent",
                      border: 0,
                      color: "var(--fg-secondary)",
                      cursor: "pointer",
                      fontSize: "var(--text-label-sm)",
                      fontWeight: "600",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 2,
                    }}
                    onClick={viewAll}
                  >
                    {t("assetDetail.viewAll")} <ChevronRight size={12} />
                  </button>
                </div>
                {/* 가계부 메인 리스트 미러 — 카드 제거, 날짜 그룹 헤더 + 플랫 행 */}
                {relatedLoading ? (
                  // 실렌더와 같은 날짜 그룹 구조 — 그룹 gap 16, 행은 LedgerRow(py-3, 칩 40).
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 16,
                    }}
                  >
                    {[0, 1].map((g) => (
                      <div key={g}>
                        {/* DateGroupHeader 자리 — 날짜 + 요일 + 우측 일 합계 */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <SkeletonBase className="h-4 w-12" />
                          <SkeletonBase className="h-4 w-8" />
                          <SkeletonBase className="h-4 w-16 ml-auto" />
                        </div>
                        {[0, 1].map((i) => (
                          <div
                            key={i}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              padding: "12px 4px",
                            }}
                          >
                            <SkeletonBase className="h-10 w-10 rounded-[var(--radius-tile)] shrink-0" />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <SkeletonBase className="h-4 w-2/3" />
                              <SkeletonBase
                                className="h-3 w-1/3"
                                style={{ marginTop: 2 }}
                              />
                            </div>
                            <SkeletonBase className="h-4 w-20 shrink-0" />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : relatedItems.length === 0 ? (
                  <div
                    style={{
                      padding: "24px 0",
                      textAlign: "center",
                      color: "var(--fg-tertiary)",
                      fontSize: "var(--text-label-sm)",
                    }}
                  >
                    {t("assetDetail.noLinkedTx")}
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 16,
                    }}
                  >
                    {relatedGroups.map(([d, items]) => {
                      const { md, dow } = formatDay(d);
                      // 일 합계는 지출/수입만 — 이체는 자산 간 이동이라 어느 쪽에도 넣지 않는다.
                      // 환불된 거래도 뺀다 — 행은 취소선으로 남지만 합계에선 없는 것이다(23차 8).
                      const dayExpenses = items.flatMap((i) =>
                        i.kind === "expense" && !isRefundedTx(i.expense)
                          ? [i.expense]
                          : [],
                      );
                      const out = dayExpenses
                        .filter((tx) => tx.expenseType === "EXPENSE")
                        .reduce((s, tx) => s + Math.abs(tx.amount), 0);
                      const inn = dayExpenses
                        .filter((tx) => tx.expenseType === "INCOME")
                        .reduce((s, tx) => s + Math.abs(tx.amount), 0);
                      return (
                        <div key={d}>
                          <DateGroupHeader
                            date={md}
                            weekday={dow}
                            expense={out}
                            income={inn}
                          />
                          {items.map((item) =>
                            item.kind === "expense" ? (
                              <ExpenseRow
                                key={`e${item.expense.rowId}`}
                                expense={item.expense}
                              />
                            ) : (
                              <TransferRow
                                key={`t${item.transfer.rowId}`}
                                transfer={item.transfer}
                                perspectiveAssetRowId={asset.rowId}
                              />
                            ),
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </ModalShell>
      </HideForce>
      {/* 푸는 쪽에만 본인 확인을 건다 — 켜는 건 그냥 된다(카드 가리기와 같은 규칙). */}
      <HideAmountsUnlockDialog
        open={unlockOpen}
        onOpenChange={setUnlockOpen}
        onVerified={() => {
          setUnlockOpen(false);
          applyHidden("N");
        }}
      />
    </>
  );
}
