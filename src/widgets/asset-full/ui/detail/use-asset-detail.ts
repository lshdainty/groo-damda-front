import { useMemo } from "react";
import { type Asset } from "@/entities/asset";
import { isScheduledTx } from "@/entities/expense";
import { useInvestValuation, useAssetTransfers } from "@/features/asset";
import { useSearchExpenses } from "@/features/expense";
import { currentYearMonth, AssetLedgerItem } from "./detail-shared";

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
export function useAssetLiveValuation(asset: Asset, isInv: boolean) {
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
export function useAssetLedger(asset: Asset, isCheckLinked: boolean) {
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
