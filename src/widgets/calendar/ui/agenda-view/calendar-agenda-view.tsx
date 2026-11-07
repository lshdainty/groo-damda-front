import { endOfDay, format, isSameMonth, parseISO, startOfDay } from "date-fns";
import { enUS } from "date-fns/locale";
import { Calendar, FunnelX, Plus } from "lucide-react";
import { useId, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { ListHeader } from "@/shared/ds/list";
import { ResultSection } from "@/shared/ds/result-section";
import { formatMonthDayDow } from "@/shared/lib/date";
import { eventsOnDay } from "@/widgets/calendar/lib/helpers";
import { useCalendar } from "@/widgets/calendar/model/calendar-context";
import { DayEventList } from "@/widgets/calendar/ui/day-event-list";

import type { IEvent } from "@/widgets/calendar/model/interfaces";

interface IProps {
  singleDayEvents: IEvent[];
  multiDayEvents: IEvent[];
  onEventClick?: (event: IEvent, el: HTMLElement) => void;
  /**
   * 비어 있는 까닭 — "month": 이 달에 일정이 없다(일정을 추가하면 모인다). "filtered": 거르느라 0건(캘린더를 모두 숨겼거나,
   * 숨긴 캘린더에 이 달 일정이 있다) — 추가 버튼을 두지 않는다(result-section.md "비어 있는 까닭마다")
   */
  emptyReason?: "month" | "filtered";
  /** 일정 추가 — 머리의 [+ 일정 추가] 와 같은 일 */
  onAdd?: () => void;
}

/**
 * 목록 보기 (I-wrap-b1 γ) — 일정이 있는 날마다 List 머리(원장 · 검색과 같은 `formatMonthDayDow`: 올해 "10월 5일 (월)",
 * 다른 해 "2025년 10월 5일 (일)") + 그날 패널과 같은 줄 목록(`DayEventList`)을 쓴다. 빈 상태는 Result Section empty.
 * 여러 날 일정은 하루 패널과 같이 날마다 같은 줄이 나온다(줄 글에 "종일 · 10월 10일 ~ 12일" 처럼 기간이 들어간다).
 */
const CalendarAgendaView = ({
  singleDayEvents,
  multiDayEvents,
  onEventClick,
  emptyReason = "month",
  onAdd,
}: IProps) => {
  const { t, i18n } = useTranslation("calendar");
  const uid = useId();
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
      .map((date) => ({ date, events: eventsOnDay(all, date) }));
  }, [singleDayEvents, multiDayEvents, selectedDate]);

  const isKo = i18n.language.startsWith("ko");
  const month = isKo
    ? String(selectedDate.getMonth() + 1)
    : format(selectedDate, "MMMM", { locale: enUS });

  return (
    // 날짜 머리가 위에 붙어 있으니(sticky) 초점 줄이 머리 아래에 깔리지 않게 스크롤 여백을 머리 높이만큼 둔다
    <div
      data-slot="agenda-view"
      className="h-full w-full scroll-pt-[40px] overflow-y-auto"
    >
      {days.length === 0 ? (
        emptyReason === "filtered" ? (
          <ResultSection
            size="medium"
            icon={<FunnelX />}
            title={t("agenda.emptyFiltered")}
            description={t("agenda.emptyFilteredDesc")}
            className="h-full"
          />
        ) : (
          <ResultSection
            size="medium"
            icon={<Calendar />}
            title={t("agenda.emptyMonth", { month })}
            description={t("agenda.emptyMonthDesc")}
            primaryAction={
              onAdd
                ? { label: t("addEvent"), onClick: onAdd, icon: <Plus /> }
                : undefined
            }
            className="h-full"
          />
        )
      ) : (
        <div className="flex flex-col gap-x3 pb-x4 pt-x2">
          {days.map(({ date, events }) => {
            const label = formatMonthDayDow(date);
            const headId = `${uid}-${format(date, "yyyyMMdd")}`;
            return (
              <div key={format(date, "yyyy-MM-dd")} data-slot="agenda-day">
                <ListHeader
                  id={headId}
                  className="sticky top-0 z-10 bg-bg-layer-default"
                >
                  {label}
                </ListHeader>
                <DayEventList
                  events={events}
                  label={label}
                  labelledBy={headId}
                  onTapEvent={(e, el) => onEventClick?.(e, el)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export { CalendarAgendaView };
