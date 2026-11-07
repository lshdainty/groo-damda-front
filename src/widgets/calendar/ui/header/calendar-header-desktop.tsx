import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { enUS, ko } from "date-fns/locale";

import { useCalendar } from "@/widgets/calendar/model/calendar-context";
import { navigateDate } from "@/widgets/calendar/lib/helpers";
import type { TCalendarView } from "@/widgets/calendar/model/types";
import { Button } from "@/shared/ds/button";
import { ChipRadio, ChipRadioGroup } from "@/shared/ds/chip";
import { MonthPicker } from "@/shared/ds/month-picker";
import { CalendarSourceToggle } from "@/widgets/calendar/ui/header/calendar-source-toggle";

/** 보기 고르기 차례 — 월 · 주 · 목록(I-09 15, 일 · 연은 걷었다 — I-wrap-b1 γ) */
const VIEWS: { value: TCalendarView; key: string }[] = [
  { value: "month", key: "view.month" },
  { value: "week", key: "view.week" },
  { value: "agenda", key: "view.agenda" },
];

/**
 * 데스크톱 · 태블릿 도구 줄 (I-09 14 · 15) — 제목 줄 아래 16, 카드 밖 회색 바닥 위 한 줄.
 * 왼쪽: 달 글 t7 700 + 꺾쇠(누르면 연 | 월 휠 — 1280 이상 팝오버, 미만 시트). ‹ › · "오늘" 은 두지 않는다(사용자 10-29 — 연 · 월은 휠로만).
 * 주 보기만 한 주씩 옮기는 ‹ › 를 달 글 뒤에 둔다.
 * 오른쪽: 캘린더 고르기 칩 · 보기 고르기(Chip 하나 고르기 — 이름이 보이는 글). 좁으면 오른쪽 묶음이 다음 줄로.
 */
const CalendarHeaderDesktop = () => {
  const { t, i18n } = useTranslation("calendar");
  const { selectedDate, setSelectedDate, view, setView } = useCalendar();

  const locale = i18n.language.startsWith("ko") ? ko : enUS;
  const dateFormat = i18n.language.startsWith("ko")
    ? "yyyy년 M월"
    : "MMMM yyyy";
  const formattedDate = format(selectedDate, dateFormat, { locale });

  const handlePrevious = () =>
    setSelectedDate(navigateDate(selectedDate, view, "previous"));
  const handleNext = () =>
    setSelectedDate(navigateDate(selectedDate, view, "next"));
  const stepUnit = view === "week";

  return (
    <div className="flex flex-wrap items-center justify-between gap-x3">
      <div className="flex items-center gap-x1">
        {/* 날짜 텍스트 → 연 | 월 휠 팝오버(1280 이상) · 시트(미만) — I-27 */}
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
              className="flex items-center gap-x1 whitespace-nowrap rounded-r2 text-t7 font-bold text-fg-neutral focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus-ring"
            >
              {formattedDate}
              <ChevronDown
                aria-hidden
                className="size-4 text-fg-neutral-muted"
              />
            </button>
          }
        />
        {/* 주 보기는 단위가 달이 아니라 한 주라 ‹ › 를 남긴다 — 연 · 월은 휠로만 옮긴다(I-27) */}
        {stepUnit && (
          <>
            <Button
              aria-label={t("header.prevWeek")}
              variant="neutralOutline"
              size="small"
              layout="iconOnly"
              className="[&_svg]:size-4"
              onClick={handlePrevious}
            >
              <ChevronLeft />
            </Button>
            <Button
              aria-label={t("header.nextWeek")}
              variant="neutralOutline"
              size="small"
              layout="iconOnly"
              className="[&_svg]:size-4"
              onClick={handleNext}
            >
              <ChevronRight />
            </Button>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x2">
        <CalendarSourceToggle />
        <ChipRadioGroup
          aria-label={t("view.label")}
          value={view}
          onValueChange={(v) => setView(v as TCalendarView)}
        >
          {VIEWS.map(({ value, key }) => (
            <ChipRadio
              key={value}
              value={value}
              variant="outlineStrong"
              size="small"
            >
              {t(key)}
            </ChipRadio>
          ))}
        </ChipRadioGroup>
      </div>
    </div>
  );
};

export { CalendarHeaderDesktop };
