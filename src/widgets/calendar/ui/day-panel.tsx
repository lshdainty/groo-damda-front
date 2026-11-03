import { ChevronLeft, Plus } from "lucide-react";
import { isToday } from "date-fns";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/shared/ds/button";
import { Card } from "@/shared/ds/card";
import { ScrollFog } from "@/shared/ds/scroll-fog";
import { Skeleton } from "@/shared/ds/skeleton";
import { List, ListItem } from "@/shared/ds/list";
import { formatMonthDayDow } from "@/shared/lib/date";
import { cn } from "@/shared/lib/cn";
import { eventKey } from "@/widgets/calendar/lib/event-key";
import { DayEventList } from "@/widgets/calendar/ui/day-event-list";
import { EventDetailBody } from "@/widgets/calendar/ui/event-detail/event-detail-body";
import type { IEvent } from "@/widgets/calendar/model/interfaces";

/**
 * 그날 패널 · 그날 목록 카드 (I-09 16 · 17) — 데스크톱은 격자 오른쪽 320, 태블릿은 격자 아래 폭 전체(같은 부품).
 * 머리: 날 "10월 22일 (목)" t5 700 + 오늘이면 "오늘" t2 700 fg-brand · 오른쪽 "추가"(small outline + plus 16).
 * 그 아래 "일정 {n}개" t3 subtle. 본문은 일정 줄 목록, 빈 날은 안내 한 줄.
 */
export function DayPanel({
  date,
  events,
  loading,
  onAdd,
  onTapEvent,
  detail,
  canEdit = false,
  onBack,
  onEdit,
  onDelete,
  className,
}: {
  date: Date;
  events: IEvent[];
  loading: boolean;
  onAdd: () => void;
  onTapEvent: (event: IEvent, el: HTMLElement) => void;
  /** 주면 패널이 이 일정의 상세 단계로 바뀐다(2-A) — 머리 "‹ 날짜" 로 목록에 돌아온다 */
  detail?: IEvent | null;
  /** 상세 바닥 [삭제][수정]을 둔다(읽기 전용이면 바닥 자체가 없다) */
  canEdit?: boolean;
  onBack?: () => void;
  onEdit?: (event: IEvent) => void;
  onDelete?: (event: IEvent) => void;
  className?: string;
}) {
  const { t } = useTranslation("calendar");
  const { t: tc } = useTranslation("common");
  const label = formatMonthDayDow(date);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const lastKey = useRef<string | null>(null);
  const detailKey = detail ? eventKey(detail) : null;

  // 상세로 들어가면 제목으로, 목록으로 돌아오면 연 줄로 초점을 옮긴다(처음 그릴 때는 건드리지 않는다)
  useEffect(() => {
    if (detailKey) {
      lastKey.current = detailKey;
      titleRef.current?.focus({ preventScroll: true });
    } else if (lastKey.current) {
      document
        .querySelector<HTMLElement>(
          `[data-slot=day-panel] [data-event-key="${lastKey.current}"]`,
        )
        ?.focus({ preventScroll: true });
      lastKey.current = null;
    }
  }, [detailKey]);

  if (detail) {
    return (
      <Card
        data-slot="day-panel"
        data-step="detail"
        aria-label={detail.title}
        className={cn("flex flex-col p-0", className)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onBack?.();
          }
        }}
      >
        <div className="flex shrink-0 items-center pb-x2 pl-x6 pr-x5 pt-x4">
          <Button
            variant="ghost"
            size="small"
            flush="left"
            className="font-bold"
            aria-label={t("panel.backToList", { date: label })}
            onClick={onBack}
          >
            <ChevronLeft aria-hidden />
            {label}
          </Button>
        </div>
        <ScrollFog use="overlayBody" className="min-h-0 flex-1">
          <EventDetailBody
            event={detail}
            placement="panel"
            titleRef={titleRef}
          />
        </ScrollFog>
        {canEdit && (
          <div
            data-slot="day-panel-footer"
            className="flex shrink-0 items-center gap-x2 border-t border-stroke-neutral-subtle px-x5 pb-x4 pt-x3"
          >
            <Button
              variant="ghost"
              ghostColor="critical"
              size="small"
              className="mr-auto"
              onClick={() => onDelete?.(detail)}
            >
              {tc("delete")}
            </Button>
            <Button size="small" onClick={() => onEdit?.(detail)}>
              {tc("edit")}
            </Button>
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card
      data-slot="day-panel"
      aria-label={label}
      className={`p-0 ${className ?? ""}`}
    >
      <div className="flex items-center justify-between gap-x2 pb-0 pl-x6 pr-x5 pt-x5">
        <h2 className="m-0 flex min-w-0 items-center gap-x1_5 text-t5 font-bold text-fg-neutral">
          <span className="min-w-0">{label}</span>
          {isToday(date) && (
            <i className="shrink-0 text-t2 font-bold not-italic text-fg-brand">
              {t("panel.today")}
            </i>
          )}
        </h2>
        <Button variant="neutralOutline" size="small" onClick={onAdd}>
          <Plus aria-hidden />
          {t("add")}
        </Button>
      </div>
      <p className="mb-x1 mt-x0_5 px-x6 text-t3 text-fg-neutral-subtle">
        {loading ? (
          <Skeleton text="t3" className="w-x16" />
        ) : (
          t("panel.count", { count: events.length })
        )}
      </p>
      <div className="pb-x3">
        {loading ? (
          <List aria-hidden>
            {[0, 1].map((i) => (
              <ListItem
                key={i}
                prefix={<Skeleton radius="12" className="size-x10" />}
                title={<Skeleton text="t5" className="w-32 max-w-full" />}
                detail={<Skeleton text="t3" className="w-24 max-w-full" />}
              />
            ))}
          </List>
        ) : events.length === 0 ? (
          <p
            data-slot="day-panel-empty"
            className="m-0 px-x6 py-x6 text-center text-t4 text-fg-neutral-subtle"
          >
            {t("noEvents")}
          </p>
        ) : (
          <DayEventList events={events} label={label} onTapEvent={onTapEvent} />
        )}
      </div>
    </Card>
  );
}
