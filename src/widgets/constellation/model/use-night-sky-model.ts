import { useMemo } from "react";
import {
  useConstellationCollection,
  useConstellationSky,
  useConstellationToday,
} from "@/features/constellation";
import { useTodos } from "@/features/todo";
import { toLocalDateKey, todayLocalKey } from "@/shared/lib/date";

/**
 * 밤하늘 화면이 받는 것 — 오늘 · 나의 밤하늘(서버 기본 14일) · 도감 + 오늘 끝낸 할 일 수(하늘 그림 캡션).
 * 질의마다 불러오는 중 · 실패가 따로다 — 화면은 오늘이 실패하면 화면 전체 실패 하나, 나머지는 그 구역 안에서만 실패한다(I-11 12).
 */
export function useNightSkyModel() {
  const todayQ = useConstellationToday();
  const skyQ = useConstellationSky(14);
  const collectionQ = useConstellationCollection();
  const todosQ = useTodos(undefined, { reference: true });
  // completedAt 은 서버가 주는 `[UTC]` 라 로컬 날짜로 바꿔 비교한다(문자열을 자르면 KST 새벽에 전날로 빠진다)
  const doneToday = useMemo(() => {
    const today = todayLocalKey();
    return (todosQ.data ?? []).filter(
      (td) =>
        td.status === "COMPLETED" && toLocalDateKey(td.completedAt) === today,
    ).length;
  }, [todosQ.data]);
  return {
    todayQ,
    skyQ,
    collectionQ,
    doneToday,
    /** 오늘이 내용 없이 실패 — 화면 전체 실패 하나(세 질의 다시) */
    failed: todayQ.isError && !todayQ.data,
    retryAll: () => {
      void todayQ.refetch();
      void skyQ.refetch();
      void collectionQ.refetch();
    },
  };
}

export type NightSkyModel = ReturnType<typeof useNightSkyModel>;
