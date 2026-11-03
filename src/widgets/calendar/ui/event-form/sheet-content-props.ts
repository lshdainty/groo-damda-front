import type { EventFormFlow } from "@/widgets/calendar/model/use-event-form-flow";

/**
 * 일정 폼의 시트 머리 값 — `BottomSheetContent` 에 펼친다. 일정 상세가 든 시트(`EventDetailSurface`)는 목록 · 상세 · 폼 단계가 **같은 `BottomSheetContent`**
 * 를 쓰고 안쪽만 바꾼다(요소 종류가 다르면 React 가 시트 바탕째 다시 붙여 시트가 바닥에서 다시 올라오고 딤이 0 에서 시작한다 — I-09b 1-A "같은 자리에서").
 */
export function formSheetContentProps(
  flow: EventFormFlow,
  t: (key: string) => string,
  onStepBack?: () => void,
) {
  const { step, inStep, heading, requestCancelStep, focusTitleOnOpen } = flow;
  return {
    title: inStep ? t(`form.${step}`) : heading,
    showCloseButton: !inStep,
    // 폼 단계(줄 칸)의 머리 ← 는 부르는 쪽이 준다(일정 상세에서 상세로). 장소 · 설명 안 단계의 ← 는 늘 있다
    onBack: inStep ? () => void requestCancelStep() : onStepBack,
    onOpenAutoFocus: focusTitleOnOpen,
  };
}
