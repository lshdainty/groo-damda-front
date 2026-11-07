import { useTranslation } from "react-i18next";

import { Skeleton, SkeletonGroup } from "@/shared/ds/skeleton";

const WEEK_DAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEK_DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * 주 보기의 첫 불러오기 자리 — 시간 격자의 틀(요일 머리 · 선)은 그대로 그리고 일정 자리만 ds Skeleton 이다.
 * 깜빡임(펄스)은 두지 않는다(skeleton.md) — 스펙의 반짝임 띠가 지난다.
 */
const CalendarWeekViewSkeleton = () => {
  const { i18n } = useTranslation();
  const weekDays = i18n.language.startsWith("ko") ? WEEK_DAYS_KO : WEEK_DAYS_EN;

  const hours = Array.from({ length: 11 }, (_, i) => i + 8);

  return (
    <SkeletonGroup className="h-full w-full">
      <div aria-hidden className="flex h-full flex-col">
        {/* 여러 날 일정 줄 */}
        <div className="border-b border-stroke-neutral-subtle">
          <div className="flex">
            <div className="w-[72px]" />
            <div className="grid flex-1 grid-cols-7 divide-x divide-stroke-neutral-subtle border-l border-stroke-neutral-subtle">
              {weekDays.map((_, index) => (
                <div key={index} className="p-x1">
                  {index % 3 === 0 && (
                    <Skeleton radius="4" className="h-[20px] w-full" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 요일 머리 — 요일 글은 그대로, 날짜 숫자만 자리 */}
        <div className="relative z-20 flex border-b border-stroke-neutral-subtle">
          <div className="w-[72px]" />
          <div className="grid flex-1 grid-cols-7 divide-x divide-stroke-neutral-subtle border-l border-stroke-neutral-subtle">
            {weekDays.map((day, index) => {
              const color =
                index === 0
                  ? "text-fg-critical"
                  : index === 6
                    ? "text-fg-brand"
                    : "text-fg-neutral";
              return (
                <div
                  key={index}
                  className="py-x2 text-center text-t2 font-medium"
                >
                  <span className={color}>{day}</span>
                  <Skeleton
                    radius="4"
                    className="mx-auto mt-x1 h-[16px] w-[16px]"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* 시간 격자 */}
        <div className="flex-1 overflow-hidden">
          <div className="flex h-full">
            <div className="relative w-[72px]">
              {hours.map((hour, index) => (
                <div key={hour} className="relative" style={{ height: "96px" }}>
                  <div className="absolute -top-[12px] right-x2 flex h-[24px] items-center">
                    {index !== 0 && (
                      <Skeleton radius="4" className="h-[12px] w-[40px]" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="relative flex-1 border-l border-stroke-neutral-subtle">
              <div className="grid grid-cols-7 divide-x divide-stroke-neutral-subtle">
                {weekDays.map((_, dayIndex) => (
                  <div key={dayIndex} className="relative">
                    {hours.map((hour, index) => (
                      <div
                        key={hour}
                        className="relative"
                        style={{ height: "96px" }}
                      >
                        {index !== 0 && (
                          <div className="pointer-events-none absolute inset-x-0 top-0 border-b border-stroke-neutral-subtle" />
                        )}
                        <div className="pointer-events-none absolute inset-x-0 top-1/2 border-b border-dashed border-stroke-neutral-subtle" />
                      </div>
                    ))}

                    {dayIndex % 2 === 0 && (
                      <div className="absolute left-x1 right-x1 top-[192px] h-[96px] p-x0_5">
                        <Skeleton radius="8" className="h-full w-full" />
                      </div>
                    )}
                    {dayIndex % 3 === 1 && (
                      <div className="absolute left-x1 right-x1 top-[384px] h-[144px] p-x0_5">
                        <Skeleton radius="8" className="h-full w-full" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </SkeletonGroup>
  );
};

export { CalendarWeekViewSkeleton };
