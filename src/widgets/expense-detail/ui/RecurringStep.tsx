import { useTranslation } from "react-i18next";

import { Button } from "@/shared/ds/button";
import { useWideSurface } from "@/shared/ds/overlay";
import type { RecurringForm } from "@/features/recurring-transaction/ui/use-recurring-form";
import type { TxEmbedParts } from "@/widgets/add-tx";

/**
 * 반복 설정 단계 (I-21 H 44 · 45) — 거래 상세 안 한 단계. 폼 몸 · 칸 · 검증 · 저장은 반복 거래 폼(I-20 D 26 ~ 29)이고,
 * 이 파일은 그 폼을 상세 표면의 머리 · 바닥에 맞춰 준다. 연결된 반복이 있으면 그 반복의 수정 폼이다.
 */
export function useRecurringStepParts(
  form: RecurringForm,
  onExit: () => void,
): TxEmbedParts {
  const { t: tc } = useTranslation("common");
  const wide = useWideSurface();
  const { inStep, isEdit } = form;
  const primaryLabel = isEdit ? tc("save") : tc("add");
  const primary = inStep ? null : (
    <Button
      variant="neutralSolid"
      loading={form.submitting}
      onClick={() => void form.save()}
    >
      {primaryLabel}
    </Button>
  );
  return {
    title: inStep
      ? form.stepTitle[form.step as Exclude<typeof form.step, "list">]
      : form.heading,
    body: form.body,
    primary,
    footer: (requestBack) =>
      wide ? (
        <>
          <Button variant="neutralWeak" onClick={requestBack}>
            {tc("cancel")}
          </Button>
          {inStep ? (
            <Button onClick={form.confirmStep}>{tc("done")}</Button>
          ) : (
            primary
          )}
        </>
      ) : (
        primary
      ),
    dirty: inStep ? form.stepDirty : form.dirty,
    dirtyAll: form.dirty || form.stepDirty,
    onBack: () => {
      if (form.submitting) return;
      if (inStep) form.exitStep();
      else onExit();
    },
    inSub: inStep,
    onDone: form.confirmStep,
    busy: form.submitting,
    overlays: null,
    bodyRef: { current: null },
  };
}
