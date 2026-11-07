import { endOfDay, format, isSameMonth, parseISO, startOfDay } from "date-fns";
import { CalendarX2 } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { ListHeader } from "@/shared/ds/list";
import { ResultSection } from "@/shared/ds/result-section";
import { formatMonthDayDow } from "@/shared/lib/date";
import { useCalendar } from "@/widgets/calendar/model/calendar-context";
import { DayEventList } from "@/widgets/calendar/ui/day-event-list";

import type { IEvent } from "@/widgets/calendar/model/interfaces";

interface IProps {
  singleDayEvents: IEvent[];
  multiDayEvents: IEvent[];
  onEventClick?: (event: IEvent, el: HTMLElement) => void;
}

/** 그 날과 겹치는 일정 — 시작 시각 차례(공휴일을 먼저 두는 것은 DayEventList 가 한다) */
const overlapping = (events: IEvent[], date: Date): IEvent[] => {
  const ds = startOfDay(date);
  const de = endOfDay(date);
  return events
    .filter((e) => parseISO(e.startDate) <= de && parseISO(e.endDate) >= ds)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
};

/**
 * 목록 보기 (I-wrap-b1 γ) — 일정이 있는 날마다 List 머리(원장 · 검색과 같은 `formatMonthDayDow`: 올해 "10월 5일 (월)",
 * 다른 해 "2025년 10월 5일 (일)") + 그날 패널과 같은 줄 목록(`DayEventList`)을 쓴다. 빈 상태는 Result Section empty.
 * 여러 날 일정은 하루 패널과 같이 날마다 같은 줄이 나온다(줄 글에 "종일 · 10월 10일 ~ 12일" 처럼 기간이 들어간다).
 */
const CalendarAgendaView = ({
  singleDayEvents,
  multiDayEvents,
  onEventClick,
}: IProps) => {
  const { t } = useTranslation("calendar");
  const { selectedDate } = useCalendar();

  const days = useMemo(() => {
    const all = [...singleDayEvents, ...multiDayEvents];
    const keys = new Map<string, Date>();
    const add = (d: Date) => {
      if (!isSameMonth(d, selectedDate)) return;
      keys.set(format(d, "yyyy-MM-dd"), startOfDay(d));
    };

    singleDayEvents.forEach((e) => add(parseISO(e.startDate)));
    multiDayEvents.forEach((e) => {
      const last = endOfDay(parseISO(e.endDate));
      for (
        let d = startOfDay(parseISO(e.startDate));
        d <= last;
        d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
      ) {
        add(d);
      }
    });

    return [...keys.values()]
      .sort((a, b) => a.getTime() - b.getTime())
      .map((date) => ({ date, events: overlapping(all, date) }));
  }, [singleDayEvents, multiDayEvents, selectedDate]);

  return (
    <div data-slot="agenda-view" className="h-full w-full overflow-y-auto">
      {days.length === 0 ? (
        <ResultSection
          size="medium"
          icon={<CalendarX2 />}
          title={t("agenda.noEvents")}
          className="h-full"
        />
      ) : (
        <div className="flex flex-col gap-x3 pb-x4 pt-x2">
          {days.map(({ date, events }) => {
            const label = formatMonthDayDow(date);
            return (
              <section
                key={format(date, "yyyy-MM-dd")}
                data-slot="agenda-day"
                aria-label={label}
              >
                <ListHeader className="sticky top-0 z-10 bg-bg-layer-default">
                  {label}
                </ListHeader>
                <DayEventList
                  events={events}
                  label={label}
                  onTapEvent={(e, el) => onEventClick?.(e, el)}
                />
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

export { CalendarAgendaView };
