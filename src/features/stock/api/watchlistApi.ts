/**
 * 증권 관심목록 react-query 훅 (서버 stock-watch — 게이트 없음, 로그인만).
 * 관심목록은 그룹(탭) + 소속 종목 구조. 종목 마스터 정보(이름·시장·통화)는 서버가 조인해 내려준다.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SilentOpts } from "@/shared/api";
import { invalidateFor, stockKeys } from "@/shared/config";
import { stockApi, type WatchGroup } from "./stockApi";

export function useWatchGroups(enabled = true) {
  return useQuery({
    queryKey: stockKeys.watchGroups(),
    queryFn: () => stockApi.getWatchGroups(),
    enabled,
    retry: false,
    staleTime: 60_000,
  });
}

export function useCreateWatchGroup(opts?: SilentOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (groupName: string) =>
      stockApi.createWatchGroup(groupName, opts),
    onSuccess: () => invalidateFor(queryClient, "stock-watchlist"),
  });
}

export function useRenameWatchGroup(opts?: SilentOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      groupId,
      groupName,
    }: {
      groupId: number;
      groupName: string;
    }) => stockApi.renameWatchGroup(groupId, groupName, opts),
    onSuccess: () => invalidateFor(queryClient, "stock-watchlist"),
  });
}

export function useDeleteWatchGroup(opts?: SilentOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (groupId: number) => stockApi.deleteWatchGroup(groupId, opts),
    onSuccess: () => invalidateFor(queryClient, "stock-watchlist"),
  });
}

export function useAddWatchItem(opts?: SilentOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      groupId,
      symbol,
      marketCode,
    }: {
      groupId: number;
      symbol: string;
      marketCode?: string;
    }) => stockApi.addWatchItem(groupId, symbol, marketCode, opts),
    onSuccess: () => invalidateFor(queryClient, "stock-watchlist"),
  });
}

export function useRemoveWatchItem(opts?: SilentOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: number) => stockApi.removeWatchItem(itemId, opts),
    onSuccess: () => invalidateFor(queryClient, "stock-watchlist"),
  });
}

/** 전 그룹에서 심볼이 담긴 그룹/항목을 찾는다 (별 토글 판정·전체 해제용). */
export function findWatchEntries(
  groups: WatchGroup[] | undefined,
  symbol: string,
) {
  if (!groups) return [];
  return groups.flatMap((g) =>
    g.items
      .filter((i) => i.symbol === symbol)
      .map((i) => ({ group: g, item: i })),
  );
}
