import { useCalendar } from "@/widgets/calendar/model/calendar-context";
import { getCalendarCells } from "@/widgets/calendar/lib/helpers";
import { Skeleton, LoadingRegion } from "@/shared/ds/skeleton";

/**
 * 폰 월 격자의 첫 불러오기 자리 (I-09 12) — 요일 줄은 처음부터 그리고, 칸(103 × 주 수)만 ds Skeleton 이다.
 * 칸마다 날 숫자 원 자리 + 일부 칸에 칩 자리(18). 다시 받는 중에는 이 자리를 쓰지 않는다(지금 값을 둔다).
 */
export function CalendarMonthViewMobileSkeleton() {
  const { selectedDate } = useCalendar();
  const count = getCalendarCells(selectedDate).length;
  return (
    <LoadingRegion
      pending
      className="contents"
      fallback={
        <>
          <div data-slot="calendar-month-grid" className="flex flex-col">
            <div className="grid grid-cols-7 px-[2px]" aria-hidden>
              {Array.from({ length: count }, (_, i) => (
                <div
                  key={i}
                  className="flex h-[103px] flex-col gap-x0_5 px-px pt-x0_5 shadow-[inset_0_1px_0_0_var(--color-stroke-neutral-subtle)]"
                >
                  <Skeleton
                    radius="full"
                    className="size-[26px] shrink-0 self-center"
                  />
                  {i % 7 === 0 || i % 5 === 0 ? (
                    <Skeleton radius="4" className="h-x4_5 w-full" />
                  ) : null}
                  {i % 7 === 0 ? (
                    <Skeleton radius="4" className="h-x4_5 w-full" />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </>
      }
    />
  );
}
