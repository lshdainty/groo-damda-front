import { format, isSameDay, parseISO } from "date-fns";
import { enUS, ko } from "date-fns/locale";
import type { TFunction } from "i18next";

import { dsText } from "@/shared/ds/i18n";
import type { IEvent } from "@/widgets/calendar/model/interfaces";

const REPEAT_KEY: [string, string][] = [
  ["FREQ=DAILY", "recurrence.daily"],
  ["FREQ=WEEKLY", "recurrence.weekly"],
  ["FREQ=MONTHLY", "recurrence.monthly"],
  ["FREQ=YEARLY", "recurrence.yearly"],
];

/**
 * 일정 줄의 설명 — "{시각} · {캘린더} · {라벨} · {반복}", 없는 조각은 뺀다(I-09 공통 값).
 * 시각: 종일 "종일"(이어지는 종일은 "종일 · 10월 10일~11일"), 그 밖 "오전 10:00~오후 12:00". 공휴일은 "공휴일".
 */
export function eventLineDetail(
  event: IEvent,
  t: TFunction,
  language: string,
): string {
  if (event.sourceType === "holiday") return t("source.holiday");
  const isKo = language.startsWith("ko");
  const locale = isKo ? ko : enUS;
  const start = parseISO(event.startDate);
  const end = parseISO(event.endDate);
  const clock = (d: Date) => format(d, isKo ? "a h:mm" : "h:mm a", { locale });
  const monthDay = (d: Date) =>
    format(d, isKo ? "M월 d일" : "MMM d", { locale });

  // 구간 기호는 로케일 문구 — 앞뒤를 붙여 쓴다(DESIGN.desk.md 구간)
  const sep = dsText("datePicker.rangeSeparator");
  let when: string;
  if (event.isAllDay) {
    when = isSameDay(start, end)
      ? t("allDay")
      : `${t("allDay")} · ${monthDay(start)}${sep}${
          start.getMonth() === end.getMonth()
            ? format(end, isKo ? "d일" : "d", { locale })
            : monthDay(end)
        }`;
  } else {
    when = isSameDay(start, end)
      ? `${clock(start)}${sep}${clock(end)}`
      : `${monthDay(start)} ${clock(start)}${sep}${monthDay(end)} ${clock(end)}`;
  }
  const repeat = REPEAT_KEY.find(([k]) => event.rrule?.includes(k))?.[1];
  return [when, event.calendarName, event.labelName, repeat ? t(repeat) : null]
    .filter(Boolean)
    .join(" · ");
}
