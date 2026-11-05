/**
 * 관심목록 한 벌 — 그룹 탭 상태 + 별 토글.
 *
 * **관심목록은 증권사와 무관하다.** 서버 `stock_watch` 는 종목 마스터(`stock_master_row_id`)를
 * 가리킬 뿐 증권사 컬럼이 없고, `/api/v1/stock-watch/**` 도 증권사를 묻지 않는다. 그래서
 * 토스에서 등록한 종목이 나무 화면에도 그대로 별로 보인다 — 사용자 한 명의 관심 종목이지
 * 계좌별 목록이 아니다.
 *
 * 토스 페이지 안에 있던 로직을 그대로 끌어냈다. 나무가 자기 토글을 새로 쓰면 "첫 등록이면
 * 기본 그룹부터 만든다" · "해제는 전 그룹에서 지운다" 같은 규칙이 한쪽에만 남는다.
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnackbar } from "@/shared/ds/snackbar";
import { useConfirmFail } from "@/shared/lib/confirm-fail";
import type { WatchGroup } from "../api/stockApi";
import { isHardError } from "../lib/query-state";
import {
  findWatchEntries,
  useAddWatchItem,
  useCreateWatchGroup,
  useRemoveWatchItem,
  useWatchGroups,
} from "../api/watchlistApi";

export interface Watchlist {
  groups: WatchGroup[];
  /** 그룹 목록을 받았다. 아니면(로딩 · 실패) 별을 눌러도 아무것도 만들지 않는다 — 빈 목록으로 보고 기본 그룹을 새로 만들면 안 된다 */
  ready: boolean;
  /** 그룹 목록을 받지 못했고 받아 둔 값도 없다 */
  failed: boolean;
  retry: () => void;
  /** 지금 열린 그룹. 그룹이 하나도 없으면 null. */
  activeGroup: WatchGroup | null;
  activeGroupId: number | null;
  setActiveGroupId: (id: number) => void;
  /** 전 그룹을 합친 관심 종목 집합 — 별 판정용. */
  watchedSymbols: Set<string>;
  isWatched: (symbol: string) => boolean;
  /** 별 토글. 등록돼 있으면 전 그룹에서 빼고, 아니면 지금 그룹에 넣는다. */
  toggleWatch: (symbol: string, marketCode?: string, groupId?: number) => void;
}

export function useWatchlist(): Watchlist {
  const { t } = useTranslation("stocks");
  const watchQ = useWatchGroups();
  const groups = useMemo(() => watchQ.data ?? [], [watchQ.data]);

  // 열린 그룹은 **저장하지 않고 유도한다.** 사용자가 고른 것만 들고, 그게 없거나(첫 로드)
  // 사라졌으면(그룹 삭제) 첫 그룹으로 접는다. 예전엔 이펙트로 상태를 되돌려 맞췄는데,
  // 그러면 목록이 올 때마다 렌더가 한 번 더 돌고 "고른 값" 과 "실제 값" 이 한 프레임 어긋난다.
  const [pickedGroupId, setPickedGroupId] = useState<number | null>(null);
  const activeGroup =
    groups.find((g) => g.rowId === pickedGroupId) ?? groups[0] ?? null;
  const activeGroupId = activeGroup?.rowId ?? null;

  // 별을 누르는 순간 바뀌는 값 — 실패는 서버 원문 토스트 대신 스낵바 고정 글(요청은 silent)
  const snackbar = useSnackbar();
  const confirmFail = useConfirmFail();
  const createGroupMut = useCreateWatchGroup({ silent: true });
  const addItemMut = useAddWatchItem({ silent: true });
  const removeItemMut = useRemoveWatchItem();

  const watchedSymbols = useMemo(
    () => new Set(groups.flatMap((g) => g.items.map((i) => i.symbol))),
    [groups],
  );

  const ready = watchQ.data !== undefined;

  const toggleWatch = (
    symbol: string,
    marketCode?: string,
    pickedGroupId?: number,
  ) => {
    // 그룹 질의가 아직이거나 실패했으면 `groups` 는 빈 목록일 뿐이다 — "첫 관심 등록" 으로 읽어 기본 그룹을
    // 새로 만들면 이미 그룹이 있는 사용자에게 같은 이름 그룹이 하나 더 생긴다(검수 M3)
    if (!ready) {
      if (isHardError(watchQ)) {
        // 그룹 목록을 못 받은 채 누른 별 — 다시 받아 두고, 다시 시도는 별을 한 번 더 누르는 것이다
        snackbar.show({ message: t("watch.addFail"), tone: "critical" });
        void watchQ.refetch();
      }
      return;
    }
    const entries = findWatchEntries(groups, symbol);
    if (entries.length > 0) {
      // 별 해제 = 모든 그룹에서 제거 (기존 UX 유지)
      for (const e of entries) removeItemMut.mutate(e.item.rowId);
      return;
    }
    // 첫 관심 등록이면 기본 그룹부터 만든 뒤 넣는다. 그룹이 이미 만들어졌으면 다시 시도는 넣기만 다시 한다
    let groupId: number | undefined =
      groups.length === 0
        ? undefined
        : (pickedGroupId ?? activeGroupId ?? groups[0]!.rowId);
    const add = async () => {
      groupId ??= (
        await createGroupMut.mutateAsync(t("watch.defaultGroupName"))
      ).rowId;
      await addItemMut.mutateAsync({ groupId, symbol, marketCode });
    };
    add().catch(() => confirmFail({ message: t("watch.addFail"), retry: add }));
  };

  return {
    groups,
    ready,
    failed: isHardError(watchQ),
    retry: () => void watchQ.refetch(),
    activeGroup,
    activeGroupId,
    setActiveGroupId: setPickedGroupId,
    watchedSymbols,
    isWatched: (symbol: string) => watchedSymbols.has(symbol),
    toggleWatch,
  };
}
