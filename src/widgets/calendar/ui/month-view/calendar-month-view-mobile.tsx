import { useRef } from "react";
import { getDay, isToday, parseISO, startOfDay } from "date-fns";
import { useTranslation } from "react-i18next";

import { useCalendar } from "@/widgets/calendar/model/calendar-context";
import {
  calculateMonthEventPositions,
  getCalendarCells,
} from "@/widgets/calendar/lib/helpers";
import { formatMonthDayWeekday, formatYearMonth } from "@/shared/lib/date";
import { cn } from "@/shared/lib/cn";
import { useWeekdayFit, WeekdayProbe } from "@/shared/ds/date-picker";
import { WEEK_GRID_TEXT } from "@/shared/ds/week-grid-text";

import type { IEvent } from "@/widgets/calendar/model/interfaces";
import { MonthChip, MonthChipSpacer, MonthMore } from "./month-chip";
import { buildMonthModel, type ChipMetrics } from "./month-model";
import { useChipMetrics } from "./use-chip-metrics";

/** 칸 103 − 위 2 − 날 숫자 26 − 아래 2 = 73, 칩 18 · "+N개" 16 · 사이 2 (글자 100% 의 값 — 실제로는 잰다) */
const PHONE_METRICS: ChipMetrics = { avail: 73, chip: 18, more: 16, gap: 2 };

/**
 * 요일 줄 — 높이 32 · t3 13/18 · fg-neutral-subtle, 일 fg-critical · 토 fg-brand (I-09 8). 글은 ds 요일 글 — 영어 두 글자 Su ~ Sa, 칸에 들지
 * 않으면 한 글자(groo-design #256) · 글자 크기 200% 상한(#258 — WEEK_GRID_TEXT). 줄을 바꾸지 않는다
 */
export function WeekdayRow() {
  const weekdayRef = useRef<HTMLDivElement>(null);
  const wd = useWeekdayFit(weekdayRef);
  return (
    <div
      ref={weekdayRef}
      aria-hidden
      data-slot="month-weekdays"
      className={cn(
        "grid h-x8 shrink-0 grid-cols-7 items-center px-[2px] text-center text-fg-neutral-subtle",
        WEEK_GRID_TEXT.t3,
      )}
    >
      {wd.weekdays.map((day, index) => (
        <span
          key={index}
          className={cn(
            "relative whitespace-nowrap",
            index === 0 && "text-fg-critical",
            index === 6 && "text-fg-brand",
          )}
        >
          {day}
          <WeekdayProbe>{wd.full[index]}</WeekdayProbe>
        </span>
      ))}
    </div>
  );
}

interface IProps {
  singleDayEvents: IEvent[];
  multiDayEvents: IEvent[];
  /** 칸을 누르면 그날 시트 */
  onDayClick: (date: Date) => void;
}

/**
 * 폰 월 격자 (I-09 8 · 9 · 10) — 요일 줄 + 칸 높이 103 고정(화면이 길면 화면이 스크롤), 칸 위 1px 선, 세로 선 없음.
 * 칸 전체가 그날 시트를 여는 누르는 자리 하나다 — 날 숫자 · 칩 · "+N개" 가 따로 Tab 에 서지 않는다.
 * 오늘은 옅은 원(`bg-neutral-weak`) + 700.
 */
export function CalendarMonthViewMobile({
  singleDayEvents,
  multiDayEvents,
  onDayClick,
}: IProps) {
  const { t } = useTranslation("calendar");
  const { selectedDate } = useCalendar();
  const { metrics, stackRef, chipRef, moreRef } = useChipMetrics(PHONE_METRICS);

  const all = [...multiDayEvents, ...singleDayEvents];

  const holidays = new Set<string>();
  for (const e of all)
    if (e.sourceType === "holiday")
      holidays.add(startOfDay(parseISO(e.startDate)).toISOString());

  const cells = getCalendarCells(selectedDate);
  const positions = calculateMonthEventPositions(
    [...multiDayEvents],
    [...singleDayEvents],
    selectedDate,
  );
  const model = buildMonthModel(cells, all, positions, metrics);

  return (
    <div data-slot="calendar-month-grid" className="flex flex-col">
      <div
        role="group"
        aria-label={formatYearMonth(selectedDate)}
        className="relative grid grid-cols-7 px-[2px]"
      >
        {/* 칩 · "+N개" 한 줄의 실제 높이를 재는 보이지 않는 견본 */}
        <div
          aria-hidden
          className="pointer-events-none invisible absolute left-0 top-0 w-full"
        >
          <div
            ref={chipRef}
            className="block min-h-x4_5 px-[3px] py-px text-t2 font-medium"
          >
            &nbsp;
          </div>
          <div ref={moreRef} className="text-t2 font-bold">
            &nbsp;
          </div>
        </div>
        {model.map(({ cell, slots, hidden, total }, index) => {
          const { date, day, currentMonth } = cell;
          const sunday = getDay(date) === 0;
          const saturday = getDay(date) === 6;
          const holiday = holidays.has(startOfDay(date).toISOString());
          const today = isToday(date);
          const dateLabel = formatMonthDayWeekday(date);
          return (
            <button
              key={date.toISOString()}
              type="button"
              aria-haspopup="dialog"
              aria-label={
                total > 0
                  ? t("monthView.cellLabel", { date: dateLabel, count: total })
                  : t("monthView.cellLabelEmpty", { date: dateLabel })
              }
              data-today={today ? "" : undefined}
              data-neighbor={currentMonth ? undefined : ""}
              onClick={() => onDayClick(date)}
              // 칸 높이 103 고정(I-09 9) · 위 1px 선 · 칩은 칸 폭을 꽉 채운다(좌우 1)
              className="relative flex h-[103px] min-w-0 select-none flex-col gap-x0_5 px-px pt-x0_5 text-start shadow-[inset_0_1px_0_0_var(--color-stroke-neutral-subtle)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-stroke-focus-ring"
            >
              <span
                aria-hidden
                data-slot="month-day-number"
                className={cn(
                  // 원 26(글자 14/19 + 7) — 글자가 커지면 원도 따라 커진다. 날짜 숫자는 200% 에서 멈춘다(WEEK_GRID_TEXT — 원도 같은 줄 높이로)
                  "grid size-[calc(min(var(--text-t4--line-height),calc(var(--text-t4-static--line-height)_*_2))_+_7px)] shrink-0 place-items-center self-center rounded-full font-medium tabular-nums",
                  WEEK_GRID_TEXT.t4,
                  !currentMonth
                    ? "text-fg-disabled"
                    : holiday || sunday
                      ? "text-fg-critical"
                      : saturday
                        ? "text-fg-brand"
                        : "text-fg-neutral",
                  today && "bg-bg-neutral-weak font-bold",
                )}
              >
                {day}
              </span>
              <div
                ref={index === 0 ? stackRef : undefined}
                className="flex min-h-0 flex-1 flex-col gap-x0_5"
              >
                {slots.map((slot, i) =>
                  slot ? (
                    <MonthChip key={i} slot={slot} density="phone" />
                  ) : (
                    <MonthChipSpacer key={i} density="phone" />
                  ),
                )}
                {hidden > 0 && <MonthMore count={hidden} density="phone" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
