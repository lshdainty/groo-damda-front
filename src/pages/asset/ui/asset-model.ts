import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  assetKeys,
  recurringTransactionKeys,
  savingGoalKeys,
} from "@/shared/config";
import { useAssets, useAssetSummary } from "@/features/asset";
import type { Asset } from "@/entities/asset";
import { groupAssets, useLiveAssets } from "@/widgets/asset-full";

export {
  ACCOUNT_TYPES,
  CARD_TYPES,
  INVESTMENT_TYPES,
  LOAN_TYPES,
  cardUsageOf,
  krwOf,
  useAssetHidden,
  useAssetMask,
} from "@/widgets/asset-full";

const EMPTY_ASSETS: Asset[] = [];

export type OutletCtx = { onAddTx: () => void; mobile: boolean };

/** 글 폭이 한도 이하인지 — 도넛 가운데 합계 판정(구멍 − 16) */
export function useFitLimit(limit: number) {
  const ref = useRef<HTMLSpanElement>(null);
  const [fits, setFits] = useState(true);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() =>
      setFits(el.getBoundingClientRect().width <= limit),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [limit]);
  return [ref, fits] as const;
}

/** 자산 화면이 읽는 자산 묶음 · 합계 — 목록 · 요약 두 쿼리만(추이 · 예정 결제 · 저축 목표는 각 카드가 제 쿼리로) */
export function useAssetGroups() {
  const queryClient = useQueryClient();
  const assetsQ = useAssets();
  const summaryQ = useAssetSummary();
  // 연동 보유가 있는 투자 자산은 라이브 평가액으로 잔액을 덮어쓴다 — 관리 화면과 같은 훅(`useLiveAssets`).
  const { list, linked, investValMap, valMap } = useLiveAssets(
    assetsQ.data?.assets ?? EMPTY_ASSETS,
  );
  const groups = useMemo(() => groupAssets(list), [list]);

  // 백엔드 summary(DB 잔액 기준)에 연결 자산의 (라이브−DB) 차액만큼 순자산/변화를 보정.
  //
  // 비교 대상은 평가금액끼리다. 라이브 값은 보유분만 계산하는데 balance 는
  // 예수금 + 평가금액이라, 그걸 빼면 예수금만큼 순자산이 깎인다.
  // 둘 다 원화다 — 보유 평가(holdingBalance)는 외화 자산에서도 원화이고 서버 순자산도 round(예수금 × 환율) + 보유 평가라(I-13 길 A)
  // 환율을 곱하지 않고 그대로 뺀다.
  const liveDelta = useMemo(
    () =>
      linked.reduce((s, a) => {
        if (a.isIncludedInTotal !== "Y") return s;
        const v = valMap.get(a.rowId);
        return v != null ? s + (v - (a.holdingBalance ?? 0)) : s;
      }, 0),
    [linked, valMap],
  );

  const netWorth = (summaryQ.data?.netWorth ?? 0) + liveDelta;
  const changeAmount = (summaryQ.data?.changeAmount ?? 0) + liveDelta;
  const lastMonth = summaryQ.data?.lastMonthNetWorth ?? 0;
  const changePercent =
    lastMonth !== 0
      ? Math.round((changeAmount / Math.abs(lastMonth)) * 10000) / 100
      : (summaryQ.data?.changePercent ?? 0);

  const assetsFailed = assetsQ.isError === true;
  const summaryFailed = summaryQ.isError === true;

  return {
    ...groups,
    investValMap,
    netWorth,
    changeAmount,
    changePercent,
    hasLastMonth: lastMonth !== 0,
    // 카드(띠)마다 따로 — 화면 전체가 한 번에 스켈레톤 ↔ 실패로 도는 게이트를 두지 않는다(I-05 62)
    assetsLoading: assetsQ.isLoading,
    assetsFailed,
    summaryLoading: assetsQ.isLoading || summaryQ.isLoading,
    summaryFailed: assetsFailed || summaryFailed,
    isLoading: assetsQ.isLoading || summaryQ.isLoading,
    isFetching: assetsQ.isFetching || summaryQ.isFetching,
    retryAssets: () => {
      void assetsQ.refetch();
    },
    retrySummary: () => {
      if (assetsFailed) void assetsQ.refetch();
      if (summaryFailed) void summaryQ.refetch();
    },
    // 이 화면이 읽는 건 목록·요약만이 아니다. 순자산 추이(assetKeys.netWorthTrend) ·
    // 저축목표 · 예정 결제(반복 거래)가 같은 화면에 있는데, 목록·요약만 refetch 하던
    // 탓에 새로고침을 눌러도 아래 셋은 옛 값 그대로였다(QA #149).
    // 자산 세 쿼리는 루트 키 하나로 묶이고, 나머지 둘은 자기 루트 키로 비운다.
    //
    // 여기 없는 둘 — 라이브 시세(useLivePrices)는 10초마다 스스로 폴링하고,
    // 종목명(stockKeys.symbolName)은 변하지 않는 마스터 데이터다. 다시 부를 이유가 없다.
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: assetKeys.all });
      queryClient.invalidateQueries({ queryKey: savingGoalKeys.all });
      queryClient.invalidateQueries({ queryKey: recurringTransactionKeys.all });
    },
  };
}

export type AssetGroups = ReturnType<typeof useAssetGroups>;
