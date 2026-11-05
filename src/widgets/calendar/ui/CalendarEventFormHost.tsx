import { useState } from "react";

import { useWideSurface } from "@/shared/ds/overlay";
import { useEventLabels } from "@/features/event-label";
import { withOpenedOccurrence } from "@/widgets/calendar/lib/helpers";
import {
  useCreateEvent,
  useUpdateEvent,
} from "@/widgets/calendar/model/useCalendarEvents";
import { EventForm } from "@/widgets/calendar/ui/EventForm";
import {
  QuickAddDialog,
  type QuickAddDraft,
} from "@/widgets/calendar/ui/event-form/quick-add";

import type { CalendarEvent } from "@/entities/calendar";

/**
 * 일정 폼을 여는 자리 하나 (I-09 36) — 일정 추가(셸 + · 그날 시트/패널/제목 줄 · 끌어 고른 기간)와 수정이
 * 모두 이것을 마운트한다. 표면(1280 미만 시트 · 이상 "자세히" 대화상자)은 `EventForm` 이 고르고,
 * 라벨 · 저장(만들기 · 수정 + 반복 회차 알림) · 닫기만 여기서 이어 준다.
 *
 * `event` 가 있으면 수정, 없으면 `selectedDate` ~ `selectedEndDate` 로 새 일정.
 * `quick` 이면 1280 이상에서 먼저 가운데 작은 빠른 추가 대화상자가 뜨고 "자세히" 로 일정 폼 대화상자에 간다
 * (1280 미만은 곧바로 일정 폼 시트). 빠른 추가 → 자세히 사이에 쓴 값이 넘어가고, 창 폭을 넘나들어도 단계가 남는다.
 */
export function CalendarEventFormHost({
  event,
  selectedDate,
  selectedEndDate,
  quick = false,
  onClose,
  onDelete,
}: {
  event?: CalendarEvent | null;
  selectedDate?: Date;
  selectedEndDate?: Date;
  /** 1280 이상에서 빠른 추가로 먼저 연다(새 일정만) */
  quick?: boolean;
  onClose: () => void;
  /** 수정 폼 바닥 [삭제] — 확인창은 부르는 쪽이 연다 */
  onDelete?: () => void;
}) {
  const wide = useWideSurface();
  const { data: labels = [] } = useEventLabels({ reference: true });
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  // "자세히" 를 눌렀으면 그 값을 들고 있다 — 없으면 빠른 추가 단계
  const [draft, setDraft] = useState<QuickAddDraft | null>(null);

  if (quick && wide && !event && !draft) {
    const day = selectedDate ?? new Date();
    return (
      <QuickAddDialog
        start={day}
        end={selectedEndDate ?? day}
        isLoading={createEvent.isPending}
        saveError={createEvent.isError}
        onClose={onClose}
        onDetail={setDraft}
        // 실패는 대화상자의 Callout 이 알린다 — 전역 토스트(서버 글)는 끈다
        onSave={(values) =>
          createEvent.mutate(
            { data: values, silent: true },
            { onSuccess: onClose },
          )
        }
      />
    );
  }

  return (
    <EventForm
      event={event}
      selectedDate={draft?.start ?? selectedDate}
      selectedEndDate={draft?.end ?? selectedEndDate}
      initialDirty={draft?.dirty}
      initial={
        draft
          ? {
              title: draft.title,
              isAllDay: draft.isAllDay,
              calendarRowId: draft.calendarRowId,
            }
          : undefined
      }
      labels={labels}
      isLoading={event ? updateEvent.isPending : createEvent.isPending}
      saveError={event ? updateEvent.isError : createEvent.isError}
      onClose={onClose}
      onDelete={onDelete}
      onSubmit={(data) => {
        if (event) {
          // 반복 일정은 연 회차를 함께 알린다 — 안 알리면 서버가 그 회차 날짜를 반복의
          // 새 시작으로 써서 앞 회차들이 사라졌다(QA 30 2).
          updateEvent.mutate(
            {
              id: event.rowId,
              data: withOpenedOccurrence(data, event),
              silent: true,
            },
            { onSuccess: onClose },
          );
        } else {
          createEvent.mutate({ data, silent: true }, { onSuccess: onClose });
        }
      }}
    />
  );
}
