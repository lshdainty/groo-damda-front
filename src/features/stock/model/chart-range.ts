import { useMyFeatures } from "@/features/subscription/model/useSubscription";

export const RANGES = ["1D", "1주", "1개월", "3개월", "1년"] as const;
export type Range = (typeof RANGES)[number];
// 기간 값은 LightweightStockChart·임베드 querystring 의 식별자이므로 보존하고, 표시 라벨만 i18n.
export const RANGE_LABEL_KEY: Record<Range, string> = {
  "1D": "range.1d",
  "1주": "range.1w",
  "1개월": "range.1m",
  "3개월": "range.3m",
  "1년": "range.1y",
};

/**
 * 캔들을 그릴 수 있는가 = 증권사가 하나라도 연결돼 있는가.
 *
 * **아직 모르는 상태를 `false` 로 뭉개지 않는다.** 연결 정보가 오기 전에 '못 그린다' 로
 * 단정하면 연결한 사용자에게 첫 프레임마다 "증권사를 연결하세요" 가 번쩍인다. 반대로
 * `true` 로 뭉개면 미연결 사용자가 실패할 캔들 요청을 낸다. 그래서 셋으로 가른다.
 *
 * **증권사 이름을 보지 않는다.** 어느 증권사로 조회할지는 서버가 정하고(기본 소스 → 못 주면
 * 연결된 다른 곳), 여기서 목록을 들고 있으면 증권사가 늘 때마다 화면을 같이 고쳐야 한다.
 */
type CandleAvailability = "yes" | "no" | "unknown";

export function useCandleAvailability(): CandleAvailability {
  const { data: features, isLoading } = useMyFeatures({ reference: true });
  if (isLoading || !features) return "unknown";
  return (features.connectedBrokers ?? []).length > 0 ? "yes" : "no";
}
