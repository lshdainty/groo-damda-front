import type { SkyDay } from "@/features/constellation";
import type { Todo, TodoPriority } from "@/entities/todo";

/*
 * 할 일 모델 — 폰 원장 · 데스크톱 · 태블릿이 같은 셈을 쓴다(I-10 4). 달 + 거르기를 적용한 목록, 날짜 묶음, 오늘 남은 수,
 * 달력 칸 표시의 판정(무엇을 그릴지만 — 그리기는 화면), 상대 날. 화면은 이 파일의 값만 읽는다.
 */

export type PrioKey = TodoPriority;
export const PRIO_KEYS: PrioKey[] = ["HIGH", "MEDIUM", "LOW"];

/** 마감일 없는 묶음의 열쇠 — 정렬하면 맨 뒤로 간다 */
export const NO_DUE = "9999-99-99";

const PAD = (n: number) => String(n).padStart(2, "0");

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${PAD(d.getMonth() + 1)}-${PAD(d.getDate())}`;
}

export function isDone(t: Todo): boolean {
  return t.status === "COMPLETED";
}
/** dueDate(날짜 또는 datetime) → 'YYYY-MM-DD'. 없으면 null */
export function dueKey(due: string | null | undefined): string | null {
  return due ? due.slice(0, 10) : null;
}
export function dueOf(t: Todo): string | null {
  return dueKey(t.dueDate);
}

/** 두 'YYYY-MM-DD' 사이 일수 차이 (b − a) */
export function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}
export function tagOf(t: Todo): string {
  return t.category || "";
}

/** 거르기 상태 — 폰 시트 · 데스크톱 칩이 같은 상태를 쓴다 */
export interface TodoFilter {
  tags: string[];
  prios: PrioKey[];
  hideDone: boolean;
}
export const EMPTY_FILTER: TodoFilter = {
  tags: [],
  prios: [],
  hideDone: false,
};
export function isFilterActive(f: TodoFilter): boolean {
  return f.tags.length > 0 || f.prios.length > 0 || f.hideDone;
}

/**
 * 월 + 거르기를 적용한 목록. 마감일 없는 할 일은 월과 무관하게 꼬리 묶음으로 낸다.
 * `held` — 방금 완료를 누른 행은 '완료 숨기기' 를 켰어도 잠깐 남는다 — 빠지면 아래 행이 그 자리로 올라와 두 번째 탭이
 * 다른 할 일을 완료시킨다(QA #29).
 */
export function monthTodos(
  todos: Todo[],
  ym: string,
  filter: TodoFilter,
  held?: ReadonlySet<number>,
): Todo[] {
  const pass = (td: Todo) =>
    (filter.tags.length === 0 || filter.tags.includes(tagOf(td))) &&
    (filter.prios.length === 0 || filter.prios.includes(td.priority)) &&
    (!filter.hideDone || !isDone(td) || (held?.has(td.rowId) ?? false));
  return todos.filter((td) => {
    const due = dueOf(td);
    return (due ? due.startsWith(ym) : true) && pass(td);
  });
}

const PRIO_RANK: Record<PrioKey, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

/**
 * 묶음 안 차례(I-10 15) — 남은 일 위 · 끝낸 일 아래, 각각 우선순위(중요 → 보통 → 여유), 같으면 서버 차례(안정 정렬).
 * `held` — 방금 끝냄을 누른 줄은 누르기 전 자리 차례로 센다(QA #29): 낙관 갱신이 상태를 뒤집어도 잠깐 그 자리에 남아야
 * 아래 줄이 올라와 두 번째 누름을 대신 받지 않는다. 붙들기가 풀리면(700ms) 제 차례로 내려간다.
 */
export function sortDayItems(
  items: Todo[],
  held?: ReadonlySet<number>,
): Todo[] {
  const doneForOrder = (td: Todo) =>
    held?.has(td.rowId) ? !isDone(td) : isDone(td);
  return items
    .map((td, i) => ({ td, i }))
    .sort((a, b) => {
      const da = doneForOrder(a.td) ? 1 : 0;
      const db = doneForOrder(b.td) ? 1 : 0;
      if (da !== db) return da - db;
      const pa = PRIO_RANK[a.td.priority];
      const pb = PRIO_RANK[b.td.priority];
      if (pa !== pb) return pa - pb;
      return a.i - b.i;
    })
    .map((x) => x.td);
}

/** 날짜 묶음 — 열쇠는 'YYYY-MM-DD' 또는 NO_DUE. 묶음 안은 sortDayItems 차례 */
export function groupByDay(
  list: Todo[],
  held?: ReadonlySet<number>,
): Map<string, Todo[]> {
  const map = new Map<string, Todo[]>();
  for (const td of list) {
    const k = dueOf(td) ?? NO_DUE;
    const arr = map.get(k);
    if (arr) arr.push(td);
    else map.set(k, [td]);
  }
  for (const [k, arr] of map) map.set(k, sortDayItems(arr, held));
  return map;
}

/** 오늘 남은(안 끝낸) 할 일 수 */
export function todayLeft(todos: Todo[], today: string): number {
  return todos.filter((td) => !isDone(td) && dueOf(td) === today).length;
}

/** 달력 칸 아래 표시의 판정 — 오늘: 수집 ★ 또는 남은 수 · 지난 날: 키운 별자리 ★ · 놓친 날 구름 · 남은 수 · 다 끝냄 ✓ · 오는 날: 남은 수 */
export type CellMark =
  | { kind: "collected" }
  | { kind: "grown"; colorKey: string }
  | { kind: "missed" }
  | { kind: "left"; count: number; today: boolean }
  | { kind: "done" }
  | null;

export function cellMarkOf(
  ds: string,
  today: string,
  byDay: ReadonlyMap<string, Todo[]>,
  skyByDate: ReadonlyMap<string, SkyDay>,
  skyDone: boolean,
): CellMark {
  const items = byDay.get(ds);
  const left = items ? items.filter((td) => !isDone(td)).length : 0;
  if (ds === today) {
    if (skyDone) return { kind: "collected" };
    return left > 0 ? { kind: "left", count: left, today: true } : null;
  }
  const log = skyByDate.get(ds);
  if (log?.status === "GROWN" && log.colorKey)
    return { kind: "grown", colorKey: log.colorKey };
  if (log?.status === "WITHERED") return { kind: "missed" };
  if (items)
    return left > 0
      ? { kind: "left", count: left, today: false }
      : { kind: "done" };
  return null;
}

/** 상대 날 — 오늘 · 내일 · 어제만 */
export function relKindOf(
  d: string,
  today: string,
): "today" | "tomorrow" | "yesterday" | null {
  const diff = dayDiff(today, d);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  return null;
}

/**
 * 남은(안 끝낸) 할 일의 태그별 수(I-10 32) — 태그 이름 차례(설정 태그 → 할 일에만 남은 이름)대로, 태그 없는 할 일은 맨 뒤에 `tag: ""` 로.
 * 남은 것이 0 인 태그는 줄을 내지 않는다. 달 · 거르기와 상관없이 전체를 센다 — 우선순위별 수(`remainByPrio`)와 합이 같다.
 */
export function remainByTag(
  todos: readonly Todo[],
  tagNames: readonly string[],
): { tag: string; count: number }[] {
  const open = todos.filter((td) => !isDone(td));
  const rows = tagNames
    .map((tag) => ({
      tag,
      count: open.filter((td) => tagOf(td) === tag).length,
    }))
    .filter((r) => r.count > 0);
  const none = open.filter((td) => tagOf(td) === "").length;
  return none > 0 ? [...rows, { tag: "", count: none }] : rows;
}

/** 남은(안 끝낸) 할 일의 우선순위별 수 — 셋 모두 늘 낸다(0 이어도). 달 · 거르기와 상관없이 전체 */
export function remainByPrio(todos: readonly Todo[]): Record<PrioKey, number> {
  const out: Record<PrioKey, number> = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const td of todos) if (!isDone(td)) out[td.priority] += 1;
  return out;
}
