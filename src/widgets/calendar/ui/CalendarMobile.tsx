import { CalendarHeaderMobile } from "@/widgets/calendar/ui/header/calendar-header-mobile";
import { CalendarLoadFailed } from "@/widgets/calendar/ui/calendar-load-failed";
import { EventDetailSurface } from "@/widgets/calendar/ui/event-detail/event-detail-surface";
import {
  CalendarMonthViewMobile,
  WeekdayRow,
} from "@/widgets/calendar/ui/month-view/calendar-month-view-mobile";
import { CalendarMonthViewMobileSkeleton } from "@/widgets/calendar/ui/month-view/calendar-month-view-mobile-skeleton";

import type { CalendarScreen } from "@/widgets/calendar/model/use-calendar-screen";

interface IProps {
  screen: CalendarScreen;
  isLoading: boolean;
  isFailed: boolean;
  onRetry: () => void;
}

/**
 * 폰(768 미만) 캘린더 — 달 줄 + 월 격자만. 날을 누르면 그날 시트가 뜨고, 일정을 누르면 같은 시트가 상세로 바뀐다
 * (목록 → 상세 → 수정 폼 — `EventDetailSurface`, I-09b 5 · 9).
 */
const CalendarMobile = ({ screen, isLoading, isFailed, onRetry }: IProps) => {
  const {
    singleDayEvents,
    multiDayEvents,
    dayDate,
    setDayDate,
    dayEvents,
    setCreatingDate,
    requestDelete,
  } = screen;

  return (
    <>
      {/* 달 줄 · 요일 줄은 고정 — 격자만 스크롤한다(처음부터 그린다, 불러오는 중에도) */}
      <div
        data-slot="calendar-month-head"
        className="sticky top-0 z-30 bg-bg-layer-default"
      >
        <CalendarHeaderMobile />
        <WeekdayRow />
      </div>

      {isLoading ? (
        <CalendarMonthViewMobileSkeleton />
      ) : isFailed ? (
        <CalendarLoadFailed onRetry={onRetry} />
      ) : (
        <CalendarMonthViewMobile
          singleDayEvents={singleDayEvents}
          multiDayEvents={multiDayEvents}
          onDayClick={setDayDate}
        />
      )}

      {/* 그날 시트 — 한 시트 안에서 목록 → 상세 → 수정 폼. 시트를 닫았다 다시 열지 않는다 */}
      {dayDate && (
        <EventDetailSurface
          listDate={dayDate}
          events={dayEvents}
          onClose={() => setDayDate(null)}
          onAdd={() => {
            setCreatingDate(dayDate);
            setDayDate(null);
          }}
          onRequestDelete={requestDelete}
        />
      )}
    </>
  );
};

export { CalendarMobile };
