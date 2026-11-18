import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/shared/ds/card";
import { Skeleton } from "@/shared/ds/skeleton";
import { cn } from "@/shared/lib/cn";
import { useWeekdayFit, WeekdayProbe } from "@/shared/ds/date-picker";
import { WEEK_GRID_TEXT } from "@/shared/ds/week-grid-text";
import { monthGrid, type CalendarDay } from "@/shared/lib/groo/calendar-grid";
import { MonthHead } from "@/shared/ui/groo/month-head";
import type { useTodoCellMarks } from "../todo-cell-marks";

type Marks = ReturnType<typeof useTodoCellMarks>;

/**
 * 작은 달력 카드 (1280 이상 왼쪽 칸, I-10 27 — 틀은 가계부 작은 달력과 같다, I-07 26).
 * 달 이동 · 요일 · 6주 42칸 · 범례 한 줄. 칸 아래 표시(남은 수 · ★ · 구름 · ✓)는 할 일 몫이고 그 달 전체를 센다 —
 * 오른쪽 목록에 거르기가 걸려도 달력은 그 날의 남은 수를 그대로 보인다. 날은 버튼이다 — 누르면 오른쪽 목록이 그 날 묶음으로 옮긴다
 * (할 일이 없는 날은 아무 일도 없다). 앞뒤 달 칸은 누르지 못한다. 고른 날 표시는 두지 않는다 — 오늘만 알약.
 */
export function TodoMiniCalendar({
  month,
  onPickMonth,
  today,
  marks,
  loading,
  hasItems,
  onPickDay,
}: {
  month: string;
  onPickMonth: (month: string) => void;
  today: string;
  marks: Marks;
  loading: boolean;
  /** 그 날에 할 일이 있는가 — 없는 날을 눌러도 아무 일도 없다는 것을 `data-has-data` 로 남긴다 */
  hasItems: (ds: string) => boolean;
  onPickDay: (ds: string) => void;
}) {
  const { t } = useTranslation("todo");
  const weeks = monthGrid(month);
  // 요일 머리 — ds 요일 글(영어 두 글자, 칸에 들지 않으면 한 글자 — groo-design #256) · 200% 상한(#258)
  const weekdayRef = useRef<HTMLDivElement>(null);
  const weekday = useWeekdayFit(weekdayRef);
  return (
    <Card
      data-slot="todo-mini-calendar"
      aria-label={t("tdm.miniCalendar")}
      className="px-x6 pb-x3 pt-x3"
    >
      <MonthHead month={month} onChange={onPickMonth} />
      <div
        ref={weekdayRef}
        role="group"
        aria-label={t("tdm.miniCalendar")}
        className="mt-x2 grid grid-cols-7"
      >
        {weekday.weekdays.map((d, i) => (
          <span
            key={i}
            aria-hidden
            className={cn(
              "relative whitespace-nowrap pb-x1_5 text-center text-fg-neutral-subtle",
              WEEK_GRID_TEXT.t2,
            )}
          >
            {d}
            <WeekdayProbe>{weekday.full[i]}</WeekdayProbe>
          </span>
        ))}
        {weeks.flat().map((c) => (
          <DayCell
            key={c.ds}
            c={c}
            today={today}
            marks={marks}
            loading={loading}
            hasData={hasItems(c.ds)}
            onPick={onPickDay}
          />
        ))}
      </div>
      <p className="mb-x1 mt-x2 text-t2 text-fg-neutral-subtle">
        {t("tdm.legend")}
      </p>
    </Card>
  );
}

function DayCell({
  c,
  today,
  marks,
  loading,
  hasData,
  onPick,
}: {
  c: CalendarDay;
  today: string;
  marks: Marks;
  loading: boolean;
  hasData: boolean;
  onPick: (ds: string) => void;
}) {
  const isToday = c.inMonth && c.ds === today;
  const future = c.inMonth && c.ds > today;
  const num = (
    <span
      className={cn(
        // 날짜 숫자는 200% 에서 멈춘다(WEEK_GRID_TEXT — groo-design #258)
        "num flex min-h-x6 min-w-x7 items-center justify-center rounded-r3 px-x1 font-medium",
        WEEK_GRID_TEXT.t3,
        !c.inMonth && "font-normal text-fg-neutral-subtle",
        future && "text-fg-neutral-subtle",
        c.inMonth && !future && "text-fg-neutral",
        isToday && "bg-bg-neutral-weak font-bold",
      )}
    >
      {c.day}
    </span>
  );
  // 표시 자리 — 높이 15(t1 줄 높이)로 칸마다 같다. 장식이라 낭독기는 칸 이름만 읽는다
  const mark = (
    <span
      aria-hidden
      data-slot="todo-cell-mark"
      className={cn(
        "num inline-flex min-h-[1lh] max-w-full items-center justify-center text-t1",
        c.inMonth && marks.isTodayLeft(c.ds)
          ? "font-bold text-fg-brand"
          : "font-normal text-fg-neutral-subtle",
      )}
    >
      {c.inMonth &&
        (loading ? <Skeleton text="t1" className="w-x8" /> : marks.glyph(c.ds))}
    </span>
  );
  const base =
    "flex min-h-11 flex-col items-center justify-center gap-px border-0 bg-transparent p-0";
  if (!c.inMonth) {
    return (
      <span aria-hidden className={base}>
        {num}
        {mark}
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-label={marks.name(c.ds)}
      data-day={c.ds}
      data-has-data={hasData ? "" : undefined}
      className={cn(
        base,
        "cursor-pointer rounded-r2 hover:bg-bg-layer-default-pressed focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-stroke-focus-ring",
      )}
      onClick={() => onPick(c.ds)}
    >
      {num}
      {mark}
    </button>
  );
}
