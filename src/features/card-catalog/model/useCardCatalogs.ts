import {
  useQuery,
  useInfiniteQuery,
  keepPreviousData,
} from "@tanstack/react-query";
import { cardKeys } from "@/shared/config";
import { cardCatalogApi } from "../api/cardCatalogApi";
import type { CardCatalogSearchParams } from "@/entities/card";

export const useCardCatalogs = (
  params?: CardCatalogSearchParams,
  options?: { enabled?: boolean; silent?: boolean },
) => {
  return useQuery({
    queryKey: cardKeys.catalogs(params),
    queryFn: () => cardCatalogApi.search(params, { silent: options?.silent }),
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
};

/**
 * 모바일 인피니티 스크롤용 — page 단위로 누적 로드.
 * getNextPageParam: meta.last 면 종료, 아니면 다음 page 번호.
 */
export const useInfiniteCardCatalogs = (
  params?: Omit<CardCatalogSearchParams, "page">,
  options?: { enabled?: boolean; silent?: boolean },
) => {
  return useInfiniteQuery({
    queryKey: cardKeys.catalogsInfinite(params),
    queryFn: ({ pageParam }) =>
      cardCatalogApi.search(
        { ...params, page: pageParam },
        { silent: options?.silent },
      ),
    initialPageParam: 0,
    getNextPageParam: (last) =>
      last.meta.last ? undefined : last.meta.page + 1,
    enabled: options?.enabled ?? true,
  });
};

export const useCardCatalogDetail = (
  id: number | null,
  options?: { silent?: boolean },
) => {
  return useQuery({
    queryKey: cardKeys.catalogDetail(id ?? 0),
    queryFn: () => cardCatalogApi.getDetail(id!, { silent: options?.silent }),
    enabled: id != null && id > 0,
  });
};
