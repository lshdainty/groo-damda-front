import type { RefObject } from "react";

import type { EventLabel } from "@/entities/event-label";
import type { useEventForm } from "@/widgets/calendar/model/use-event-form";

/** 두 표면(시트 · 대화상자)이 함께 읽는 것 — 상태는 `EventForm` 이 한 번 들고 있다(I-09 36) */
export interface EventFormView {
  ctrl: ReturnType<typeof useEventForm>;
  labels: EventLabel[];
  /** 라벨 목록을 값 없이 못 받았다 — 라벨 칸 자리에서 말하고 눌러 다시 받는다(시트 안이라 공용 스낵바가 쉰다) */
  labelsFailed: boolean;
  onRetryLabels: () => void;
  /** [저장] 을 한 번 눌렀다 — 비거나 틀린 칸에 오류를 보인다 */
  showErrors: boolean;
  titleEmpty: boolean;
  /** 끝 < 시작 오류를 보인다 */
  rangeError: boolean;
  endRef: RefObject<HTMLButtonElement | null>;
}

/** 칸 이름 아래 오류 · 설명이 쓰는 글 한 벌을 쓰는 곳에서 t 로 푼다 */
export const NO_LABEL = "__none__";

export function reminderKey(minutes: number): string {
  if (minutes < 60) return `reminder.${minutes}min`;
  if (minutes === 60) return "reminder.1hour";
  if (minutes === 1440) return "reminder.1day";
  return `reminder.${minutes}min`;
}
