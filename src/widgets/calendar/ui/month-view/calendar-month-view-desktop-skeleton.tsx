import { useCalendar } from "@/widgets/calendar/model/calendar-context";
import { getCalendarCells } from "@/widgets/calendar/lib/helpers";
import { Card } from "@/shared/ds/card";
import { Skeleton, LoadingRegion } from "@/shared/ds/skeleton";
import { cn } from "@/shared/lib/cn";

import { WeekdayHead } from "./calendar-month-view-desktop";

/**
 * 데스크톱 · 태블릿 월 격자의 첫 불러오기 자리 (I-09 19) — 카드와 요일 머리는 그리고 칸만 ds Skeleton 이다.
 * 실제 칸과 같은 높이 · 선이라 데이터로 바뀔 때 격자가 움직이지 않는다.
 */
export function CalendarMonthViewDesktopSkeleton() {
  const { selectedDate } = useCalendar();
  const cells = getCalendarCells(selectedDate);
  return (
    <Card data-slot="calendar-month-grid" className="p-0">
      <WeekdayHead />
      <LoadingRegion
        pending
        className="contents"
        fallback={
          <>
            <div className="grid grid-cols-7">
              {cells.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex flex-col gap-x0_5 pt-x1",
                    "h-[104px]",
                    i < cells.length - 7 &&
                      "border-b border-stroke-neutral-subtle",
                    i % 7 !== 6 && "border-r border-stroke-neutral-subtle",
                  )}
                >
                  <Skeleton
                    radius="full"
                    className="mb-x0_5 ml-x1_5 size-[26px] shrink-0"
                  />
                  <div className="mx-x1 flex flex-col gap-x0_5">
                    {i % 7 === 0 || i % 5 === 0 ? (
                      <Skeleton radius="4" className="h-x5 w-full" />
                    ) : null}
                    {i % 7 === 0 ? (
                      <Skeleton radius="4" className="h-x5 w-full" />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </>
        }
      />
    </Card>
  );
}
