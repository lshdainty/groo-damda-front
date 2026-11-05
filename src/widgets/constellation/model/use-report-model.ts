import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  constellationName,
  useConstellationCollection,
  useConstellationSky,
  useConstellationToday,
  type CollectionEntry,
} from "@/features/constellation";
import { useTodos } from "@/features/todo";
import type { Todo, TodoPriority } from "@/entities/todo";
import {
  PRIO_ORDER,
  REPORT_MAX_WEEKS_BACK,
  REPORT_SKY_DAYS,
  selAfterWeekMove,
  WEIGHT,
  addDays,
  doneKey,
  isoOf,
  mondayOf,
} from "../lib/week";

/**
 * 관측 리포트의 상태 · 셈 — 폰 흰 면(`ForestReportPage`)과 데스크톱 카드가 같은 값을 읽는다.
 * 주는 이번 주 · 지난주 둘뿐이고(Q3-B — 하늘 14일), 날을 고르면 그 아래 전부가 바뀐다.
 * 불러오는 중 · 실패는 `loading` · `failed` — 하늘 · 도감만 실패하면 오늘 값 · 할 일 몫으로 그린다(지난날 셈이 할 일 몫으로 떨어진다).
 */
export function useReportModel() {
  const { i18n } = useTranslation("constellation");
  const todayQ = useConstellationToday();
  const skyQ = useConstellationSky(REPORT_SKY_DAYS, { reference: true });
  const collectionQ = useConstellationCollection({ reference: true });
  const todosQ = useTodos();

  const todayISO = useMemo(() => isoOf(new Date()), []);
  const [sel, setSel] = useState(todayISO);

  const todos = useMemo(() => todosQ.data ?? [], [todosQ.data]);
  const sky = useMemo(() => skyQ.data ?? [], [skyQ.data]);
  const skyByDate = useMemo(() => new Map(sky.map((d) => [d.date, d])), [sky]);
  const entryByKey = useMemo(() => {
    const map = new Map<string, CollectionEntry>();
    collectionQ.data?.entries.forEach((entry) =>
      map.set(entry.constellation.constellationKey, entry),
    );
    return map;
  }, [collectionQ.data]);

  // 보는 주는 고른 날이 정한다 — 주를 넘기면 같은 요일이 고른 날이 된다(미래면 오늘)
  const weekStart = mondayOf(sel);
  const weekOffset = Math.round(
    (new Date(`${mondayOf(todayISO)}T00:00:00`).getTime() -
      new Date(`${weekStart}T00:00:00`).getTime()) /
      (7 * 86400000),
  );
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  // 일별 완료 브레이크다운(완료일 기준) + 못다 켠 별(그날 마감·미완료).
  const doneByDay = useMemo(() => {
    const map = new Map<string, Record<TodoPriority, number>>();
    for (const todo of todos) {
      const key = doneKey(todo);
      if (!key) continue;
      const rec = map.get(key) ?? { HIGH: 0, MEDIUM: 0, LOW: 0 };
      rec[todo.priority] += 1;
      map.set(key, rec);
    }
    return map;
  }, [todos]);
  const missedOf = (ds: string): Todo[] =>
    todos.filter(
      (td) =>
        td.status !== "COMPLETED" && (td.dueDate ?? "").slice(0, 10) === ds,
    );

  const ptsOf = (ds: string): number => {
    if (ds === todayISO) return todayQ.data?.points ?? 0;
    const skyDay = skyByDate.get(ds);
    if (skyDay) return skyDay.points;
    const done = doneByDay.get(ds);
    return done ? PRIO_ORDER.reduce((s, k) => s + done[k] * WEIGHT[k], 0) : 0;
  };

  const isToday = sel === todayISO;
  const selSky = skyByDate.get(sel);
  const selDone = doneByDay.get(sel) ?? { HIGH: 0, MEDIUM: 0, LOW: 0 };
  const doneCount = PRIO_ORDER.reduce((s, k) => s + selDone[k], 0);
  const pts = ptsOf(sel);
  const grownEntry =
    selSky?.status === "GROWN" && selSky.constellationKey
      ? (entryByKey.get(selSky.constellationKey) ?? null)
      : null;
  const goal = isToday
    ? (todayQ.data?.goal ?? 7)
    : (grownEntry?.constellation.starCount ?? todayQ.data?.goal ?? 7);
  const pct = Math.min(100, Math.round((pts / Math.max(1, goal)) * 100));
  const missed = missedOf(sel);
  const weekMax = Math.max(goal, ...days.map(ptsOf), 1);
  // 그날 메모로 모은 별빛 = 그날 별빛 − 할 일 몫(하늘 기록이 없는 날은 할 일 몫만)
  const memoOf = (ds: string): number => {
    const total = ds > todayISO ? 0 : ptsOf(ds);
    const done = doneByDay.get(ds);
    const parts = done
      ? PRIO_ORDER.reduce((s, k) => s + done[k] * WEIGHT[k], 0)
      : 0;
    return Math.max(0, total - parts);
  };

  const todayName = todayQ.data
    ? constellationName(todayQ.data.constellation, i18n.language)
    : "";
  const ko = i18n.language.startsWith("ko");
  const dowOf = (ds: string) =>
    new Date(`${ds}T00:00:00`).toLocaleDateString(ko ? "ko-KR" : "en-US", {
      weekday: "short",
    });
  /** 칸 이름 — "10월 22일 (목)" */
  const dayName = (ds: string) =>
    new Date(`${ds}T00:00:00`).toLocaleDateString(ko ? "ko-KR" : "en-US", {
      month: "long",
      day: "numeric",
      weekday: "short",
    });
  const [selY = "", selM = "", selD = ""] = sel.split("-");
  const dateLabel = `${selY.slice(2)}.${selM}.${selD} ${dowOf(sel)}`;
  const rangeLabel = `${weekStart.split("-").join(".")} ~ ${(days[6] ?? weekStart).split("-").join(".")}`;
  const asOf = new Date().toLocaleTimeString(ko ? "ko-KR" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return {
    todayQ,
    todosQ,
    todayISO,
    weekOffset,
    canPrev: weekOffset < REPORT_MAX_WEEKS_BACK,
    canNext: weekOffset > 0,
    prevWeek: () => setSel(selAfterWeekMove(sel, todayISO, "prev")),
    nextWeek: () => setSel(selAfterWeekMove(sel, todayISO, "next")),
    sel,
    setSel,
    days,
    isToday,
    selSky,
    selDone,
    doneCount,
    pts,
    goal,
    pct,
    missed,
    weekMax,
    ptsOf,
    memoOf,
    doneByDay,
    grownEntry,
    todayName,
    dowOf,
    dayName,
    dateLabel,
    rangeLabel,
    asOf,
    /** 오늘 하늘 · 할 일 목록을 아직 받는 중 — 틀(주 · 날 줄)은 그리고 데이터 자리만 스켈레톤 */
    loading: todayQ.isLoading || todosQ.isLoading,
    /** 오늘 하늘 또는 할 일 목록이 내용 없이 실패 — 하늘 · 도감 실패는 오늘 값으로 그린다 */
    failed:
      (todayQ.isError && !todayQ.data) || (todosQ.isError && !todosQ.data),
    retry: () => {
      void todayQ.refetch();
      void todosQ.refetch();
    },
  };
}

export type ReportModel = ReturnType<typeof useReportModel>;
