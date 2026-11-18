import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Sparkles, Telescope } from "lucide-react";
import { Button } from "@/shared/ds/button";
import { Card } from "@/shared/ds/card";
import { Skeleton } from "@/shared/ds/skeleton";
import { cn } from "@/shared/lib/cn";
import { useWeekdayFit, WeekdayProbe } from "@/shared/ds/date-picker";
import { WEEK_GRID_TEXT } from "@/shared/ds/week-grid-text";
import {
  monthGrid,
  visibleWeekIndex,
  type CalendarDay,
} from "@/shared/lib/groo/calendar-grid";
import { MonthHead } from "@/shared/ui/groo/month-head";
import {
  LedgerDrop,
  LedgerHead,
  LedgerSub,
  LedgerSumBtn,
  LedgerTotal,
} from "@/shared/ui/groo/ledger";
import type { ConstellationToday } from "@/features/constellation";
import { NightSkyHero } from "@/widgets/constellation";
import type { useTodoCellMarks } from "../todo-cell-marks";

type Marks = ReturnType<typeof useTodoCellMarks>;

/**
 * 태블릿(768 ~ 1279) 원장 카드 (I-10 28 — 틀은 가계부 요약 카드와 같다, I-07 27).
 * 달 이동("2026년 10월") → "오늘 할 일 3개" + [밤하늘] → 별빛 한 줄 → 주 달력(칸 아래 표시 포함) → 펼침 "월 달력".
 * 거르기 단추는 두지 않는다 — 아래 칩 줄이 같은 일을 한다. [밤하늘] 과 월 달력은 하나만 펼친다.
 * 접힌 주 = 오늘이 든 주(다른 달이면 첫 주), 펼치면 그 달 6주. 날을 누르면 목록이 그 날로 옮긴다.
 */
export function TodoLedgerCard({
  month,
  onPickMonth,
  today,
  marks,
  loading,
  todayLeft,
  constellationToday,
  doneToday,
  lit,
  goal,
  skyDone,
  conName,
  openNightSky,
  openReport,
  onPickDay,
}: {
  month: string;
  onPickMonth: (month: string) => void;
  today: string;
  marks: Marks;
  loading: boolean;
  todayLeft: number;
  constellationToday: ConstellationToday | undefined;
  doneToday: number;
  lit: number;
  goal: number;
  skyDone: boolean;
  conName: string;
  openNightSky: () => void;
  openReport: () => void;
  onPickDay: (ds: string) => void;
}) {
  const { t } = useTranslation("todo");
  const [expanded, setExpanded] = useState(false);
  const [skyOpen, setSkyOpen] = useState(false);
  const weeks = monthGrid(month);
  const shown = expanded
    ? weeks
    : [weeks[visibleWeekIndex(weeks, today)] ?? []];
  // 7일 띠 요일 머리 — ds 요일 글(영어 두 글자, 칸에 들지 않으면 한 글자 — groo-design #256) · 200% 상한(#258)
  const weekdayRef = useRef<HTMLDivElement>(null);
  const weekday = useWeekdayFit(weekdayRef);
  return (
    <Card data-slot="todo-ledger-card" className="px-x6 pb-x6 pt-x4">
      <MonthHead month={month} onChange={onPickMonth} />
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
      <div
        role="group"
        id="todo-week-strip"
        aria-label={t("tdm.monthCalendar")}
        className="mt-x4 flex flex-col gap-y-x1"
      >
        <div ref={weekdayRef} aria-hidden className="grid grid-cols-7 gap-x1_5">
          {weekday.weekdays.map((d, i) => (
            <span
              key={i}
              className={cn(
                "relative whitespace-nowrap text-center text-fg-neutral-subtle",
                WEEK_GRID_TEXT.t3,
                i === 0 && "text-fg-critical",
                i === 6 && "text-fg-brand",
              )}
            >
              {d}
              <WeekdayProbe>{weekday.full[i]}</WeekdayProbe>
            </span>
          ))}
        </div>
        {shown.map((w, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-x1_5">
            {w.map((c) => (
              <WeekCell
                key={c.ds}
                c={c}
                today={today}
                marks={marks}
                loading={loading}
                onPick={onPickDay}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="-mb-x3 mt-x1 flex justify-center">
        <Button
          variant="ghost"
          size="medium"
          layout="iconOnly"
          aria-label={t("tdm.monthCalendar")}
          aria-expanded={expanded}
          aria-controls="todo-week-strip"
          onClick={() => {
            setExpanded((v) => !v);
            setSkyOpen(false);
          }}
        >
          <ChevronDown
            className={cn("transition-transform", expanded && "rotate-180")}
          />
        </Button>
      </div>
    </Card>
  );
}

function WeekCell({
  c,
  today,
  marks,
  loading,
  onPick,
}: {
  c: CalendarDay;
  today: string;
  marks: Marks;
  loading: boolean;
  onPick: (ds: string) => void;
}) {
  const isToday = c.inMonth && c.ds === today;
  const future = c.inMonth && c.ds > today;
  const num = (
    <span
      className={cn(
        // 날짜 숫자는 200% 에서 멈춘다(WEEK_GRID_TEXT — groo-design #258)
        "num flex min-h-x9 min-w-x9 items-center justify-center rounded-full px-x1 font-bold",
        WEEK_GRID_TEXT.t5,
        (future || !c.inMonth) && "font-medium text-fg-neutral-subtle",
        c.inMonth && !future && "text-fg-neutral",
        isToday && "bg-bg-neutral-weak",
      )}
    >
      {c.day}
    </span>
  );
  // 칸 아래 표시 — 높이 15 · t1 11 / 15, 장식(낭독은 칸 이름)
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
  const base = "flex min-h-11 flex-col items-center justify-center gap-x1";
  if (!c.inMonth)
    return (
      <span aria-hidden className={base}>
        {num}
        {mark}
      </span>
    );
  return (
    <button
      type="button"
      aria-label={marks.name(c.ds)}
      data-day={c.ds}
      className={cn(
        base,
        "cursor-pointer rounded-r2 border-0 bg-transparent p-0 hover:bg-bg-layer-default-pressed focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-stroke-focus-ring",
      )}
      onClick={() => onPick(c.ds)}
    >
      {num}
      {mark}
    </button>
  );
}
