import { useMemo } from "react";
import { useMyFeatures } from "@/features/subscription/model/useSubscription";
import { useLivePrices } from "@/features/stock/model/useLivePrices";
import { qtyNumber, type Asset, type AssetHolding } from "@/entities/asset";

/** 투자 자산의 라이브 평가 요약 — value(평가액), changeAmt/changePct(전일 대비, 연동 종목만). */
export interface InvestValuation {
  value: number;
  changeAmt: number | null;
  changePct: number | null;
}

/**
 * 자산의 실효 보유 목록 — holdings 가 있으면 그대로, 없고 구버전 단일 연동
 * (tossSymbol+tossQuantity)만 있으면 linked 1건으로 합성(하위호환).
 */
export function holdingsOf(a: Asset): AssetHolding[] {
  if (a.holdings && a.holdings.length > 0) return a.holdings;
  if (a.tossSymbol && a.tossQuantity != null) {
    // tossQuantity 는 구버전 bigint 컬럼(정수) — 문자열 수량 계약에 맞춰 넘긴다.
    return [
      {
        linked: true,
        marketCode: a.marketCode ?? null,
        tossSymbol: a.tossSymbol,
        quantity: String(a.tossQuantity),
      },
    ];
  }
  return [];
}

/** 보유 목록에서 연동 심볼만 중복 없이 추출. */
export function linkedSymbolsOf(assets: Asset[]): string[] {
  const set = new Set<string>();
  for (const a of assets) {
    for (const h of holdingsOf(a)) {
      if (h.linked && h.tossSymbol) set.add(h.tossSymbol);
    }
  }
  return [...set];
}

/**
 * 투자 자산들의 라이브 평가 맵 (assetRowId → {value, changeAmt, changePct}).
 *
 * - 평가액 = Σ 보유: 연동(linked) = 현재가 × 수량(외화는 환율 환산),
 *   수동 = holdingValue 그대로.
 * - 시세·환율·전일종가 조달은 전부 {@link useLivePrices} 에 있다. 자산 목록·상세·편집이
 *   같은 훅을 써야 한 화면에서 총액과 종목별 금액이 어긋나지 않는다(실제로 어긋난 적이 있다).
 * - 프로(SECURITIES)+증권사 연결이 아니거나, 연동 종목 시세가 하나라도 미확보면
 *   그 자산은 맵에서 제외(DB balance 유지 — 0 왜곡 방지, 기존 단일 연동과 동일 정책).
 * - 등락(changeAmt/Pct)은 전일 종가가 확보된 연동 종목만 합산. 기준이 하나도 없으면 null.
 * - 10초 폴링 → 자산 화면 실시간 갱신.
 */
export function useInvestValuation(
  investAssets: Asset[],
): Map<number, InvestValuation> {
  return useInvestValuationState(investAssets).map;
}

/**
 * 라이브 평가 맵 + 시세 실패(단계 4) — 시세 · 환율을 못 받으면 그 자산은 DB 잔액(또는 옛 시세)으로 보인다.
 * `priceFailed` 면 화면이 그 카드에 "시세를 불러오지 못했어요" 띠를 둔다(숫자는 둔다 — 조용히 틀린 값으로 두지 않는다).
 */
export function useInvestValuationState(investAssets: Asset[]): {
  map: Map<number, InvestValuation>;
  priceFailed: boolean;
  retryPrices: () => void;
} {
  const { data: features } = useMyFeatures({ reference: true });
  const enabled =
    (features?.features?.includes("SECURITIES") ?? false) &&
    (features?.connectedBrokers?.length ?? 0) > 0;
  const symbols = useMemo(() => linkedSymbolsOf(investAssets), [investAssets]);
  // 증권 API 는 서버 게이트(SECURITIES 구독) 대상 — 미구독자가 호출하면 403.
  const active = enabled && symbols.length > 0;
  const activeSymbols = useMemo(
    () => (active ? symbols : []),
    [active, symbols],
  );
  const live = useLivePrices(activeSymbols, active);

  const map = useMemo(() => {
    const map = new Map<number, InvestValuation>();
    if (!active) return map;

    for (const a of investAssets) {
      const hs = holdingsOf(a);
      const linked = hs.filter((h) => h.linked && h.tossSymbol);
      if (linked.length === 0) continue; // 수동 전용은 DB balance 그대로 사용
      let value = 0;
      let changeAmt = 0;
      let hasChangeBase = false;
      let complete = true;
      for (const h of hs) {
        if (h.linked && h.tossSymbol) {
          // 수량은 문자열(BigDecimal 계약) — 화면 표시용 합계라 여기서만 숫자로 푼다.
          const qty = qtyNumber(h.quantity) ?? 0;
          const krw = live.unitKrw(h.tossSymbol);
          if (krw == null) {
            complete = false;
            break;
          }
          value += Math.round(krw * qty);
          const prevKrw = live.prevUnitKrw(h.tossSymbol);
          if (prevKrw != null) {
            changeAmt += Math.round((krw - prevKrw) * qty);
            hasChangeBase = true;
          }
        } else {
          value += h.holdingValue ?? 0;
        }
      }
      if (!complete) continue;
      const base = value - changeAmt;
      const changePct =
        hasChangeBase && base !== 0
          ? Math.round((changeAmt / base) * 10000) / 100
          : null;
      map.set(a.rowId, {
        value,
        changeAmt: hasChangeBase ? changeAmt : null,
        changePct,
      });
    }
    return map;
  }, [active, investAssets, live]);
  return { map, priceFailed: live.failed, retryPrices: live.retry };
}

/**
 * (하위호환) 연동 투자 자산의 라이브 평가액(KRW) 맵 (assetRowId → 평가액).
 * holdings 도입 후에도 기존 호출부(합계 보정 등)가 값만 쓰는 경우를 위해 유지.
 */
export function useInvestValuationMap(
  linkedAssets: Asset[],
): Map<number, number> {
  const full = useInvestValuation(linkedAssets);
  return useMemo(() => {
    const map = new Map<number, number>();
    for (const [k, v] of full) map.set(k, v.value);
    return map;
  }, [full]);
}
