import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { parseAmount } from "@/shared/lib/groo/amount";
import { isWriteUnconfirmed } from "@/shared/api";
import type { Asset, InstallmentDue } from "@/entities/asset";
import type { Expense } from "@/entities/expense";
import {
  useCancelCardPayment,
  useInstallmentPayoff,
  useCardBilling,
  usePayCard,
} from "@/features/asset";
import { useSearchExpenses } from "@/features/expense";
import { formatDay, money } from "@/shared/lib/groo/format";
import { fmtBillingDate } from "./detail-shared";
import { useAssetMask } from "../../lib/asset-groups";

// 결제 회차(청구월) 항목 — 예정 1건 + 과거 결제 완료 이력.
export type CardStatement = {
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
 * 신용카드 상세의 상태 · 셈(I-17 46 · 47) — 청구 · 한도 · 이용 내역이 같은 값(고른 회차 `st`)을 읽는다.
 * 청구 계산 · 요청 · 무효화 · 서버 키는 지난 CardDetailBody 그대로다(옮기기만 했다 — desk-card-billing-money-cap · card-payment-anchor-collision).
 */
export function useCardDetail(asset: Asset) {
  const m = useAssetMask("asset.detail", asset.isAmountHidden === "Y");
  const { t } = useTranslation("asset");
  const billingQ = useCardBilling(asset.rowId, { silent: true });
  const { data: billing, isLoading } = billingQ;
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
  const periodText =
    st?.periodStart && st?.periodEnd
      ? `${fmtBillingDate(st.periodStart)} ~ ${fmtBillingDate(st.periodEnd)}`
      : null;

  // 이용 내역 — 선택 회차의 청구 기간(전월 1일~말일)만 조회(사용자 결정).
  // 기간 미확정(폴백 회차)이면 기간 조건 없이 카드 전체에서 최근순.
  const usageQ = useSearchExpenses(
    st?.periodStart && st?.periodEnd
      ? {
          assetId: asset.rowId,
          startDate: st.periodStart,
          endDate: st.periodEnd,
        }
      : { assetId: asset.rowId },
    { silent: true },
  );
  const usageAll = usageQ.data;
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
        ? t("assetDetail.payMoveNote", { amount: m(money(cardDebt)) })
        : null;

  const [payFailed, setPayFailed] = useState(false);
  const handlePay = () => {
    // 버튼과 Enter 가 같은 길 — 요청 중이면 두 번째는 보내지 않는다
    if (!canPay || !payAmountValid) return;
    setPayFailed(false);
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
        // 폼을 연 채 맨 위 Callout 으로 말하고 입력한 금액은 둔다
        onError: () => setPayFailed(true),
      },
    );
  };

  return {
    billing,
    isLoading,
    isError: billingQ.isError && !billing,
    // 결제 응답을 못 읽었다(PARSE) — 결제됐을 수 있다. "결제됐는지 확인하지 못했어요" 로 말하고 청구는 훅이 다시 받는다
    payUnconfirmed: isWriteUnconfirmed(payCard.error),
    refetch: () => void billingQ.refetch(),
    payCard,
    confirmPay,
    setConfirmPay,
    payAmount,
    setPayAmount,
    stIdx,
    setStIdx,
    pickOpen,
    setPickOpen,
    sort,
    setSort,
    statements,
    activeIdx,
    st,
    byYear,
    limit,
    used,
    limitPct,
    paymentDay,
    cancelPayment,
    installmentPayoff,
    payoffTarget,
    payFailed,
    setPayFailed,
    setPayoffTarget,
    lastPayment,
    confirmCancelPay,
    setConfirmCancelPay,
    showPayNow,
    periodText,
    usageTx,
    usageFailed: usageQ.isError && !usageQ.data,
    retryUsage: () => void usageQ.refetch(),
    sorted,
    usageGroups,
    openPay,
    payAmountNum,
    upcoming,
    payAmountValid,
    canPay,
    payMoveNote,
    handlePay,
  };
}

export type CardDetail = ReturnType<typeof useCardDetail>;
