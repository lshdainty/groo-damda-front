import { MonthTitle } from "@/shared/ui/groo/month-title";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FunnelX,
  ListChecks,
  Pencil,
  SlidersHorizontal,
  Sparkles,
  Telescope,
  Trash2,
} from "lucide-react";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetFooter,
} from "@/shared/ds/bottom-sheet";
import { Button } from "@/shared/ds/button";
import { List, ListSwitchItem } from "@/shared/ds/list";
import { NotificationBadge } from "@/shared/ds/notification-badge";
import { ResultSection } from "@/shared/ds/result-section";
import { Skeleton } from "@/shared/ds/skeleton";
import { SwipeActions } from "@/shared/ds/swipe-actions";
import { useDsText } from "@/shared/ds/i18n";
import { formatMonthDayDow } from "@/shared/lib/date";
import {
  LedgerBar,
  LedgerCalendar,
  LedgerCell,
  LedgerCellAmt,
  LedgerCellNum,
  LedgerDayDate,
  LedgerDayGroup,
  LedgerDayHead,
  LedgerDaySum,
  LedgerDivider,
  LedgerDow,
  LedgerDrop,
  LedgerExpand,
  LedgerHead,
  LedgerKeep,
  LedgerList,
  LedgerMonthNav,
  LedgerNavBtn,
  LedgerPin,
  LedgerShell,
  LedgerSub,
  LedgerSumBtn,
  LedgerTotal,
  LedgerWeek,
} from "@/shared/ui/groo/ledger";
import { useLedgerScroll } from "@/shared/ui/groo/use-ledger-scroll";
import {
  constellationColorVar,
  constellationName,
  type ConstellationToday,
  type SkyDay,
} from "@/features/constellation";
import { NightSkyHero } from "@/widgets/constellation";
import type { Todo } from "@/entities/todo";
import {
  NO_DUE,
  groupByDay,
  isDone,
  isFilterActive,
  monthTodos as selectMonthTodos,
  relKindOf,
  tagOf,
  todayISO,
  todayLeft as countTodayLeft,
  type TodoFilter,
} from "@/pages/todo/model/todo-ledger";
import { TodoRow } from "./TodoRow";
import { TodoDayGroupSkeleton } from "./todo-skeleton";
import { useTodoCellMarks } from "./todo-cell-marks";
import { TodoDeleteConfirm } from "./TodoDeleteConfirm";
import {
  TodoFilterSection,
  TodoPrioFilterBody,
  TodoTagFilterBody,
} from "./TodoFilterBody";

/** 묶음 사이 16 · 끝까지 선 바로 아래 첫 묶음 8 — 실제 날짜 묶음과 같은 값 */
const SKELETON_GROUP = "[&:not(:first-child)]:mt-x4 first:mt-x2";

const PAD = (n: number) => String(n).padStart(2, "0");

/**
 * 폰 할 일 원장(I-10 B ~ E) — 흰 면 하나. 위에서 아래로: 원장 머리(달 이동 + 거르기 · 오늘 할 일 + [밤하늘] · 별빛 한 줄 ·
 * 주 달력 + 월 달력 펼침) → 끝까지 선 → 날짜 묶음(목록 제목 + 줄). 머리는 Scroll Auto Hide 로 내리면 숨고 올리면 드러난다.
 * 띠 · 카드를 두지 않는다 — 머리가 목록을 조절하므로 한 덩어리다(틈 0 + 끝까지 선).
 * 달 · 거르기 셈은 `model/todo-ledger.ts`(데스크톱과 같은 모델) 가 한다.
 */
export function TodoMobileLedger({
  todos,
  tags,
  constellationToday,
  sky,
  doneToday,
  pinTop,
  loading = false,
  failed = false,
  onRetry,
  onToggle,
  holdIds,
  onRowClick,
  onEdit,
  onDelete,
  openNightSky,
  openReport,
}: {
  todos: Todo[];
  tags: string[];
  constellationToday: ConstellationToday | undefined;
  sky: SkyDay[];
  doneToday: number;
  /** 상단 바 높이(px) — 머리가 붙는 자리 · 스크롤 보정 */
  pinTop: number;
  /** 처음 받는 중 — 틀은 그리고 데이터 자리만 Skeleton */
  loading?: boolean;
  /** 받지 못했다 — 틀은 그리고 목록 자리에 Result Section failure */
  failed?: boolean;
  onRetry?: () => void;
  onToggle: (todo: Todo) => void;
  /** 방금 완료를 누른 항목 — '완료 숨기기' 를 켰어도, 정렬에서도 잠깐은 자리를 지킨다(QA #29) */
  holdIds?: ReadonlySet<number>;
  onRowClick: (todo: Todo) => void;
  /** 밀기 '수정' — 상세 footer 의 수정과 같은 목적지 */
  onEdit: (todo: Todo) => void;
  /** 밀기 · 상세 '삭제' — 확인 뒤 부른다. Promise 가 끝날 때까지 확인창이 로딩을 문다 */
  onDelete: (todo: Todo) => Promise<unknown>;
  openNightSky: () => void;
  openReport: () => void;
}) {
  const { t, i18n } = useTranslation("todo");
  const { t: tc } = useTranslation("common");
  const dsT = useDsText();
  const today = useMemo(() => todayISO(), []);
  const en = !i18n.language.startsWith("ko");

  const [ym, setYm] = useState(today.slice(0, 7));
  const [expanded, setExpanded] = useState(false);
  const [skyOpen, setSkyOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState<TodoFilter>({
    tags: [],
    prios: [],
    hideDone: false,
  });
  const [askDelete, setAskDelete] = useState<Todo | null>(null);
  const filterActive = isFilterActive(filter);

  const {
    rootRef,
    pinRef,
    selected,
    setSelected,
    lock,
    scrollToDay,
    scrollToTop,
  } = useLedgerScroll({ initialSelected: today });

  // 월 + 필터 적용 목록. 마감일 없는 할 일은 월과 무관하게 꼬리 묶음으로 낸다(모델 — 데스크톱과 같은 셈).
  const monthTodos = selectMonthTodos(todos, ym, filter, holdIds);
  const byDay = groupByDay(monthTodos, holdIds);
  const dayKeys = [...byDay.keys()].sort();
  const todayLeft = countTodayLeft(todos, today);
  const hasUntagged = todos.some((td) => tagOf(td) === "");

  const skyByDate = useMemo(() => new Map(sky.map((d) => [d.date, d])), [sky]);

  // 캘린더 주 구성
  const weeks = useMemo(() => {
    const [y = 0, m = 1] = ym.split("-").map(Number);
    const firstDow = new Date(y, m - 1, 1).getDay();
    const dim = new Date(y, m, 0).getDate();
    const cells: ({ d: number; ds: string } | null)[] = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= dim; d++) cells.push({ d, ds: `${ym}-${PAD(d)}` });
    while (cells.length % 7) cells.push(null);
    const out: (typeof cells)[] = [];
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
    return out;
  }, [ym]);
  let selWeek = weeks.findIndex((w) => w.some((c) => c && c.ds === selected));
  if (selWeek < 0)
    selWeek = weeks.findIndex((w) => w.some((c) => c && c.ds === today));
  if (selWeek < 0) selWeek = 0;

  const pickMonth = (next: string) => {
    setYm(next);
    setSelected(today.startsWith(next) ? today : null);
    setExpanded(false);
    lock(800);
    scrollToTop();
  };

  const dowLabels = Array.from({ length: 7 }, (_, i) =>
    new Date(2026, 1, i + 1).toLocaleDateString(en ? "en-US" : "ko-KR", {
      weekday: en ? "short" : "narrow",
    }),
  );

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

  // 칸 표시(장식) · 칸 이름 · 오늘의 남은 수 — 판정은 모델, 그리기와 이름은 데스크톱과 같은 부품
  const marks = useTodoCellMarks({
    today,
    byDay,
    skyByDate,
    skyDone,
    todayColor,
  });
  const cellMark = marks.glyph;
  const cellName = marks.name;
  const isTodayLeft = marks.isTodayLeft;

  const relOf = (d: string): string | null => {
    const kind = relKindOf(d, today);
    if (kind === "today") return t("tdm.relToday");
    if (kind === "tomorrow") return t("tdm.relTomorrow");
    if (kind === "yesterday") return t("tdm.relYesterday");
    return null;
  };

  const monthNum = Number(ym.split("-")[1]);

  let body;
  if (failed) {
    body = (
      <ResultSection
        kind="failure"
        title={t("tdm.loadFailed")}
        description={t("tdm.loadFailedDesc")}
        primaryAction={{ label: dsT("common.retry"), onClick: onRetry }}
      />
    );
  } else if (loading) {
    body = (
      <div aria-busy="true">
        <TodoDayGroupSkeleton rows={3} className={SKELETON_GROUP} />
        <TodoDayGroupSkeleton rows={2} className={SKELETON_GROUP} />
      </div>
    );
  } else if (monthTodos.length === 0) {
    body = filterActive ? (
      <ResultSection
        icon={<FunnelX />}
        title={t("tdm.emptyFilter")}
        description={t("tdm.emptyFilterDesc")}
      />
    ) : (
      <ResultSection
        icon={<ListChecks />}
        title={t("tdm.emptyMonth", { month: monthNum })}
        description={t("tdm.emptyMonthDesc")}
      />
    );
  } else {
    body = dayKeys.map((d) => {
      const items = byDay.get(d)!;
      const doneN = items.filter(isDone).length;
      const noDue = d === NO_DUE;
      return (
        <LedgerDayGroup
          key={d}
          day={noDue ? undefined : d}
          // 할 일 폰은 묶음 머리 위 16 · 끝까지 선 바로 아래 첫 묶음 8(가계부 폰은 12 / 4 — 그림대로 짠다)
          className="[&_[data-slot=list-header]]:mt-x4 [&:first-child_[data-slot=list-header]]:mt-x2"
        >
          <LedgerDayHead gutter>
            <LedgerDayDate relative={noDue ? null : relOf(d)}>
              {noDue ? t("tdm.noDue") : formatMonthDayDow(d)}
            </LedgerDayDate>
            <LedgerDaySum className="whitespace-nowrap">
              {t("tdm.doneRatio", { done: doneN, total: items.length })}
            </LedgerDaySum>
          </LedgerDayHead>
          <div>
            {items.map((td) => (
              <SwipeActions
                key={td.rowId}
                rowLabel={td.title}
                enabled
                actions={[
                  {
                    label: tc("edit"),
                    icon: <Pencil />,
                    kind: "primary",
                    onSelect: () => onEdit(td),
                  },
                  {
                    label: tc("delete"),
                    icon: <Trash2 />,
                    kind: "destructive",
                    onSelect: () => setAskDelete(td),
                  },
                ]}
              >
                <List>
                  <TodoRow
                    todo={td}
                    today={today}
                    onToggle={onToggle}
                    onOpen={onRowClick}
                  />
                </List>
              </SwipeActions>
            ))}
          </div>
        </LedgerDayGroup>
      );
    });
  }

  return (
    <LedgerShell ref={rootRef}>
      {/* 머리 — 월 이동 줄 · 주 달력은 늘 남고, 오늘 상태 · 별빛 · 밤하늘만 내리면 숨는다(가계부 원장과 같은 부품) */}
      <LedgerBar top={pinTop}>
        {/* 월 네비 + 거르기 */}
        <LedgerMonthNav>
          <MonthTitle month={ym} onChange={pickMonth} className="text-t6" />
          {/* 조건이 걸렸다는 표시는 알림 점 하나 — 개수 숫자 · 켜짐 틴트를 두지 않는다(사용자 결정 10-23) */}
          <LedgerNavBtn
            className="ml-auto"
            onClick={() => setFilterOpen(true)}
            aria-label={filterActive ? t("tdm.filterOn") : t("tdm.filter")}
          >
            <NotificationBadge aria-hidden visible={filterActive}>
              <SlidersHorizontal />
            </NotificationBadge>
          </LedgerNavBtn>
        </LedgerMonthNav>
      </LedgerBar>
      <LedgerPin ref={pinRef} top={pinTop}>
        {/* 오늘 상태 + 별빛 한 줄 + [밤하늘] */}
        <LedgerHead>
          <div className="min-w-0 flex-auto">
            <LedgerTotal>
              {loading ? (
                <Skeleton text="t9" className="w-40" />
              ) : todayLeft > 0 ? (
                t("tdm.todayLeft", { count: todayLeft })
              ) : (
                t("tdm.todayDone")
              )}
            </LedgerTotal>
            {constellationToday && (
              <LedgerSub className="break-keep [overflow-wrap:break-word]">
                {skyDone
                  ? t("tdm.insightDone", {
                      name: conName,
                      streak: constellationToday.streak,
                    })
                  : t("tdm.insightProgress", {
                      lit,
                      goal,
                      left: goal - lit,
                      name: conName,
                    })}
              </LedgerSub>
            )}
          </div>
          <LedgerSumBtn
            aria-expanded={skyOpen}
            onClick={() => {
              setSkyOpen((v) => !v);
              setExpanded(false);
            }}
          >
            <Sparkles />
            {t("tdm.nightSky")}
          </LedgerSumBtn>
        </LedgerHead>
        {skyOpen && constellationToday && (
          <LedgerDrop>
            <NightSkyHero today={constellationToday} doneToday={doneToday} />
            <div className="mt-x2 flex flex-wrap gap-x2">
              <Button
                variant="neutralOutline"
                size="small"
                className="flex-1"
                onClick={openReport}
              >
                <Telescope />
                {t("tdm.report")}
              </Button>
              <Button
                variant="neutralOutline"
                size="small"
                className="flex-1"
                onClick={openNightSky}
              >
                <Sparkles />
                {t("tdm.collection")}
              </Button>
            </div>
          </LedgerDrop>
        )}

        {/* 캘린더 — 접힘: 선택 주 1줄 / 펼침: 월 전체. 숨지 않고 남는다(Keep) */}
        <LedgerKeep>
          <LedgerCalendar>
            <LedgerDow labels={dowLabels} />
            {(expanded ? weeks : [weeks[selWeek] ?? []]).map((w, wi) => (
              <LedgerWeek key={wi}>
                {w.map((c, i) => {
                  if (!c) return <LedgerCell key={`e${i}`} empty />;
                  const isSel = c.ds === selected;
                  const items = byDay.get(c.ds);
                  return (
                    <LedgerCell
                      key={c.ds}
                      selected={isSel}
                      aria-label={cellName(c.ds)}
                      onClick={() => {
                        setSelected(c.ds);
                        if (items) {
                          lock(800);
                          scrollToDay(c.ds);
                        }
                      }}
                    >
                      <LedgerCellNum
                        selected={isSel}
                        dow={i % 7}
                        future={c.ds > today}
                        today={c.ds === today}
                      >
                        {c.d}
                      </LedgerCellNum>
                      {/* 표시는 장식 — 뜻은 칸 이름이 읽는다. 높이 15(t1 줄 높이) */}
                      <LedgerCellAmt
                        aria-hidden
                        className={
                          isTodayLeft(c.ds)
                            ? "inline-flex min-h-[1lh] items-center justify-center font-bold text-fg-brand"
                            : "inline-flex min-h-[1lh] items-center justify-center font-normal text-fg-neutral-subtle"
                        }
                      >
                        {loading ? (
                          <Skeleton text="t1" className="w-x8" />
                        ) : (
                          cellMark(c.ds)
                        )}
                      </LedgerCellAmt>
                    </LedgerCell>
                  );
                })}
              </LedgerWeek>
            ))}
            <LedgerExpand
              expanded={expanded}
              onClick={() => {
                setExpanded((v) => !v);
                setSkyOpen(false);
              }}
              aria-label={t("tdm.monthCalendar")}
            />
          </LedgerCalendar>
          <LedgerDivider />
        </LedgerKeep>
      </LedgerPin>

      {/* 날짜 묶음 — 목록 제목 + 줄(줄이 제 좌우 24 를 갖는다) */}
      <LedgerList className="-mx-global-gutter">{body}</LedgerList>

      {askDelete && (
        <TodoDeleteConfirm
          name={askDelete.title}
          onConfirm={() => onDelete(askDelete)}
          onClose={() => setAskDelete(null)}
        />
      )}

      {/* 거르기 시트 — 고르기(바깥 누름 · 끌어내림으로 닫힌다). 바꾸는 즉시 목록에 걸린다 */}
      <BottomSheet open={filterOpen} onOpenChange={setFilterOpen}>
        <BottomSheetContent title={t("tdm.filter")}>
          <BottomSheetBody>
            <div className="flex flex-col gap-x6 pb-x2">
              <TodoFilterSection label={t("tag")}>
                <TodoTagFilterBody
                  tags={tags}
                  hasUntagged={hasUntagged}
                  value={filter.tags}
                  onChange={(next) => setFilter((f) => ({ ...f, tags: next }))}
                />
              </TodoFilterSection>
              <TodoFilterSection label={t("form.priority")}>
                <TodoPrioFilterBody
                  value={filter.prios}
                  onChange={(next) => setFilter((f) => ({ ...f, prios: next }))}
                />
              </TodoFilterSection>
              <List className="-mx-x6 w-[calc(100%+var(--spacing-x12))]">
                <ListSwitchItem
                  title={t("tdm.hideDone")}
                  checked={filter.hideDone}
                  onCheckedChange={(on) =>
                    setFilter((f) => ({ ...f, hideDone: on }))
                  }
                />
              </List>
            </div>
          </BottomSheetBody>
          <BottomSheetFooter>
            <Button
              variant="neutralWeak"
              disabled={!filterActive}
              onClick={() =>
                setFilter({ tags: [], prios: [], hideDone: false })
              }
            >
              {t("tdm.reset")}
            </Button>
            <Button onClick={() => setFilterOpen(false)}>
              {t("tdm.apply")}
            </Button>
          </BottomSheetFooter>
        </BottomSheetContent>
      </BottomSheet>
    </LedgerShell>
  );
}
