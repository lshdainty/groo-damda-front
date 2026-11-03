import { Plus } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/shared/ds/button";
import { cn } from "@/shared/lib/cn";
import { Card } from "@/shared/ds/card";
import { useWideSurface } from "@/shared/ds/overlay";
import { PageHead } from "@/shared/ui/groo/page-head";
import { eventKey, findEvent } from "@/widgets/calendar/lib/event-key";
import { eventsOnDay } from "@/widgets/calendar/lib/helpers";
import { useCanEditEvent } from "@/widgets/calendar/model/use-can-edit-event";
import { dayKey } from "@/widgets/calendar/model/use-calendar-screen";
import { useCalendar } from "@/widgets/calendar/model/calendar-context";
import { DndProviderWrapper } from "@/widgets/calendar/ui/dnd/dnd-provider";
import { CalendarLoadFailed } from "@/widgets/calendar/ui/calendar-load-failed";
import { DayPanel } from "@/widgets/calendar/ui/day-panel";
import { EventDetailSurface } from "@/widgets/calendar/ui/event-detail/event-detail-surface";
import { CalendarAgendaView } from "@/widgets/calendar/ui/agenda-view/calendar-agenda-view";
import { CalendarAgendaViewSkeleton } from "@/widgets/calendar/ui/agenda-view/calendar-agenda-view-skeleton";
import { CalendarHeaderDesktop } from "@/widgets/calendar/ui/header/calendar-header-desktop";
import {
  CalendarMonthViewDesktop,
  WeekdayHead,
} from "@/widgets/calendar/ui/month-view/calendar-month-view-desktop";
import { CalendarMonthViewDesktopSkeleton } from "@/widgets/calendar/ui/month-view/calendar-month-view-desktop-skeleton";
import { CalendarDayView } from "@/widgets/calendar/ui/week-and-day-view/calendar-day-view";
import { CalendarDayViewSkeleton } from "@/widgets/calendar/ui/week-and-day-view/calendar-day-view-skeleton";
import { CalendarWeekView } from "@/widgets/calendar/ui/week-and-day-view/calendar-week-view";
import { CalendarWeekViewSkeleton } from "@/widgets/calendar/ui/week-and-day-view/calendar-week-view-skeleton";
import { CalendarYearView } from "@/widgets/calendar/ui/year-view/calendar-year-view";
import { CalendarYearViewSkeleton } from "@/widgets/calendar/ui/year-view/calendar-year-view-skeleton";

import type { CalendarScreen } from "@/widgets/calendar/model/use-calendar-screen";

interface IProps {
  screen: CalendarScreen;
  isLoading: boolean;
  isFailed: boolean;
  onRetry: () => void;
}

/**
 * 데스크톱 · 태블릿(768 이상) 캘린더 (I-09 13 ~ 17) — 화면 틀(제목 줄 h1 "캘린더" + 오른쪽 "일정 추가") 아래
 * 도구 줄(달 이동 · 오늘 · 캘린더 고르기 · 보기) 16, 그 아래 카드.
 * 월 보기: 1280 이상은 격자 카드 + 오른쪽 그날 패널 320(사이 24), 미만은 격자 카드 아래 그날 목록 카드(사이 8).
 * 주 · 일 · 연 · 목록 보기는 카드 하나 폭 전체(안 모양은 그대로).
 * 일정을 누르면 상세 — 1280 이상 월 보기는 그날 패널 안 한 단계(칩은 그 날도 고른다), 1280 이상 주 · 일 · 목록 보기는 가운데 대화상자 480,
 * 1280 미만은 가운데 480 시트(I-09b 15 ~ 18).
 */
const CalendarDesktop = ({ screen, isLoading, isFailed, onRetry }: IProps) => {
  const { t } = useTranslation("calendar");
  const { t: tl } = useTranslation("layout");
  const { view, selectedDate } = useCalendar();
  const wide = useWideSurface();
  const canEdit = useCanEditEvent();
  const {
    detail,
    openDetail,
    closeDetail,
    editEvent,
    requestDelete,
    filteredEvents,
    singleDayEvents,
    multiDayEvents,
    eventStartDates,
    setCreatingDate,
  } = screen;

  const dayEvents = eventsOnDay(filteredEvents, selectedDate);
  // 1280 이상 월 보기 — 그날 패널이 상세를 그린다. 보던 날을 바꾸면 패널은 그 날의 목록으로 돌아간다
  const panelMode = wide && view === "month";
  const panelEvent =
    panelMode && detail && detail.day === dayKey(selectedDate)
      ? findEvent(dayEvents, detail.ref)
      : undefined;
  // 그 밖의 표면(대화상자 480 · 480 시트)이 그릴 일정 — 월 보기가 아니거나 1280 미만
  const surfaceEvent =
    detail && !panelMode ? findEvent(filteredEvents, detail.ref) : undefined;

  // 표면이 사라졌다(지움 · 날짜를 다음 달로 옮겨 저장 — 다시 받은 목록에서 빠짐) — 상세를 비운다. 안 비우면 그 일정이 다시 보이는 달로 돌아갈 때 시트가 저절로 열린다
  const gone =
    !!detail && !isLoading && !isFailed && !panelEvent && !surfaceEvent;
  useEffect(() => {
    if (gone) closeDetail();
  }, [gone, closeDetail]);

  const monthBody = (
    <>
      {isLoading ? (
        <CalendarMonthViewDesktopSkeleton />
      ) : isFailed ? (
        <Card data-slot="calendar-month-grid" className="p-0">
          <WeekdayHead />
          <CalendarLoadFailed onRetry={onRetry} />
        </Card>
      ) : (
        <CalendarMonthViewDesktop
          singleDayEvents={singleDayEvents}
          multiDayEvents={multiDayEvents}
          onEventClick={openDetail}
        />
      )}
      {/* 실패는 "일정 없음" 이 아니다 — 그날 패널은 불러온 일정이 있을 때만 */}
      {!isFailed && (
        <div className={cn("relative min-w-0", panelEvent && "self-stretch")}>
          <DayPanel
            date={selectedDate}
            events={dayEvents}
            loading={isLoading}
            onAdd={() => setCreatingDate(selectedDate)}
            onTapEvent={(e) => openDetail(e)}
            detail={panelEvent}
            canEdit={panelEvent ? canEdit(panelEvent) : false}
            onBack={closeDetail}
            onEdit={editEvent}
            onDelete={requestDelete}
            // 상세 단계의 패널은 격자 카드 높이에 맞춘다 — 본문만 스크롤하고 머리 · 바닥은 그대로
            className={panelEvent ? "absolute inset-0" : undefined}
          />
        </div>
      )}
    </>
  );

  // 주 · 일 · 연 · 목록 — 카드 하나(안 모양 그대로). 안쪽 스크롤이 서도록 높이를 준다
  const otherView = (body: React.ReactNode) => (
    <Card
      data-slot="calendar-view-card"
      className="h-[max(560px,calc(100dvh-14rem))] p-0"
    >
      {isFailed && !isLoading ? <CalendarLoadFailed onRetry={onRetry} /> : body}
    </Card>
  );

  return (
    <div
      data-slot="calendar-desktop"
      className="px-[var(--layout-margin)] pb-screen-bottom pt-nav-to-title"
    >
      <div className="mx-auto w-full max-w-[var(--layout-max-low)] lg:max-w-[var(--layout-max-medium)]">
        <PageHead
          title={tl("calendar")}
          style={{ marginBottom: "var(--spacing-x4)" }}
          actions={
            <Button
              variant="neutralOutline"
              size="small"
              onClick={() => setCreatingDate(new Date())}
            >
              <Plus aria-hidden />
              {t("addEvent")}
            </Button>
          }
        />
        <CalendarHeaderDesktop />

        <div className="mt-x4">
          <DndProviderWrapper>
            {view === "month" &&
              (wide ? (
                <div className="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-x6">
                  {monthBody}
                </div>
              ) : (
                <div className="flex flex-col gap-x2">{monthBody}</div>
              ))}
            {view === "day" &&
              otherView(
                isLoading ? (
                  <CalendarDayViewSkeleton />
                ) : (
                  <CalendarDayView
                    singleDayEvents={singleDayEvents}
                    multiDayEvents={multiDayEvents}
                    onEventClick={openDetail}
                  />
                ),
              )}
            {view === "week" &&
              otherView(
                isLoading ? (
                  <CalendarWeekViewSkeleton />
                ) : (
                  <CalendarWeekView
                    singleDayEvents={singleDayEvents}
                    multiDayEvents={multiDayEvents}
                    onEventClick={openDetail}
                  />
                ),
              )}
            {view === "year" &&
              otherView(
                isLoading ? (
                  <CalendarYearViewSkeleton />
                ) : (
                  <CalendarYearView allEvents={eventStartDates} />
                ),
              )}
            {view === "agenda" &&
              otherView(
                isLoading ? (
                  <CalendarAgendaViewSkeleton />
                ) : (
                  <CalendarAgendaView
                    singleDayEvents={singleDayEvents}
                    multiDayEvents={multiDayEvents}
                    onEventClick={openDetail}
                  />
                ),
              )}
          </DndProviderWrapper>
        </div>
      </div>

      {/* 일정 상세 — 1280 이상 월 보기는 그날 패널이 그린다. 그 밖은 1280 이상 대화상자 480 · 미만 480 시트 */}
      {detail && surfaceEvent && (
        <EventDetailSurface
          key={eventKey(surfaceEvent)}
          events={filteredEvents}
          start={detail.ref}
          wideDetail={view === "month" ? "none" : "dialog"}
          onClose={closeDetail}
          onRequestDelete={requestDelete}
        />
      )}
    </div>
  );
};

export { CalendarDesktop };
