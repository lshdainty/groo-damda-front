import { Clock, Flag, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";

import { List, ListButtonItem, ListItem, ListTile } from "@/shared/ds/list";
import { eventBadgeTone } from "@/widgets/calendar/lib/helpers";
import { eventKey } from "@/widgets/calendar/lib/event-key";
import { eventLineDetail } from "@/widgets/calendar/lib/event-line";
import type { IEvent } from "@/widgets/calendar/model/interfaces";

/**
 * 그날 일정 줄 목록 (I-09 공통 값) — 그날 시트(폰) · 그날 패널(데스크톱) · 그날 목록(태블릿)이 같은 줄을 쓴다.
 * 앞 타일 40(색 옅은 바탕 + 아이콘: 공휴일 flag · 종일 sun · 시각 clock) · 제목 t5(줄바꿈) · 설명 "{시각} · {캘린더} · {라벨} · {반복}".
 * 공휴일이 먼저. 줄 사이 선 · 꺾쇠 없음. 공휴일 줄은 보기만 하고 일정 줄은 누르는 줄이다.
 */
export function DayEventList({
  events,
  label,
  onTapEvent,
  className,
}: {
  events: IEvent[];
  /** 목록 이름(보조 기술) — 보통 날짜 */
  label: string;
  onTapEvent: (event: IEvent, el: HTMLElement) => void;
  className?: string;
}) {
  const { t, i18n } = useTranslation("calendar");
  // 공휴일이 먼저, 그다음은 들어온 차례(시작 시각)
  const sorted = [...events].sort(
    (a, b) =>
      Number(b.sourceType === "holiday") - Number(a.sourceType === "holiday"),
  );
  return (
    <List className={className} aria-label={label}>
      {sorted.map((e) => {
        const tone = eventBadgeTone(e);
        const holiday = e.sourceType === "holiday";
        const Icon = holiday ? Flag : e.isAllDay ? Sun : Clock;
        const common = {
          title: e.title,
          detail: eventLineDetail(e, t, i18n.language),
          prefix: (
            <ListTile
              aria-hidden
              style={{ background: tone.bg, color: tone.color }}
            >
              <Icon className="size-5" />
            </ListTile>
          ),
        };
        // 공휴일은 읽기 전용 — 보기만 하는 줄(누를 곳 없음)
        return holiday ? (
          <ListItem key={`${e.id}-${e.startDate}`} {...common} />
        ) : (
          <ListButtonItem
            key={`${e.id}-${e.startDate}`}
            {...common}
            data-event-key={eventKey(e)}
            onClick={(ev) => onTapEvent(e, ev.currentTarget)}
          />
        );
      })}
    </List>
  );
}
