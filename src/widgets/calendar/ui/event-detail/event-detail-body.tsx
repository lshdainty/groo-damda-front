import { useState, type ReactNode, type Ref } from "react";
import {
  differenceInCalendarDays,
  differenceInMinutes,
  isSameDay,
  parseISO,
} from "date-fns";
import {
  Bell,
  Calendar,
  Clock,
  MapPin,
  Repeat,
  Sun,
  Tag,
  Text,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/shared/ds/badge";
import { formatDateValue } from "@/shared/ds/date-picker";
import { List, ListItem } from "@/shared/ds/list";
import { formatTimeValue } from "@/shared/ds/time-picker";
import { cn } from "@/shared/lib/cn";
import { getPaletteByColor } from "@/shared/lib/groo/chart-palette";
import { DotValue } from "@/widgets/calendar/ui/dot-value";
import { reminderKey } from "@/widgets/calendar/ui/event-form/types";

import type { IEvent } from "@/widgets/calendar/model/interfaces";

const ROW_ICON = "size-[22px]";

/** 값의 조각들 — 자르지 않고 조각 단위로 줄을 바꾼다. 날짜 조각 + 사이 8 + 시각 조각 */
function Pieces({ children }: { children: ReactNode }) {
  return (
    // 값은 줄 끝 오른쪽 맞춤(공용 List text-end) — 좁은 줄(200%)에서 제목 아래로 내려가면 왼쪽(list.md:154)
    <span className="flex flex-wrap items-center justify-end gap-x-x2 @max-[calc(16rem+48px)]/list-item:justify-start">
      {children}
    </span>
  );
}

function Piece({ muted, children }: { muted?: boolean; children: ReactNode }) {
  return (
    <span
      className={cn("whitespace-nowrap", muted && "text-fg-neutral-subtle")}
    >
      {children}
    </span>
  );
}

/** 걸린 시간 — 같은 날 시각 일정만. "2시간" · "1시간 30분" · "45분" */
function durationLabel(
  start: Date,
  end: Date,
  t: (key: string, o?: Record<string, unknown>) => string,
): string | null {
  const min = differenceInMinutes(end, start);
  if (min <= 0) return null;
  if (min < 60) return t("detail.durationM", { m: min });
  const h = Math.floor(min / 60);
  return min % 60
    ? t("detail.durationHM", { h, m: min % 60 })
    : t("detail.durationH", { h });
}

/** 반복 한 줄 — 매일 · 매주 · 매월 · 매년 밖의 규칙은 일정 폼과 같은 갈래("반복 안 함"으로 보인다) */
function recurrenceKey(rrule: string | null): string {
  if (rrule?.includes("FREQ=DAILY")) return "recurrence.daily";
  if (rrule?.includes("FREQ=WEEKLY")) return "recurrence.weekly";
  if (rrule?.includes("FREQ=MONTHLY")) return "recurrence.monthly";
  if (rrule?.includes("FREQ=YEARLY")) return "recurrence.yearly";
  return "recurrence.none";
}

interface EventDetailBodyProps {
  event: IEvent;
  /**
   * 어느 자리에 놓이나 — 머리 좌우 여백만 다르다. sheet(시트 · 대화상자) 좌우 24, panel(그날 패널) 왼쪽 24 · 오른쪽 20.
   * 이 부품은 가장자리까지 닿는 상자 안에 둔다(줄이 화면 끝까지 눌린다).
   */
  placement?: "sheet" | "panel";
  /** 제목 요소 — 상세로 들어갈 때 초점을 받는다(tabIndex -1) */
  titleRef?: Ref<HTMLHeadingElement>;
}

/**
 * 일정 상세 본문 (I-09b 6 · 1-2B) — 제목 + D-day 배지 아래 List 줄. 일정 폼 줄과 같은 차례 · 같은 아이콘이고 꺾쇠만 없다.
 * 없는 값(라벨 · 알림 · 장소 · 설명)은 줄을 두지 않고 반복은 늘 둔다. 색은 캘린더 · 라벨 줄의 점으로만 — 일정 색은 그리지 않는다.
 * 폰 그날 시트 · 데스크톱 그날 패널 · 480 시트 / 대화상자가 이 부품 하나를 같이 쓴다. 바닥 [삭제][수정]은 표면이 그린다(`EventDetailSurface` · `DayPanel`).
 */
export function EventDetailBody({
  event,
  placement = "sheet",
  titleRef,
}: EventDetailBodyProps) {
  const { t } = useTranslation("calendar");
  const [today] = useState(() => new Date());

  const start = parseISO(event.startDate);
  const end = parseISO(event.endDate);
  const sameDay = isSameDay(start, end);
  const dayText = (d: Date) => formatDateValue(d, today);
  const timeText = (d: Date) => formatTimeValue(d);

  // D-day — 시작일 기준 · 오늘 0. 오늘 · 1 ~ 3일 남음은 곧 닥친 일이라 warning, 그 밖(4일 이상 · 지남)은 neutral
  const dd = differenceInCalendarDays(start, today);
  const ddLabel =
    dd === 0
      ? t("detail.dday")
      : dd > 0
        ? t("detail.ddayLeft", { n: dd })
        : t("detail.ddayPast", { n: -dd });

  // 색은 캘린더 · 라벨 줄의 점으로만 — 일정 색(event.color)은 상세 어디에도 그리지 않는다(09-25 데이터 원칙)
  const calendarDot = getPaletteByColor(event.calendarColor ?? undefined).color;
  const reminders = [...event.reminders]
    .map((r) => r.minutesBefore)
    .sort((a, b) => a - b)
    .map((m) => t(reminderKey(m)))
    .join(", ");
  const duration =
    !event.isAllDay && sameDay ? durationLabel(start, end, t) : null;

  return (
    <div data-slot="event-detail">
      <div
        data-slot="event-detail-head"
        className={cn(
          "flex flex-col items-start gap-x2 pb-x2",
          placement === "panel" ? "pl-x6 pr-x5" : "px-x6",
        )}
      >
        <h3
          ref={titleRef}
          tabIndex={-1}
          data-slot="event-detail-title"
          className="m-0 break-keep text-t7 font-bold text-fg-neutral [overflow-wrap:break-word] focus:outline-none"
        >
          {event.title}
        </h3>
        <Badge
          size="large"
          variant="weak"
          tone={dd >= 0 && dd <= 3 ? "warning" : "neutral"}
        >
          {ddLabel}
        </Badge>
      </div>

      <List aria-label={t("eventDetail")}>
        {event.calendarName && (
          <ListItem
            prefix={<Calendar className={ROW_ICON} />}
            title={t("form.calendar")}
            suffixText
            suffix={
              <DotValue color={calendarDot}>{event.calendarName}</DotValue>
            }
          />
        )}
        {event.labelName && (
          <ListItem
            prefix={<Tag className={ROW_ICON} />}
            title={t("form.label")}
            suffixText
            suffix={
              <DotValue
                color={
                  getPaletteByColor(
                    event.labelColor ?? event.calendarColor ?? undefined,
                  ).color
                }
              >
                {event.labelName}
              </DotValue>
            }
          />
        )}
        {event.isAllDay ? (
          <ListItem
            prefix={<Sun className={ROW_ICON} />}
            title={t("form.allDay")}
            suffixText
            suffix={
              <Pieces>
                <Piece>{dayText(start)}</Piece>
                {!sameDay && <Piece>{`~ ${dayText(end)}`}</Piece>}
              </Pieces>
            }
          />
        ) : (
          <>
            <ListItem
              prefix={<Clock className={ROW_ICON} />}
              title={t("form.start")}
              suffixText
              suffix={
                <Pieces>
                  <Piece>{dayText(start)}</Piece>
                  <Piece>{timeText(start)}</Piece>
                </Pieces>
              }
            />
            <ListItem
              prefix={<Clock className={ROW_ICON} />}
              title={t("form.end")}
              suffixText
              suffix={
                <Pieces>
                  <Piece>{dayText(end)}</Piece>
                  <Piece>{timeText(end)}</Piece>
                  {duration && <Piece muted>{duration}</Piece>}
                </Pieces>
              }
            />
          </>
        )}
        <ListItem
          prefix={<Repeat className={ROW_ICON} />}
          title={t("form.recurrence")}
          suffix={t(recurrenceKey(event.rrule))}
        />
        {reminders && (
          <ListItem
            prefix={<Bell className={ROW_ICON} />}
            title={t("form.reminder")}
            suffix={reminders}
          />
        )}
        {event.location && (
          <ListItem
            prefix={<MapPin className={ROW_ICON} />}
            title={t("form.location")}
            suffixText
            suffix={
              <span className="whitespace-pre-wrap">{event.location}</span>
            }
          />
        )}
        {event.description && (
          <ListItem
            prefix={<Text className={ROW_ICON} />}
            title={t("form.description")}
          />
        )}
      </List>
      {event.description && (
        // 줄 제목 글 시작과 맞춘다(24 + 아이콘 22 + 사이 12) — 말줄임 없이 다 보인다
        <p
          data-slot="event-detail-description"
          className="m-0 whitespace-pre-wrap pb-x4 pl-[58px] pr-x6 text-article-body text-fg-neutral [overflow-wrap:break-word]"
        >
          {event.description}
        </p>
      )}
    </div>
  );
}
