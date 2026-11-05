import { useQuery } from "@tanstack/react-query";
import type { SilentOpts } from "@/shared/api";
import { cardKeys } from "@/shared/config";
import { cardPerformanceApi } from "../api/cardPerformanceApi";

export const useCardPerformance = (
  assetRowId: number | null,
  yearMonth: string,
  opts?: SilentOpts,
) => {
  return useQuery({
    queryKey: cardKeys.performance(assetRowId ?? 0, yearMonth),
    queryFn: () =>
      cardPerformanceApi.getPerformance(assetRowId!, yearMonth, opts),
    enabled:
      assetRowId != null && assetRowId > 0 && /^\d{4}-\d{2}$/.test(yearMonth),
  });
};
