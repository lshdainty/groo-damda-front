import { useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Button } from "@/shared/ds/button";
import { useWideSurface } from "@/shared/ds/overlay";
import { cn } from "@/shared/lib/cn";
import { ForestStrip } from "@/widgets/constellation";
import { PageHead } from "@/shared/ui/groo/page-head";
import {
  constellationColorVar,
  constellationName,
  type ConstellationToday,
  type SkyDay,
} from "@/features/constellation";
import type { Todo } from "@/entities/todo";
import {
  EMPTY_FILTER,
  groupByDay,
  isFilterActive,
  monthTodos as selectMonthTodos,
  relKindOf,
  tagOf,
  todayLeft as countTodayLeft,
  type TodoFilter,
} from "@/pages/todo/model/todo-ledger";
import { TodoFilterBar } from "./desktop/TodoFilterBar";
import { TodoLedgerCard } from "./desktop/TodoLedgerCard";
import { TodoListCard } from "./desktop/TodoListCard";
import { TodoMiniCalendar } from "./desktop/TodoMiniCalendar";
import { TodoRemainCard } from "./desktop/TodoRemainCard";
import { useStickyFit } from "@/shared/hooks/use-sticky-fit";
import { useTodoCellMarks } from "./todo-cell-marks";

/** 화면 틀 — 제목 줄(h1 "할 일" + 설명 + [할 일 추가]) 아래 24, 좌우 여백 32, 본문 폭은 768 ~ 1279 최대 720 · 1280 이상 최대 1040 가운데(medium 밀도) */
function Frame({
  onAdd,
  children,
}: {
  onAdd: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation("todo");
  return (
    <div
      data-slot="todo-desktop"
      className="px-[var(--layout-margin)] pb-screen-bottom pt-nav-to-title"
    >
      <div className="mx-auto w-full max-w-[var(--layout-max-low)] lg:max-w-[var(--layout-max-medium)]">
        <PageHead
          title={t("pageTitle")}
          description={t("subtitle")}
          actions={
            <Button variant="neutralOutline" size="small" onClick={onAdd}>
              <Plus />
              {t("newTodo")}
            </Button>
          }
          style={{ marginBottom: "var(--spacing-x6)" }}
        />
        {children}
      </div>
    </div>
  );
}

/**
 * 할 일 — 넓은 화면(I-10 4C). 1280 이상: 왼쪽 칸 336(작은 달력 · 밤하늘 줄 · 남은 할 일, 카드 사이 8) + 오른쪽 칸(거르기 칩 + 이번 달 날짜 묶음 목록),
 * 사이 24. 768 ~ 1279: 가운데 720 한 칸 — 원장 카드(달 · 오늘 할 일 · 주 달력) → 거르기 칩 → 목록. 같은 트리에서 폭만 다르다.
 * 달 · 거르기 상태는 하나라 작은 달력 · 원장 카드의 달 이동이 목록의 달을 바꾼다. 탭(오늘 · 이번 주 · 전체 · 완료)은 두지 않는다 —
 * 이번 주는 달력이, 완료는 거르기("완료 숨기기")가 맡는다. 줄을 누르면 상세, 제목 줄 [할 일 추가] 가 추가 — 같은 부품(ResponsiveDialog).
 */
export function TodoDesktop({
  todos,
  tagNames,
  tagColors,
  today,
  holdIds,
  loading,
  failed,
  onRetry,
  onToggle,
  onOpen,
  onAdd,
  sky,
  constellationToday,
  doneToday,
  openNightSky,
  openReport,
}: {
  todos: Todo[];
  tagNames: string[];
  /** 설정 태그 이름 → 색 이름 */
  tagColors: ReadonlyMap<string, string | null>;
  today: string;
  /** 방금 완료를 누른 항목 — 거르기 · 정렬에서 잠깐 자리를 지킨다(QA #29) */
  holdIds: ReadonlySet<number>;
  /** 처음 받는 중 — 틀은 그리고 데이터 자리만 Skeleton */
  loading: boolean;
  /** 받지 못했다 — 목록 자리에 Result Section failure */
  failed: boolean;
  onRetry: () => void;
  onToggle: (todo: Todo) => void;
  onOpen: (todo: Todo) => void;
  onAdd: () => void;
  /** 밤하늘 진입 줄(범위 밖 — 들어가는 길만) */
  sky: SkyDay[];
  constellationToday: ConstellationToday | undefined;
  doneToday: number;
  openNightSky: () => void;
  openReport: () => void;
}) {
  const { t, i18n } = useTranslation("todo");
  const wide = useWideSurface();
  const [ym, setYm] = useState(today.slice(0, 7));
  const [filter, setFilter] = useState<TodoFilter>(EMPTY_FILTER);
  const filtered = isFilterActive(filter);
  const listRef = useRef<HTMLDivElement | null>(null);

  // 목록 — 달 + 거르기. 마감일 없는 할 일은 달과 무관하게 꼬리 묶음(폰과 같은 모델)
  const listTodos = selectMonthTodos(todos, ym, filter, holdIds);
  const groups = [...groupByDay(listTodos, holdIds).entries()].sort(
    ([a], [b]) => a.localeCompare(b),
  );
  // 달력 표시 — 그 달 전체, 거르기와 상관없이(폰 주 달력은 거른 목록으로 센다 — 옮기기 범위)
  const calendarByDay = useMemo(
    () => groupByDay(selectMonthTodos(todos, ym, EMPTY_FILTER)),
    [todos, ym],
  );
  const todayLeft = countTodayLeft(todos, today);
  const hasUntagged = todos.some((td) => tagOf(td) === "");

  const skyByDate = useMemo(() => new Map(sky.map((d) => [d.date, d])), [sky]);
  const lit = constellationToday
    ? Math.min(constellationToday.points, constellationToday.goal)
    : 0;
  const goal = constellationToday?.goal ?? 7;
  const skyDone = constellationToday?.collected ?? false;
  const conName = constellationToday
    ? constellationName(constellationToday.constellation, i18n.language)
    : "";
  const todayColor = constellationToday
    ? constellationColorVar(constellationToday.constellation.colorKey)
    : "var(--fg-brand)";
  const marks = useTodoCellMarks({
    today,
    byDay: calendarByDay,
    skyByDate,
    skyDone,
    todayColor,
    compact: wide,
  });

  const relOf = (d: string): string | null => {
    const kind = relKindOf(d, today);
    if (kind === "today") return t("tdm.relToday");
    if (kind === "tomorrow") return t("tdm.relTomorrow");
    if (kind === "yesterday") return t("tdm.relYesterday");
    return null;
  };

  // 달을 고르면 쪽 넘김이다 — 목록 맨 위로 돌아간다
  const pickMonth = (m: string) => {
    setYm(m);
    document.getElementById("main")?.scrollTo?.({ top: 0 });
  };
  const scrollToDay = (ds: string) => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-ledger-day="${ds}"]`,
    );
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    el.scrollIntoView({
      block: "start",
      behavior: reduce?.matches ? "auto" : "smooth",
    });
  };

  const { ref: leftRef, sticky } = useStickyFit(wide);
  const monthNum = Number(ym.split("-")[1]);

  const filterBar = (
    <TodoFilterBar
      value={filter}
      onChange={setFilter}
      tags={tagNames}
      hasUntagged={hasUntagged}
      wide={wide}
    />
  );
  const listCard = (
    <TodoListCard
      groups={groups}
      today={today}
      loading={loading}
      failed={failed}
      onRetry={onRetry}
      filtered={filtered}
      monthNum={monthNum}
      relOf={relOf}
      onToggle={onToggle}
      onOpen={onOpen}
      listRef={listRef}
    />
  );

  return (
    <Frame onAdd={onAdd}>
      {wide ? (
        <div className="grid grid-cols-[336px_minmax(0,1fr)] items-start gap-x-x6">
          <div
            ref={leftRef}
            data-slot="todo-left"
            className={cn("flex flex-col gap-y-x2", sticky && "sticky top-x5")}
          >
            <TodoMiniCalendar
              month={ym}
              onPickMonth={pickMonth}
              today={today}
              marks={marks}
              loading={loading}
              hasItems={(ds) => calendarByDay.has(ds)}
              onPickDay={scrollToDay}
            />
            {constellationToday && (
              <ForestStrip today={constellationToday} onOpen={openNightSky} />
            )}
            <TodoRemainCard
              todos={todos}
              tagNames={tagNames}
              tagColors={tagColors}
              loading={loading}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-y-x3">
            {filterBar}
            {listCard}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-y-x4">
          <TodoLedgerCard
            month={ym}
            onPickMonth={pickMonth}
            today={today}
            marks={marks}
            loading={loading}
            todayLeft={todayLeft}
            constellationToday={constellationToday}
            doneToday={doneToday}
            lit={lit}
            goal={goal}
            skyDone={skyDone}
            conName={conName}
            openNightSky={openNightSky}
            openReport={openReport}
            onPickDay={scrollToDay}
          />
          <div className="flex min-w-0 flex-col gap-y-x3">
            {filterBar}
            {listCard}
          </div>
        </div>
      )}
    </Frame>
  );
}
