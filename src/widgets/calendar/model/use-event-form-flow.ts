import { useEffect, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";

import { useLeaveConfirm } from "@/shared/ds/alert-dialog";
import { useWideSurface } from "@/shared/ds/overlay";
import {
  useEventForm,
  type EventFormInitial,
} from "@/widgets/calendar/model/use-event-form";
import { useStepBack } from "@/widgets/calendar/model/use-step-back";
import type { EventFormView } from "@/widgets/calendar/ui/event-form/types";

import type {
  CalendarEvent,
  CalendarEventFormValues,
} from "@/entities/calendar";
import type { EventLabel } from "@/entities/event-label";

// 묻기 전 초점 자리가 사라졌을 때 돌아갈 표면 — 없다(초점은 묻기 전 자리로만 돌아간다). 렌더 안에서 ref 모양 객체를 만들면 react-hooks/refs 가 막아 모듈에 둔다
const NO_FALLBACK_SURFACE: RefObject<HTMLElement | null> = { current: null };

export type EventFormStep = "list" | "location" | "description";

export interface EventFormFlowArgs {
  event?: CalendarEvent | null;
  selectedDate?: Date;
  selectedEndDate?: Date;
  initial?: EventFormInitial;
  labels?: EventLabel[];
  isLoading?: boolean;
  /** 빠른 추가에서 쓴 값을 들고 왔다 — 그 값도 "바뀐 값" 으로 쳐서 닫을 때 묻는다(RHF 기본값이 되어 isDirty 가 false 이므로) */
  initialDirty?: boolean;
  /** 저장(추가 · 수정)이 실패했다 — 폼 맨 위에 critical Callout(고정 문구), 폼은 열려 있고 입력값은 그대로 */
  saveError?: boolean;
  onSubmit: (data: CalendarEventFormValues) => void;
  /** 수정 모드 삭제 — 제공 시 바닥 왼쪽에 [삭제]. 확인창은 부르는 쪽이 연다 */
  onDelete?: () => void;
}

/**
 * 일정 폼의 화면 상태 (I-09 29 · 36) — 폼 값(`useEventForm`)에 [저장] 뒤 오류 보이기 · 장소 / 설명 한 단계 · 바뀐 값(dirty)을 더한 것.
 * 표면(1280 미만 시트 · 이상 "자세히" 대화상자)은 이 값을 읽기만 한다. 그래서 창 폭이 1280 을 넘나들어도 값이 남고,
 * 시트를 부모가 들고 있는 자리(일정 상세가 든 시트)도 같은 값으로 폼 단계를 그릴 수 있다.
 */
export function useEventFormFlow({
  event,
  selectedDate,
  selectedEndDate,
  initial,
  labels = [],
  initialDirty = false,
  isLoading,
  saveError = false,
  onSubmit,
  onDelete,
}: EventFormFlowArgs) {
  const { t } = useTranslation("calendar");
  const wide = useWideSurface();
  const ctrl = useEventForm({
    event,
    selectedDate,
    selectedEndDate,
    initial,
    onSubmit,
  });
  const { form, title, dateRangeInvalid, onFormSubmit, handleSubmit } = ctrl;

  const [showErrors, setShowErrors] = useState(false);
  const [step, setStep] = useState<EventFormStep>("list");
  const [draft, setDraft] = useState("");
  const [stepOrigin, setStepOrigin] = useState("");
  const endRef = useRef<HTMLButtonElement>(null);
  // 요소는 상태로 든다(콜백 ref = 상태 설정자) — ref 객체를 이 훅이 돌려주면 받는 쪽이 렌더 중 ref 를 읽는 것으로 잡힌다(react-hooks/refs)
  const [errorEl, setErrorEl] = useState<HTMLDivElement | null>(null);

  const titleEmpty = !title;
  const rangeError = showErrors && dateRangeInvalid;
  const dirty = form.formState.isDirty || initialDirty;

  const view: EventFormView = {
    ctrl,
    labels,
    showErrors,
    titleEmpty,
    rangeError,
    endRef,
  };

  const save = () => {
    if (isLoading) return;
    setShowErrors(true);
    // 첫 오류 칸으로 — 제목 → 종료
    if (titleEmpty) {
      form.setFocus("title");
      return;
    }
    if (dateRangeInvalid) {
      endRef.current?.focus();
      return;
    }
    void handleSubmit(onFormSubmit)();
  };

  const heading = event ? t("editEvent") : t("addEvent");
  const del = event && onDelete ? onDelete : undefined;

  // 장소 · 설명 한 단계
  const enterStep = (next: "location" | "description") => {
    const origin =
      (next === "location" ? ctrl.location : ctrl.description) ?? "";
    setDraft(origin);
    setStepOrigin(origin);
    setStep(next);
  };
  const confirmStep = () => {
    if (step !== "list") {
      form.setValue(step, draft, { shouldDirty: true });
    }
    setStep("list");
  };
  const cancelStep = () => setStep("list");
  // ← · 기기 뒤로 가기 · Esc — 친 글이 들어올 때와 다르면 "작성한 내용이 사라져요" 를 묻고, 같으면 묻지 않는다. "완료" 는 묻지 않는다.
  // 물었으면(false) 칸을 다시 쌓아 [계속 작성] 뒤에도 뒤로 가기가 이 단계로 온다
  const leave = useLeaveConfirm({
    dirty: step !== "list" && draft !== stepOrigin,
    leave: cancelStep,
    contentRef: NO_FALLBACK_SURFACE,
  });
  const requestCancelStep = () => leave.request();
  useStepBack(!wide && step !== "list", requestCancelStep);

  // 실패하면 폼 맨 위로 — 아래까지 내려온 채 저장했을 때 위의 알림이 화면 밖에 있지 않게(snackbar.md:75)
  useEffect(() => {
    if (saveError) errorEl?.scrollIntoView({ block: "nearest" });
  }, [saveError, errorEl]);

  // 새 일정은 제목에 초점. 표면의 열림 초점(Radix onOpenAutoFocus)에서 기본(표면 자신)을 막고 제목 칸에 직접 준다 — 수정으로 열 때는 주지 않는다(표면이 받는다)
  const focusTitleOnOpen = (e: Event) => {
    // 수정으로 열 때는 막지 않는다 — 기본 동작(표면 자신이 초점을 받는다)을 그대로 둔다. 막으면 초점이 어디에도 안 간다
    if (event) return;
    e.preventDefault();
    const root = e.target instanceof HTMLElement ? e.target : document;
    const input = root.querySelector<HTMLInputElement>('input[name="title"]');
    if (input) input.focus({ preventScroll: true });
    else form.setFocus("title");
  };

  /** 다시 열 때 오류 · 단계를 처음으로 */
  const resetScreen = () => {
    setShowErrors(false);
    setStep("list");
    setDraft("");
  };

  return {
    ctrl,
    view,
    dirty,
    step,
    inStep: step !== "list",
    draft,
    setDraft,
    save,
    heading,
    isNew: !event,
    saveError,
    focusTitleOnOpen,
    del,
    isLoading,
    enterStep,
    confirmStep,
    cancelStep,
    leaveNode: leave.node,
    requestCancelStep,
    setErrorEl,
    resetScreen,
  };
}

export type EventFormFlow = ReturnType<typeof useEventFormFlow>;
