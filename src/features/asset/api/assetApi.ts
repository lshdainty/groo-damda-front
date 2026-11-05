import { apiClient, type QuietRequestConfig } from "@/shared/api";
import type { ApiResponse } from "@/shared/types";
import type {
  Asset,
  AssetFormValues,
  AssetUpdateFormValues,
  AssetSummary,
  AssetTransfer,
  AssetTransferFormValues,
  ReorderItem,
  NetWorthTrendPoint,
  AssetBalancePoint,
  CardBilling,
  BillingItem,
  AssetTrade,
  AssetTradeFormValues,
  AssetTradePreview,
} from "@/entities/asset";

export interface TransferListParams {
  startDate?: string;
  endDate?: string;
}

/** silent — 실패를 호출처가 화면 안에서 고정 글로 말한다(전역 서버 원문 토스트와 겹치지 않게, 호출처 단위) */
type SilentOpts = { silent?: boolean };
const silentConfig = (opts?: SilentOpts) =>
  (opts?.silent
    ? { silent: true }
    : {}) as import("axios").AxiosRequestConfig & { silent?: boolean };

export const assetApi = {
  createAsset: async (
    data: AssetFormValues,
    opts?: SilentOpts,
  ): Promise<Asset> => {
    const resp: ApiResponse<Asset> = await apiClient.post(
      "/v1/asset",
      data,
      silentConfig(opts),
    );
    return resp.data;
  },

  /** silent — 실패를 호출처가 화면 안에서 말한다(전역 오류 토스트를 띄우지 않는다: 계좌·카드 관리, I-17 후속) */
  getAssets: async (opts?: {
    silent?: boolean;
  }): Promise<{ assets: Asset[] }> => {
    const resp: ApiResponse<{ assets: Asset[] }> = await apiClient.get(
      "/v1/assets",
      { silent: opts?.silent } as import("axios").AxiosRequestConfig & {
        silent?: boolean;
      },
    );
    return resp.data;
  },

  getAsset: async (id: number): Promise<Asset> => {
    const resp: ApiResponse<Asset> = await apiClient.get(`/v1/asset/${id}`);
    return resp.data;
  },

  updateAsset: async (
    id: number,
    data: AssetUpdateFormValues,
    opts?: SilentOpts,
  ): Promise<Asset> => {
    const resp: ApiResponse<Asset> = await apiClient.put(
      `/v1/asset/${id}`,
      data,
      silentConfig(opts),
    );
    return resp.data;
  },

  deleteAsset: async (id: number, opts?: SilentOpts): Promise<void> => {
    const resp: ApiResponse<void> = await apiClient.delete(
      `/v1/asset/${id}`,
      silentConfig(opts),
    );
    return resp.data;
  },

  getAssetSummary: async (
    year?: number,
    month?: number,
  ): Promise<AssetSummary> => {
    const params = year && month ? { year, month } : undefined;
    const resp: ApiResponse<AssetSummary> = await apiClient.get(
      "/v1/assets/summary",
      { params },
    );
    return resp.data;
  },

  getNetWorthTrend: async (months = 12): Promise<NetWorthTrendPoint[]> => {
    const resp: ApiResponse<{ trend: NetWorthTrendPoint[] }> =
      await apiClient.get("/v1/assets/net-worth-trend", { params: { months } });
    return resp.data.trend;
  },

  getAssetBalanceTrend: async (
    assetId: number,
    weeks: number,
    opts?: SilentOpts,
  ): Promise<AssetBalancePoint[]> => {
    const resp: ApiResponse<{ trend: AssetBalancePoint[] }> =
      await apiClient.get(`/v1/asset/${assetId}/balance-trend`, {
        params: { weeks },
        ...silentConfig(opts),
      });
    return resp.data.trend;
  },

  getCardBilling: async (
    id: number,
    opts?: SilentOpts,
  ): Promise<CardBilling> => {
    const resp: ApiResponse<CardBilling> = await apiClient.get(
      `/v1/asset/${id}/billing`,
      silentConfig(opts),
    );
    return resp.data;
  },

  /** amount 미전달 = 남은 청구액 전액, 전달 = 그만큼만(부분 선결제).
   *  paymentDate = 결제할 회차의 결제일(다음 회차 선결제). 미전달 = 다가오는 회차 */
  payCard: async (
    id: number,
    amount?: number,
    paymentDate?: string,
  ): Promise<BillingItem> => {
    const params: Record<string, string | number> = {};
    if (amount != null) params.amount = amount;
    if (paymentDate) params.paymentDate = paymentDate;
    const resp: ApiResponse<BillingItem> = await apiClient.post(
      `/v1/asset/${id}/pay`,
      undefined,
      // silent — 실패는 지금 결제 폼 맨 위 Callout 이 말한다
      {
        ...(Object.keys(params).length > 0 ? { params } : {}),
        ...silentConfig({ silent: true }),
      },
    );
    return resp.data;
  },

  /** 할부 중도 전액 상환 — 남은 원금을 다가오는 청구 회차에 몰아 청구한다. */
  payoffInstallment: async (
    cardId: number,
    expenseId: number,
  ): Promise<void> => {
    const resp: ApiResponse<void> = await apiClient.post(
      `/v1/asset/${cardId}/installments/${expenseId}/payoff`,
      undefined,
      silentConfig({ silent: true }),
    );
    return resp.data;
  },

  /** 할부 상환 취소 — 정상 분할로 되돌린다. */
  cancelInstallmentPayoff: async (
    cardId: number,
    expenseId: number,
  ): Promise<void> => {
    const resp: ApiResponse<void> = await apiClient.delete(
      `/v1/asset/${cardId}/installments/${expenseId}/payoff`,
      silentConfig({ silent: true }),
    );
    return resp.data;
  },

  /** 카드 결제 취소 — 결제로 만든 이체를 무르면 잔액·청구가 그 연쇄로 되돌아간다. */
  cancelCardPayment: async (billingRowId: number): Promise<void> => {
    const resp: ApiResponse<void> = await apiClient.delete(
      `/v1/card-billing/${billingRowId}`,
      silentConfig({ silent: true }),
    );
    return resp.data;
  },

  reorderAssets: async (items: ReorderItem[]): Promise<void> => {
    const resp: ApiResponse<void> = await apiClient.patch(
      "/v1/assets/reorder",
      { items },
    );
    return resp.data;
  },

  createTransfer: async (
    data: AssetTransferFormValues,
    opts?: { silent?: boolean },
  ): Promise<AssetTransfer> => {
    const resp: ApiResponse<AssetTransfer> = await apiClient.post(
      "/v1/asset-transfer",
      data,
      { silent: opts?.silent } as import("axios").AxiosRequestConfig & {
        silent?: boolean;
      },
    );
    return resp.data;
  },

  /** 이체 수정 — 서버가 이자 지출·잔액 이력을 되돌렸다 다시 만든다. rowId 는 유지된다. */
  updateTransfer: async (
    id: number,
    data: AssetTransferFormValues,
    opts?: { silent?: boolean },
  ): Promise<AssetTransfer> => {
    const resp: ApiResponse<AssetTransfer> = await apiClient.put(
      `/v1/asset-transfer/${id}`,
      data,
      { silent: opts?.silent } as import("axios").AxiosRequestConfig & {
        silent?: boolean;
      },
    );
    return resp.data;
  },

  getTransfers: async (
    params?: TransferListParams,
    opts?: SilentOpts,
  ): Promise<{ transfers: AssetTransfer[] }> => {
    const resp: ApiResponse<{ transfers: AssetTransfer[] }> =
      await apiClient.get("/v1/asset-transfers", {
        params,
        ...silentConfig(opts),
      });
    return resp.data;
  },

  deleteTransfer: async (
    id: number,
    options?: { silent?: boolean },
  ): Promise<void> => {
    const resp: ApiResponse<void> = await apiClient.delete(
      `/v1/asset-transfer/${id}`,
      options?.silent ? ({ silent: true } as QuietRequestConfig) : undefined,
    );
    return resp.data;
  },

  /** 저장하기 전에 결과를 물어본다 — 저장에 쓰는 계산 경로를 그대로 탄다. */
  previewTrade: async (
    data: AssetTradeFormValues,
  ): Promise<AssetTradePreview> => {
    const resp: ApiResponse<AssetTradePreview> = await apiClient.post(
      "/v1/asset-trade/preview",
      data,
    );
    return resp.data;
  },

  createTrade: async (
    data: AssetTradeFormValues,
    opts?: SilentOpts,
  ): Promise<AssetTrade> => {
    const resp: ApiResponse<AssetTrade> = await apiClient.post(
      "/v1/asset-trade",
      data,
      silentConfig(opts),
    );
    return resp.data;
  },

  getTrades: async (assetRowId: number): Promise<AssetTrade[]> => {
    const resp: ApiResponse<AssetTrade[]> = await apiClient.get(
      "/v1/asset-trades",
      {
        params: { assetRowId },
      },
    );
    return resp.data;
  },

  deleteTrade: async (id: number): Promise<void> => {
    const resp: ApiResponse<void> = await apiClient.delete(
      `/v1/asset-trade/${id}`,
      silentConfig({ silent: true }),
    );
    return resp.data;
  },
};
