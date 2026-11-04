import { useRef } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/shared/ds/button";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogCancel,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
} from "@/shared/ds/dialog";
import { useLeaveConfirm } from "@/shared/ds/alert-dialog";
import { useBackClose, useWideSurface } from "@/shared/ds/overlay";
import {
  useRecurringForm,
  type RecurringFormProps,
} from "./use-recurring-form";

/** 반복 거래 추가 · 수정 — 자기 표면(시트 · 대화상자)을 가진 껍데기 */
export function RecurringAddDialog(props: RecurringFormProps) {
  const { t: tc } = useTranslation("common");
  const form = useRecurringForm(props);
  const contentRef = useRef<HTMLDivElement>(null);
  const wide = useWideSurface();
  const { inStep, isEdit, stepDirty } = form;
  const leave = useLeaveConfirm({
    dirty: stepDirty,
    leave: form.exitStep,
    contentRef,
  });
  // 기기 뒤로 가기 = 한 단계 뒤(시트 전체가 닫히지 않는다). 바뀐 글이 있어 물었으면 칸을 다시 쌓는다
  useBackClose(inStep, (keep) => {
    if (!leave.request()) keep();
  });
  // 열릴 때 금액 칸에 초점(처음 열 때만 — 수정은 표면이 받는다)
  const focusOnOpen = (e: Event) => {
    if (isEdit) return;
    e.preventDefault();
    form.focusAmount();
  };
  const doneButton = (
    <Button
      variant="ghost"
      ghostColor="neutral"
      size="small"
      className="font-bold"
      onClick={form.confirmStep}
    >
      {tc("done")}
    </Button>
  );
  return (
    <ResponsiveDialog
      open
      form
      dirty={form.dirty && !inStep}
      onOpenChange={(next) => {
        if (next) return;
        if (inStep) void leave.request();
        else props.onClose();
      }}
    >
      <ResponsiveDialogContent
        ref={contentRef}
        title={
          inStep
            ? form.stepTitle[form.step as Exclude<typeof form.step, "list">]
            : form.heading
        }
        aria-describedby={undefined}
        showCloseButton={!inStep}
        onBack={inStep ? () => void leave.request() : undefined}
        headerAction={inStep && wide ? doneButton : undefined}
        onOpenAutoFocus={focusOnOpen}
      >
        {leave.node}
        {/* 시트는 닫기 원이 없는 머리 오른쪽 끝(화면 여백 24 안쪽 8)에 "완료" — 대화상자는 ds 머리 동작 자리 */}
        {inStep && !wide && (
          <div className="absolute right-[calc(var(--spacing-global-gutter)-8px)] top-[calc(var(--spacing-x6)+14px)] z-1 -translate-y-1/2">
            {doneButton}
          </div>
        )}
        <ResponsiveDialogBody scrollFog={form.bodyFog}>
          {form.body}
        </ResponsiveDialogBody>
        {form.step === "list" && (
          <ResponsiveDialogFooter>
            <ResponsiveDialogCancel>{tc("cancel")}</ResponsiveDialogCancel>
            <Button loading={form.submitting} onClick={form.save}>
              {isEdit ? tc("save") : tc("add")}
            </Button>
          </ResponsiveDialogFooter>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
