import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { enUS, ko } from "date-fns/locale";

import { useCalendar } from "@/widgets/calendar/model/calendar-context";
import { navigateDate } from "@/widgets/calendar/lib/helpers";
import { Button } from "@/shared/ds/button";
import { MonthPicker } from "@/shared/ds/month-picker";
import { CalendarSourceToggle } from "@/widgets/calendar/ui/header/calendar-source-toggle";

/**
 * 폰 달 줄 (I-09 6) — 흰 면 맨 위, 높이 52 · 왼쪽 24 · 오른쪽 16.
 * 달 글 t6 700 + 꺾쇠 16(누르면 연 | 월 휠 시트) · 오른쪽 캘린더 고르기 칩. ‹ › 는 두지 않는다(사용자 10-29 — 연 · 월은 휠로만),
 * 주 보기만 한 주씩 옮기는 ‹ › 를 남긴다.
 */
const CalendarHeaderMobile = () => {
  const { t, i18n } = useTranslation("calendar");
  const { selectedDate, setSelectedDate, view } = useCalendar();

  const locale = i18n.language.startsWith("ko") ? ko : enUS;
  const dateFormat = i18n.language.startsWith("ko")
    ? "yyyy년 M월"
    : "MMMM yyyy";
  const formattedDate = format(selectedDate, dateFormat, { locale });

  const handlePrevious = () =>
    setSelectedDate(navigateDate(selectedDate, view, "previous"));
  const stepUnit = view === "week";
  const handleNext = () =>
    setSelectedDate(navigateDate(selectedDate, view, "next"));

  return (
    <div className="flex min-h-x13 shrink-0 flex-wrap items-center gap-y-x1 pl-x6 pr-x4">
      {/* 달 글(+ 주 보기의 ‹ ›) 은 한 덩어리 — 글자가 커져 줄이 모자라면 칩만 아래 줄로 내려간다 */}
      <div className="flex shrink-0 items-center">
        {/* 달 글 → 연 | 월 휠 시트(I-27) — 닫기 · 뒤로 가기는 시트가 맡는다 */}
        <MonthPicker
          value={{
            year: selectedDate.getFullYear(),
            month: selectedDate.getMonth() + 1,
          }}
          onValueChange={(v) =>
            setSelectedDate(new Date(v.year, v.month - 1, 1))
          }
          title={t("common:selectMonth")}
          doneLabel={t("common:done")}
          trigger={
            <button
              type="button"
              className="flex min-h-[44px] items-center gap-x1 whitespace-nowrap rounded-r2 text-t6 font-bold text-fg-neutral focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus-ring"
            >
              {formattedDate}
              <ChevronDown
                aria-hidden
                className="size-4 text-fg-neutral-muted"
              />
            </button>
          }
        />

        {stepUnit && (
          <>
            <Button
              aria-label={t("header.prevWeek")}
              variant="ghost"
              size="medium"
              layout="iconOnly"
              className="size-[40px]"
              onClick={handlePrevious}
            >
              <ChevronLeft />
            </Button>
            <Button
              aria-label={t("header.nextWeek")}
              variant="ghost"
              size="medium"
              layout="iconOnly"
              className="size-[40px]"
              onClick={handleNext}
            >
              <ChevronRight />
            </Button>
          </>
        )}
      </div>
      <div className="ml-auto">
        <CalendarSourceToggle />
      </div>
    </div>
  );
};

export { CalendarHeaderMobile };
