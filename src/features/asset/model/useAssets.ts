import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  referenceMeta,
  referenceSilent,
  type ReferenceOpts,
  type SilentOpts,
} from "@/shared/api";
import { assetKeys, invalidateFor } from "@/shared/config";
import { assetApi } from "../api/assetApi";
import type { TransferListParams } from "../api/assetApi";
import type {
  AssetFormValues,
  AssetUpdateFormValues,
  AssetTransferFormValues,
  AssetTradeFormValues,
  ReorderItem,
} from "@/entities/asset";

/** `reference` — 계좌 이름 · 후보를 채우려는 참조 조회: 요청은 silent, 실패는 앱 공용 스낵바 한 자리가 알린다 */
export const useAssets = (opts?: ReferenceOpts) => {
  return useQuery({
    queryKey: assetKeys.list(),
    queryFn: () => assetApi.getAssets(referenceSilent(opts)),
    ...referenceMeta(opts),
  });
};

/**
 * 계좌 rowId → 통화 — 이체 줄이 보내는 · 받는 계좌 통화로 금액을 찍는다(I-13). 목록 쿼리(같은 키)를 그대로 읽어 요청이 늘지 않고,
 * 실패는 조용히(silent) — 통화를 모르면 줄은 원화로 찍힌다(지금 그대로).
 */
export const useAssetCurrencyOf = () => {
  const { data } = useAssets({ silent: true });
  const list = data?.assets ?? [];
  return (assetRowId: number): string | null =>
    list.find((a) => a.rowId === assetRowId)?.currency ?? null;
};

export const useAsset = (id: number, opts?: ReferenceOpts) => {
  return useQuery({
    queryKey: assetKeys.detail(id),
    queryFn: () => assetApi.getAsset(id, referenceSilent(opts)),
    enabled: id > 0,
    ...referenceMeta(opts),
  });
};

export const useAssetSummary = (year?: number, month?: number) => {
  return useQuery({
    queryKey: assetKeys.summary(year, month),
    queryFn: () => assetApi.getAssetSummary(year, month),
  });
};

export const useNetWorthTrend = (months = 12) => {
  return useQuery({
    queryKey: assetKeys.netWorthTrend(months),
    queryFn: () => assetApi.getNetWorthTrend(months),
    enabled: months > 0,
  });
};

export const useAssetBalanceTrend = (
  assetId: number,
  weeks: number,
  opts?: { silent?: boolean },
) => {
  return useQuery({
    queryKey: assetKeys.balanceTrend(assetId, weeks),
    queryFn: () => assetApi.getAssetBalanceTrend(assetId, weeks, opts),
    enabled: assetId > 0 && weeks > 0,
    // 자산 잔액 추이는 자주 바뀌지 않으므로 5분간 fresh.
    // 탭(3개월/6개월/1년) 전환 시 이미 조회한 기간은 즉시 재사용.
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

/**
 * 자산 추가 — 자산만 생기는 게 아니다. 신용카드의 "이전 미결제 사용액" 은 **거래 한 건**
 * (카드 이월)으로 만들어지고, 계좌의 첫 잔액도 가계부·홈 합계가 읽는다. 그래서 거래
 * 변경과 같은 범위(`"ledger"`)를 턴다 — `"asset"` 만 털면 가계부에 이월 거래가 안 보였다
 * (QA 23차 낮음).
 */
export const useCreateAsset = (opts?: { silent?: boolean }) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AssetFormValues) => assetApi.createAsset(data, opts),
    onSuccess: () => invalidateFor(queryClient, "ledger"),
  });
};

/**
 * 자산 수정 — 이월 금액을 고치면 카드 이월 거래가, 결제일·결제계좌를 바꾸면 청구가,
 * 잔액을 고치면 잔액 앵커가 바뀐다. 가계부·카드·홈이 함께 늙으므로 `"ledger"` 다.
 */
export const useUpdateAsset = (opts?: { silent?: boolean }) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: AssetUpdateFormValues }) =>
      assetApi.updateAsset(id, data, opts),
    onSuccess: () => invalidateFor(queryClient, "ledger"),
  });
};

export const useDeleteAsset = () => {
  const queryClient = useQueryClient();

  return useMutation({
    // silent — 실패는 호출처가 확인창 뒤 스낵바(useConfirmFail)로 말한다
    mutationFn: (id: number) => assetApi.deleteAsset(id, { silent: true }),
    // 자산만 사라지는 게 아니다 — 그 자산의 거래도 함께 사라진다.
    onSuccess: () => invalidateFor(queryClient, "ledger"),
  });
};

export const useCardBilling = (id: number, opts?: { silent?: boolean }) => {
  return useQuery({
    queryKey: assetKeys.billing(id),
    queryFn: () => assetApi.getCardBilling(id, opts),
    enabled: id > 0,
  });
};

export const usePayCard = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      amount,
      paymentDate,
    }: {
      id: number;
      amount?: number;
      /** 결제할 회차의 결제일 — 다음 회차를 미리 낼 때 넘긴다. 없으면 다가오는 회차. */
      paymentDate?: string;
    }) => assetApi.payCard(id, amount, paymentDate),
    onSuccess: () => invalidateFor(queryClient, "ledger"),
  });
};

/** 카드 결제 취소 — 잔액·청구·가계부·실적이 함께 되돌아간다. */
export const useCancelCardPayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (billingRowId: number) =>
      assetApi.cancelCardPayment(billingRowId),
    onSuccess: () => invalidateFor(queryClient, "ledger"),
  });
};

/** 할부 중도 전액 상환/취소 — 예정액과 함께 잔액·가계부 할부 표시도 움직인다. */
export const useInstallmentPayoff = (cardRowId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ expenseId, undo }: { expenseId: number; undo?: boolean }) =>
      undo
        ? assetApi.cancelInstallmentPayoff(cardRowId, expenseId)
        : assetApi.payoffInstallment(cardRowId, expenseId),
    onSuccess: () => invalidateFor(queryClient, "ledger"),
  });
};

export const useReorderAssets = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (items: ReorderItem[]) => assetApi.reorderAssets(items),
    onSuccess: () => invalidateFor(queryClient, "asset"),
  });
};

export const useAssetTransfers = (
  params?: TransferListParams,
  opts?: { silent?: boolean },
) => {
  return useQuery({
    queryKey: assetKeys.transfers(params),
    queryFn: () => assetApi.getTransfers(params, opts),
  });
};

export const useCreateTransfer = (opts?: { silent?: boolean }) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AssetTransferFormValues) =>
      assetApi.createTransfer(data, opts),
    // 이자가 있는 이체는 지출 거래를 하나 만든다.
    onSuccess: () => invalidateFor(queryClient, "ledger"),
  });
};

/** 이체 수정 — 서버가 이자 지출·잔액 이력을 다시 만든다. */
export const useUpdateTransfer = (opts?: { silent?: boolean }) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: AssetTransferFormValues }) =>
      assetApi.updateTransfer(id, data, opts),
    onSuccess: () => invalidateFor(queryClient, "ledger", { wait: true }),
  });
};

/**
 * 매수·매도 등록 — 예수금·보유 수량·원가·실현손익이 함께 움직인다.
 * 실현손익이 거래로 잡히므로 가계부까지 늙는다.
 */
export const useCreateTrade = (opts?: { silent?: boolean }) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AssetTradeFormValues) =>
      assetApi.createTrade(data, opts),
    onSuccess: () => invalidateFor(queryClient, "ledger"),
  });
};

/**
 * 매매 미리보기 — 실현손익·예수금 잔액을 서버에 물어본다.
 *
 * <p>화면에서 계산하지 않는다. 이동평균 매수원가 규칙이 웹·앱·서버에 각각 적혀 있으면
 * 하나만 고쳐도 갈라지고, JS 는 수를 double 로 다뤄 끝자리가 어긋난다.
 *
 * <p>입력할 때마다 부르지 않도록 호출부에서 값을 늦춰(debounce) 넘긴다.
 */
export const useTradePreview = (
  data: AssetTradeFormValues | null,
  opts?: SilentOpts,
) =>
  useQuery({
    queryKey: [...assetKeys.all, "trade-preview", data],
    queryFn: () => assetApi.previewTrade(data as AssetTradeFormValues, opts),
    enabled: data != null,
    // 같은 입력이면 다시 묻지 않는다 — 저장 전이라 서버 상태가 바뀔 일이 없다.
    staleTime: 30_000,
    // 미리보기가 실패해도 화면을 막지 않는다. 값을 안 보여 줄 뿐이다.
    retry: false,
  });

export const useAssetTrades = (assetRowId?: number, opts?: SilentOpts) =>
  useQuery({
    queryKey: [...assetKeys.all, "trades", assetRowId],
    queryFn: () => assetApi.getTrades(assetRowId as number, opts),
    enabled: assetRowId != null,
  });

export const useDeleteTrade = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => assetApi.deleteTrade(id),
    onSuccess: () => invalidateFor(queryClient, "ledger"),
  });
};

export const useDeleteTransfer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, silent }: { id: number; silent?: boolean }) =>
      assetApi.deleteTransfer(id, { silent }),
    // 이자 지출도 함께 사라진다 — 안 비우면 유령처럼 남아 보인다. 다시 받기를 기다린 뒤 호출처 콜백이 불려 지운 이체의 버튼이 남지 않는다
    onSuccess: () => invalidateFor(queryClient, "ledger", { wait: true }),
  });
};
