import {
  addDays,
  areIntervalsOverlapping,
  differenceInDays,
  differenceInMinutes,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  parseISO,
  startOfWeek,
} from "date-fns";
import { enUS, ko } from "date-fns/locale";
import { useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useCalendar } from "@/widgets/calendar/model/calendar-context";
import {
  eventBadgeTone,
  getEventBlockStyle,
  getVisibleHours,
  groupEvents,
  isWorkingHour,
} from "@/widgets/calendar/lib/helpers";
import { eventLineDetail } from "@/widgets/calendar/lib/event-line";
import { cn } from "@/shared/lib/cn";
import { formatMonthDayDow } from "@/shared/lib/date";
import { dsText } from "@/shared/ds/i18n";

import type { IEvent } from "@/widgets/calendar/model/interfaces";

interface IProps {
  singleDayEvents: IEvent[];
  multiDayEvents: IEvent[];
  onEventClick?: (event: IEvent, el: HTMLElement) => void;
}

// ---- 일정 칩 — 월 칩과 같은 색(eventBadgeTone: 바탕 chart-{hue}-weak · 글 chart-{hue}-contrast) ---- //

/**
 * 누르는 일정 칩. button 이고 이름은 "10월 26일 (월) · 제목 · 시간 · 캘린더 …"(날짜 규칙 + 그날 패널 줄의 설명과 같은 글)이다.
 * 안 글은 보이는 만큼만(제목 · 시각)이라 칩이 좁아도 이름은 온전하다.
 */
function EventChipButton({
  event,
  day,
  onEventClick,
  className,
  style,
  part,
  children,
}: {
  event: IEvent;
  /** 칩이 놓인 날 — 이름 맨 앞에 붙는다(주 격자에서는 어느 날 일정인지가 이름에 있어야 한다) */
  day: Date;
  onEventClick?: (event: IEvent, el: HTMLElement) => void;
  /** 이어지는 일정의 조각 자리(첫 · 사이 · 끝 · 하나) */
  part?: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const { t, i18n } = useTranslation("calendar");
  const tone = eventBadgeTone(event);
  return (
    <button
      type="button"
      aria-label={`${formatMonthDayDow(day)} · ${event.title} · ${eventLineDetail(event, t, i18n.language)}`}
      data-slot="week-chip"
      data-part={part}
      className={cn(
        "block cursor-pointer select-none overflow-hidden whitespace-nowrap rounded-sm text-left text-t2 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus-ring",
        className,
      )}
      style={{ background: tone.bg, color: tone.fg, ...style }}
      onClick={(e) => onEventClick?.(event, e.currentTarget)}
    >
      {children}
    </button>
  );
}

// ---- Multi-day events row for week view ---- //

/** 주 안으로 잘라 낸 여러 날짜 이벤트 — 시작·끝 칸 번호를 함께 든다. */
type ProcessedEvent = IEvent & {
  adjustedStart: Date;
  adjustedEnd: Date;
  startIndex: number;
  endIndex: number;
};

/** 겹치지 않는 것끼리 같은 줄에 눕힌다 — 줄 수를 최소로. */
function packIntoRows(events: ProcessedEvent[]): ProcessedEvent[][] {
  const rows: ProcessedEvent[][] = [];
  for (const event of events) {
    let rowIndex = rows.findIndex((row) =>
      row.every(
        (e) => e.endIndex < event.startIndex || e.startIndex > event.endIndex,
      ),
    );
    if (rowIndex === -1) {
      rowIndex = rows.length;
      rows.push([]);
    }
    rows[rowIndex]!.push(event);
  }
  return rows;
}

const WeekViewMultiDayEventsRow = ({
  selectedDate,
  multiDayEvents,
  onEventClick,
}: {
  selectedDate: Date;
  multiDayEvents: IEvent[];
  onEventClick?: (event: IEvent, el: HTMLElement) => void;
}) => {
  const weekStart = startOfWeek(selectedDate);
  const weekEnd = endOfWeek(selectedDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // 메모이제이션은 컴파일러에 맡긴다. 손으로 적으면 `weekStart`/`weekEnd` 가
  // 의존성에 들어가는데 둘 다 렌더마다 새로 만들어지는 Date 라 어차피 매번
  // 무효화된다 — 컴파일러는 `selectedDate` 까지 거슬러 올라가 제대로 잡는다.
  const processedEvents: ProcessedEvent[] = multiDayEvents
    .map((event) => {
      const start = parseISO(event.startDate);
      const end = parseISO(event.endDate);
      const adjustedStart = isBefore(start, weekStart) ? weekStart : start;
      const adjustedEnd = isAfter(end, weekEnd) ? weekEnd : end;
      const startIndex = differenceInDays(adjustedStart, weekStart);
      const endIndex = differenceInDays(adjustedEnd, weekStart);

      return {
        ...event,
        adjustedStart,
        adjustedEnd,
        startIndex,
        endIndex,
      };
    })
    .sort((a, b) => {
      const startDiff = a.adjustedStart.getTime() - b.adjustedStart.getTime();
      if (startDiff !== 0) return startDiff;
      return b.endIndex - b.startIndex - (a.endIndex - a.startIndex);
    });

  const eventRows = packIntoRows(processedEvents);

  const hasEventsInWeek = multiDayEvents.some((event) => {
    const start = parseISO(event.startDate);
    const end = parseISO(event.endDate);
    return (
      (start >= weekStart && start <= weekEnd) ||
      (end >= weekStart && end <= weekEnd) ||
      (start <= weekStart && end >= weekEnd)
    );
  });

  if (!hasEventsInWeek) return null;

  return (
    <div className="flex overflow-hidden">
      <div className="w-[72px] border-b border-stroke-neutral-subtle" />
      <div className="grid flex-1 grid-cols-7 divide-x divide-stroke-neutral-subtle border-b border-l border-stroke-neutral-subtle">
        {weekDays.map((day, dayIndex) => (
          <div
            key={day.toISOString()}
            className="flex h-full flex-col gap-x1 py-x1"
          >
            {eventRows.map((row, rowIndex) => {
              const event = row.find(
                (e) => e.startIndex <= dayIndex && e.endIndex >= dayIndex,
              );

              if (!event) {
                return (
                  <div key={`${rowIndex}-${dayIndex}`} className="h-[26px]" />
                );
              }

              let position: "first" | "middle" | "last" | "none" = "none";

              if (
                dayIndex === event.startIndex &&
                dayIndex === event.endIndex
              ) {
                position = "none";
              } else if (dayIndex === event.startIndex) {
                position = "first";
              } else if (dayIndex === event.endIndex) {
                position = "last";
              } else {
                position = "middle";
              }

              const positionClasses = {
                // 멀티데이 바: 시작/종료만 round, 중간 full-bleed 연속. divide-x(1px) 는 -ml-px 로 bridge.
                // 가장자리 바깥 여백 4px. 이어지는 조각은 모서리가 각져야 하므로 둥근 모서리는 기본(rounded-sm) 뒤에 rounded-r-none 같은 방향 클래스로 덮는다
                first: "relative z-10 ml-[4px] mr-0 rounded-r-none",
                middle: "relative z-10 mx-0 -ml-px rounded-none",
                last: "relative z-10 -ml-px mr-[4px] rounded-l-none",
                none: "mx-[4px]",
              };

              const showText = ["first", "none"].includes(position);
              const tone = eventBadgeTone(event);
              const bar = cn(
                "flex h-[26px] items-center px-x2",
                positionClasses[position],
              );

              // 제목 조각 하나만 button — 이어지는 나머지 조각은 보이기만 하고(누르면 같은 일정) 보조 기술에서는 숨긴다
              return showText ? (
                <EventChipButton
                  key={`${event.id}-${dayIndex}`}
                  event={event}
                  day={day}
                  onEventClick={onEventClick}
                  part={position}
                  className={bar}
                >
                  <span className="truncate">{event.title}</span>
                </EventChipButton>
              ) : (
                <div
                  key={`${event.id}-${dayIndex}`}
                  aria-hidden
                  data-part={position}
                  data-slot="week-chip"
                  className={cn("cursor-pointer select-none rounded-sm", bar)}
                  style={{ background: tone.bg, color: tone.fg }}
                  onClick={(e) => onEventClick?.(event, e.currentTarget)}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

// ---- Timeline indicator ---- //

const CalendarTimeline = ({
  firstVisibleHour,
  lastVisibleHour,
}: {
  firstVisibleHour: number;
  lastVisibleHour: number;
}) => {
  const { i18n } = useTranslation();
  const locale = i18n.language.startsWith("ko") ? ko : enUS;
  const timeFormat = i18n.language.startsWith("ko") ? "a h:mm" : "h:mm a";

  const now = new Date();
  const currentHour = now.getHours();

  if (currentHour < firstVisibleHour || currentHour >= lastVisibleHour)
    return null;

  const minutes = now.getHours() * 60 + now.getMinutes();
  const visibleStartMinutes = firstVisibleHour * 60;
  const visibleEndMinutes = lastVisibleHour * 60;
  const visibleRangeMinutes = visibleEndMinutes - visibleStartMinutes;
  const position =
    ((minutes - visibleStartMinutes) / visibleRangeMinutes) * 100;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-50 border-t border-stroke-brand-solid"
      style={{ top: `${position}%` }}
    >
      <div className="absolute left-0 top-0 size-[12px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-bg-brand-solid" />
      <div className="absolute -left-[72px] flex w-[64px] -translate-y-1/2 justify-end bg-bg-layer-default pr-x1 text-t2 font-medium text-fg-brand">
        {format(now, timeFormat, { locale })}
      </div>
    </div>
  );
};

// ---- Event block for time grid ---- //

const EventBlock = ({
  event,
  day,
  onEventClick,
}: {
  event: IEvent;
  day: Date;
  onEventClick?: (event: IEvent, el: HTMLElement) => void;
}) => {
  const { i18n } = useTranslation();
  const locale = i18n.language.startsWith("ko") ? ko : enUS;
  const timeFormat = i18n.language.startsWith("ko") ? "a h:mm" : "h:mm a";

  const start = parseISO(event.startDate);
  const end = parseISO(event.endDate);
  const durationInMinutes = differenceInMinutes(end, start);
  const heightInPixels = (durationInMinutes / 60) * 96 - 8;
  const tone = eventBadgeTone(event);

  return (
    <EventChipButton
      event={event}
      day={day}
      onEventClick={onEventClick}
      part="block"
      className={cn(
        "flex w-full flex-col gap-x0_5 px-x2 py-x1_5",
        durationInMinutes < 35 && "justify-center py-0",
      )}
      style={{ height: `${heightInPixels}px` }}
    >
      <span className="flex items-center gap-x1_5 truncate">
        <svg width="8" height="8" viewBox="0 0 8 8" className="shrink-0">
          <circle cx="4" cy="4" r="4" fill={tone.color} />
        </svg>
        <span className="truncate font-bold">{event.title}</span>
      </span>

      {durationInMinutes > 25 && (
        <span className="block">
          {format(start, timeFormat, { locale })}
          {dsText("datePicker.rangeSeparator")}
          {format(end, timeFormat, { locale })}
        </span>
      )}
    </EventChipButton>
  );
};

// ---- Main week view ---- //

const CalendarWeekView = ({
  singleDayEvents,
  multiDayEvents,
  onEventClick,
}: IProps) => {
  const { i18n } = useTranslation();
  const { selectedDate, workingHours, visibleHours } = useCalendar();

  const locale = i18n.language.startsWith("ko") ? ko : enUS;
  // 날짜 · 시각 규칙 — 시각에 0 을 붙이지 않는다("오전 1시")
  const hourFormat = i18n.language.startsWith("ko") ? "a h시" : "h a";
  const { hours, earliestEventHour, latestEventHour } = getVisibleHours(
    visibleHours,
    singleDayEvents,
  );

  const weekStart = startOfWeek(selectedDate, { locale });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // 처음 스크롤 — 0시부터 열면 빈 칸만 보인다. 그 주 가장 이른 일정과 오전 8시 중 이른 쪽에서 연다
  const scrollRef = useRef<HTMLDivElement>(null);
  const firstEventHour = singleDayEvents.reduce(
    (min, e) => Math.min(min, parseISO(e.startDate).getHours()),
    8,
  );
  const startHour = Math.min(firstEventHour, 8);
  const firstHour = hours[0] ?? 0;
  const weekKey = weekStart.getTime();
  useLayoutEffect(() => {
    const el = scrollRef.current;
    // 시간 라벨이 칸선보다 12px 위에 있어 그만큼 더 올린다(글자가 요일 머리에 가리지 않게). 0 아래로는 가지 않는다
    if (el) el.scrollTop = Math.max(0, (startHour - firstHour) * 96 - 12);
  }, [weekKey, startHour, firstHour]);

  return (
    <div className="h-full w-full">
      <div className="flex h-full flex-col">
        <div>
          <WeekViewMultiDayEventsRow
            selectedDate={selectedDate}
            multiDayEvents={multiDayEvents}
            onEventClick={onEventClick}
          />

          {/* Week header */}
          <div className="relative z-20 flex border-b border-stroke-neutral-subtle">
            <div className="w-[72px]" />
            <div className="grid flex-1 grid-cols-7 divide-x divide-stroke-neutral-subtle border-l border-stroke-neutral-subtle">
              {weekDays.map((day, index) => {
                const dayOfWeek = day.getDay();
                const isSunday = dayOfWeek === 0;
                const isSaturday = dayOfWeek === 6;
                const textColor = isSunday
                  ? "text-fg-critical"
                  : isSaturday
                    ? "text-fg-brand"
                    : "text-fg-neutral";

                return (
                  <div
                    key={index}
                    className="py-x2 text-center text-t2 font-medium"
                  >
                    <div className={textColor}>
                      {format(day, "EE", { locale })}{" "}
                      <span className="ml-x1 font-bold">
                        {format(day, "d")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="flex overflow-hidden">
            {/* Hours column */}
            <div className="relative w-[72px]">
              {hours.map((hour, index) => (
                <div key={hour} className="relative" style={{ height: "96px" }}>
                  <div className="absolute -top-[12px] right-x2 flex h-[24px] items-center">
                    {index !== 0 && (
                      <span className="text-t2 text-fg-neutral-subtle">
                        {format(
                          new Date().setHours(hour, 0, 0, 0),
                          hourFormat,
                          { locale },
                        )}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Week grid */}
            <div className="relative flex-1 border-l border-stroke-neutral-subtle">
              <div className="grid grid-cols-7 divide-x divide-stroke-neutral-subtle">
                {weekDays.map((day, dayIndex) => {
                  const dayEvents = singleDayEvents.filter(
                    (event) =>
                      isSameDay(parseISO(event.startDate), day) ||
                      isSameDay(parseISO(event.endDate), day),
                  );
                  const groupedEvents = groupEvents(dayEvents);

                  return (
                    <div key={dayIndex} className="relative">
                      {hours.map((hour, index) => {
                        const isDisabled = !isWorkingHour(hour, workingHours);

                        return (
                          <div
                            key={hour}
                            className={cn(
                              "relative",
                              isDisabled && "bg-bg-neutral-weak/30",
                            )}
                            style={{ height: "96px" }}
                          >
                            {index !== 0 && (
                              <div className="pointer-events-none absolute inset-x-0 top-0 border-b border-stroke-neutral-subtle" />
                            )}
                            <div className="pointer-events-none absolute inset-x-0 top-1/2 border-b border-dashed border-stroke-neutral-subtle" />
                          </div>
                        );
                      })}

                      {/* Tab 차례는 겹침 묶음이 아니라 시작 시각 순 — 놓는 자리는 style 이 정한다 */}
                      {groupedEvents
                        .flatMap((group, groupIndex) =>
                          group.map((event) => ({ event, groupIndex })),
                        )
                        .sort(
                          (a, b) =>
                            parseISO(a.event.startDate).getTime() -
                            parseISO(b.event.startDate).getTime(),
                        )
                        .map(({ event, groupIndex }) => {
                          let style = getEventBlockStyle(
                            event,
                            day,
                            groupIndex,
                            groupedEvents.length,
                            { from: earliestEventHour, to: latestEventHour },
                          );
                          const hasOverlap = groupedEvents.some(
                            (otherGroup, otherIndex) =>
                              otherIndex !== groupIndex &&
                              otherGroup.some((otherEvent) =>
                                areIntervalsOverlapping(
                                  {
                                    start: parseISO(event.startDate),
                                    end: parseISO(event.endDate),
                                  },
                                  {
                                    start: parseISO(otherEvent.startDate),
                                    end: parseISO(otherEvent.endDate),
                                  },
                                ),
                              ),
                          );

                          if (!hasOverlap)
                            style = { ...style, width: "100%", left: "0%" };

                          return (
                            <div
                              key={event.id}
                              className="absolute p-x1"
                              style={style}
                            >
                              <EventBlock
                                event={event}
                                day={day}
                                onEventClick={onEventClick}
                              />
                            </div>
                          );
                        })}
                    </div>
                  );
                })}
              </div>

              <CalendarTimeline
                firstVisibleHour={earliestEventHour}
                lastVisibleHour={latestEventHour}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export { CalendarWeekView };
