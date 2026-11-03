import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useTranslation } from "react-i18next";

import { useLeaveConfirm } from "@/shared/ds/alert-dialog";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetFooter,
} from "@/shared/ds/bottom-sheet";
import { Button } from "@/shared/ds/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
} from "@/shared/ds/dialog";
import { useBackClose, useWideSurface } from "@/shared/ds/overlay";
import { formatMonthDayDow } from "@/shared/lib/date";
import { useEventLabels } from "@/features/event-label";
import {
  eventKey,
  findEvent,
  refOf,
  type EventRef,
} from "@/widgets/calendar/lib/event-key";
import { withOpenedOccurrence } from "@/widgets/calendar/lib/helpers";
import { iEventToCalendarEvent } from "@/widgets/calendar/model/use-calendar-screen";
import { useCanEditEvent } from "@/widgets/calendar/model/use-can-edit-event";
import { useUpdateEvent } from "@/widgets/calendar/model/useCalendarEvents";
import { useEventFormFlow } from "@/widgets/calendar/model/use-event-form-flow";
import { useStepBack } from "@/widgets/calendar/model/use-step-back";
import { DayEventList } from "@/widgets/calendar/ui/day-event-list";
import { EventFormDialogPanel } from "@/widgets/calendar/ui/event-form/dialog-panel";
import { formSheetContentProps } from "@/widgets/calendar/ui/event-form/sheet-content-props";
import { EventFormSheetChildren } from "@/widgets/calendar/ui/event-form/sheet-panel";
import { EventDetailBody } from "./event-detail-body";

import type { CalendarEvent } from "@/entities/calendar";
import type { IEvent } from "@/widgets/calendar/model/interfaces";

type Step = { kind: "list" } | { kind: "detail" | "edit"; ref: EventRef };

interface EventDetailSurfaceProps {
  /** 일정을 찾는 원본 — 폰은 그날 일정, 그 밖은 보이는 범위의 일정 전부. 지우거나 옮기면 여기서 사라져 목록 / 닫기로 돌아간다 */
  events: IEvent[];
  /** 폰 그날 시트 — 주면 첫 단계가 그날 목록이고 상세의 ← 가 목록으로 돌아간다 */
  listDate?: Date;
  /** 상세로 바로 여는 일정(태블릿 480 시트 · 1280 이상 주 · 일 · 목록 보기 대화상자) */
  start?: EventRef | null;
  /**
   * 1280 이상에서 상세를 어디에 그리나 — dialog(가운데 대화상자 480) / none(월 보기는 그날 패널이 그린다).
   * 1280 미만은 늘 ds Bottom Sheet(최대 480)다.
   */
  wideDetail?: "dialog" | "none";
  onClose: () => void;
  /** 그날 목록 바닥 [일정 추가] */
  onAdd?: () => void;
  /** [삭제] — 확인창은 부르는 쪽이 연다. 지워지면 events 에서 빠져 이 표면이 목록으로 / 닫힘으로 돌아간다 */
  onRequestDelete: (event: IEvent) => void;
}

/**
 * 일정 상세가 든 표면 (I-09b 5 · 9 · 17 · 18) — 한 시트(1280 미만) 또는 대화상자(1280 이상) 안에서 단계가 바뀐다.
 *   - 폰 그날 시트: 목록 → 상세 → 수정 폼 → (장소 · 설명). 시트를 닫았다 다시 열지 않는다.
 *   - 태블릿 480 시트: 상세 → 수정 폼 (← 없음).
 *   - 1280 이상 주 · 일 · 목록 보기: 상세 대화상자 → [수정] 이면 "자세히" 대화상자. 저장하면 닫힌다(보기는 그대로).
 *
 * 닫는 길이 단계마다 다르다: ← · `Esc` · 기기 뒤로 가기 = 한 단계 뒤(수정 폼이면 바뀐 값을 먼저 묻는다), 닫기 원 · 바깥 · 끌어내리기 = 시트 전체
 * (목록 · 상세는 조회라 닫힌다, 수정 폼은 입력이라 바깥 · 끌기로는 닫히지 않는다).
 * 수정 폼의 값 · 단계는 `useEventFormFlow` 가 들고 있어 1280 을 넘나들어도 남는다.
 */
export function EventDetailSurface({
  events,
  listDate,
  start,
  wideDetail = "dialog",
  onClose,
  onAdd,
  onRequestDelete,
}: EventDetailSurfaceProps) {
  const { t } = useTranslation("calendar");
  const { t: tc } = useTranslation("common");
  const wide = useWideSurface();
  const hasList = listDate != null;
  const canEdit = useCanEditEvent();
  const { data: labels = [] } = useEventLabels();
  const updateEvent = useUpdateEvent();

  const [step, setStep] = useState<Step>(
    start ? { kind: "detail", ref: start } : { kind: "list" },
  );
  /** 수정을 연 순간의 일정 — 폼이 이 값으로 시작한다. 다시 받기로 events 가 바뀌어도 친 값을 덮지 않게 붙들어 둔다 */
  const [snapshot, setSnapshot] = useState<CalendarEvent | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const listScroll = useRef(0);
  const lastKey = useRef<string | null>(null);

  const current =
    step.kind === "list" ? undefined : findEvent(events, step.ref);
  // 상세 · 수정이 가리키던 일정이 사라졌다(지움 · 날짜를 옮김) — 폰은 그날 목록, 그 밖은 닫는다
  if (step.kind !== "list" && !current && hasList) {
    setStep({ kind: "list" });
    setSnapshot(null);
  }
  useEffect(() => {
    if (step.kind !== "list" && !current && !hasList) onClose();
  }, [step.kind, current, hasList, onClose]);

  const flow = useEventFormFlow({
    event: snapshot,
    labels,
    isLoading: updateEvent.isPending,
    saveError: updateEvent.isError,
    onSubmit: (data) => {
      if (!snapshot || step.kind !== "edit") return;
      updateEvent.mutate(
        {
          id: snapshot.rowId,
          data: withOpenedOccurrence(data, snapshot),
          // 실패는 폼 Callout 이 알린다 — 전역 토스트(서버 글)가 겹치지 않게 끈다
          silent: true,
        },
        {
          onSuccess: () => {
            // 저장하면 상세로 돌아와 새 값 — 날짜를 옮겨 그 날에 없으면 목록(위의 사라짐 규칙). 넓은 화면의 대화상자는 닫고 보기는 그대로
            if (wide) {
              onClose();
              return;
            }
            leaveEdit({ id: snapshot.rowId, day: data.startDate.slice(0, 10) });
          },
        },
      );
    },
    onDelete: current ? () => onRequestDelete(current) : undefined,
  });

  // 폼 값이 수정할 일정으로 맞춰진 뒤에 칸을 그린다 — 맞춤(reset)보다 칸이 먼저 붙으면 RHF 가 등록을 비워 칸이 빈 채 값이 안 먹는다
  const formReady = !!snapshot && flow.ctrl.isSyncedWith(snapshot);

  const leaveEdit = (ref?: EventRef) => {
    const back = ref ?? (step.kind === "edit" ? step.ref : null);
    setSnapshot(null);
    flow.resetScreen();
    setStep(back ? { kind: "detail", ref: back } : { kind: "list" });
  };
  const editLeave = useLeaveConfirm({
    dirty: flow.dirty,
    leave: () => {
      // 넓은 화면의 "자세히" 는 돌아갈 상세가 없다 — 닫는다
      if (wide) onClose();
      else leaveEdit();
    },
    contentRef,
  });

  const openDetail = (e: IEvent, el: HTMLElement) => {
    const body = el.closest("[data-slot=bottom-sheet-body]");
    listScroll.current = body?.scrollTop ?? 0;
    lastKey.current = eventKey(e);
    setStep({ kind: "detail", ref: refOf(e) });
  };
  const toList = () => setStep({ kind: "list" });
  const startEdit = () => {
    if (!current) return;
    // 지난 저장 실패의 알림이 다시 연 폼에 남지 않게 — 훅은 시트 수명 동안 살아 있어 isError 가 다음 저장까지 참이다
    updateEvent.reset();
    setSnapshot(iEventToCalendarEvent(current));
    flow.resetScreen();
    setStep({ kind: "edit", ref: refOf(current) });
  };

  /** ← · Esc · 기기 뒤로 가기 — 한 단계 뒤 */
  const stepBack = () => {
    if (step.kind === "edit") {
      if (flow.inStep) flow.requestCancelStep();
      else editLeave.request();
    } else if (step.kind === "detail" && hasList) toList();
    else onClose();
  };

  // 기기 뒤로 가기 — 단계마다 히스토리 칸을 하나 더 쌓아 시트 전체가 닫히지 않고 이 단계만 되돌린다.
  // (시트 자체의 칸은 ds Bottom Sheet 가 쌓는다) 폼 단계는 바뀐 값을 묻는다 — 묻고만 끝났으면 칸을 다시 쌓는다.
  useStepBack(!wide && hasList && step.kind !== "list" && !!current, () => {
    toList();
    return true;
  });
  useBackClose(!wide && step.kind === "edit" && !!current, (keep) => {
    if (!editLeave.request()) keep();
  });

  // 단계가 바뀔 때 초점 — 상세로 들어가면 제목, 목록으로 돌아오면 연 줄
  useEffect(() => {
    if (step.kind === "detail")
      titleRef.current?.focus({ preventScroll: true });
  }, [step.kind]);
  useLayoutEffect(() => {
    if (step.kind !== "list") return;
    const body = contentRef.current?.querySelector(
      "[data-slot=bottom-sheet-body]",
    );
    if (body) body.scrollTop = listScroll.current;
    if (lastKey.current) {
      contentRef.current
        ?.querySelector<HTMLElement>(`[data-event-key="${lastKey.current}"]`)
        ?.focus({ preventScroll: true });
    }
  }, [step.kind]);

  const editable = current ? canEdit(current) : false;

  // ── 1280 이상: 상세는 대화상자(주 · 일 · 목록) 또는 그날 패널(월 보기), 수정은 "자세히" 대화상자
  if (wide) {
    if (step.kind === "edit") {
      return (
        <>
          <Dialog
            open
            form
            dirty={flow.dirty}
            onOpenChange={(next) => {
              if (!next) onClose();
            }}
          >
            <EventFormDialogPanel flow={flow} />
          </Dialog>
          {editLeave.node}
        </>
      );
    }
    if (step.kind === "detail" && current && wideDetail === "dialog") {
      return (
        <Dialog
          open
          onOpenChange={(next) => {
            if (!next) onClose();
          }}
        >
          <DialogContent
            title={t("eventDetail")}
            aria-describedby={undefined}
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              titleRef.current?.focus({ preventScroll: true });
            }}
          >
            <DialogBody scrollFog>
              <div className="-mx-x6">
                <EventDetailBody event={current} titleRef={titleRef} />
              </div>
            </DialogBody>
            {editable && (
              <DialogFooter>
                <Button
                  variant="ghost"
                  ghostColor="critical"
                  className="mr-auto"
                  onClick={() => onRequestDelete(current)}
                >
                  {tc("delete")}
                </Button>
                <Button onClick={startEdit}>{tc("edit")}</Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      );
    }
    return null;
  }

  // ── 1280 미만: 한 시트 안에서 단계가 바뀐다
  const inEdit = step.kind === "edit" && !!current;

  const sheetProps = {
    ref: contentRef as RefObject<HTMLDivElement>,
    "aria-describedby": undefined,
    // Esc 는 한 단계 뒤 — 시트 전체를 닫는 건 닫기 원 · 바깥 · 끌어내리기
    onEscapeKeyDown: (e: KeyboardEvent) => {
      e.preventDefault();
      stepBack();
    },
  } as const;

  return (
    <>
      <BottomSheet
        open
        form={inEdit}
        dirty={inEdit && flow.dirty && !flow.inStep}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        {inEdit ? (
          <BottomSheetContent
            {...sheetProps}
            {...formSheetContentProps(flow, t, () => void editLeave.request())}
          >
            {formReady && <EventFormSheetChildren key="edit" flow={flow} />}
          </BottomSheetContent>
        ) : step.kind === "detail" && current ? (
          <BottomSheetContent
            {...sheetProps}
            title={t("eventDetail")}
            onBack={hasList ? toList : undefined}
          >
            <BottomSheetBody key="detail" scrollFog>
              <div className="-mx-x6">
                <EventDetailBody event={current} titleRef={titleRef} />
              </div>
            </BottomSheetBody>
            {editable && (
              <BottomSheetFooter>
                <Button
                  variant="ghost"
                  ghostColor="critical"
                  onClick={() => onRequestDelete(current)}
                >
                  {tc("delete")}
                </Button>
                <Button onClick={startEdit}>{tc("edit")}</Button>
              </BottomSheetFooter>
            )}
          </BottomSheetContent>
        ) : (
          listDate && (
            <BottomSheetContent
              {...sheetProps}
              title={formatMonthDayDow(listDate)}
            >
              <BottomSheetBody key="list" scrollFog>
                {events.length === 0 ? (
                  <p
                    data-slot="day-sheet-empty"
                    className="m-0 py-x8 text-center text-t4 text-fg-neutral-subtle"
                  >
                    {t("noEvents")}
                  </p>
                ) : (
                  <div data-slot="day-sheet-list" className="-mx-x6">
                    <DayEventList
                      events={events}
                      label={formatMonthDayDow(listDate)}
                      onTapEvent={openDetail}
                    />
                  </div>
                )}
              </BottomSheetBody>
              <BottomSheetFooter>
                <Button onClick={onAdd}>{t("addEvent")}</Button>
              </BottomSheetFooter>
            </BottomSheetContent>
          )
        )}
      </BottomSheet>
      {editLeave.node}
    </>
  );
}
