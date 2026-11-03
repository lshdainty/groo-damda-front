import { useEffect, useRef } from "react";
import { ResponsiveDialogBody } from "@/shared/ds/dialog";
import { FormFooter } from "@/shared/ui/groo/form-footer";
import type { AssetForm } from "./use-asset-form";
import { KindField } from "./KindField";
import { AccountFields } from "./AccountFields";
import { CardFields } from "./CardFields";
import { InvestFields } from "./InvestFields";
import { CheckRows } from "./CheckRows";
import { focusNameField } from "./focus";

/**
 * 추가 · 수정 2단계(I-17 B · C) — 그 종류의 칸만. 칸 사이 24(Field ↔ Field), 마지막 칸 ↔ 체크 줄 둘은 한 면 안 16(T14).
 * 바닥은 [추가] · [저장] — 늘 켜 둔다. 필수가 비면 누를 때 칸마다 오류(껍데기 `attemptSubmit`). 열리면 첫 칸에 초점.
 */
export function FormStep({
  f,
  onSubmit,
  isSubmitting,
}: {
  f: AssetForm;
  onSubmit: () => void;
  isSubmitting?: boolean;
}) {
  const { t, tCommon, isNew, editingGroup, submitTick } = f;
  const bodyRef = useRef<HTMLDivElement>(null);
  // 새 자산은 2단계에 들어가면 이름 칸에 초점 — 수정은 표면이 받는다(폰에서 키보드가 가리지 않게)
  useEffect(() => {
    if (isNew) focusNameField(bodyRef.current);
  }, [isNew]);
  // 못 보낸 채 [추가] · [저장] 을 누르면 첫 오류 칸으로
  useEffect(() => {
    if (submitTick === 0) return;
    bodyRef.current
      ?.querySelector<HTMLElement>('[aria-invalid="true"]')
      ?.focus({ preventScroll: false });
  }, [submitTick]);
  return (
    <>
      <ResponsiveDialogBody ref={bodyRef} scrollFog>
        <div className="flex flex-col gap-x6 pb-x2">
          <KindField f={f} />
          {editingGroup === "card" ? (
            <CardFields f={f} />
          ) : editingGroup === "invest" ? (
            <InvestFields f={f} />
          ) : (
            <AccountFields f={f} />
          )}
        </div>
        <CheckRows f={f} />
      </ResponsiveDialogBody>
      <FormFooter
        cancelLabel={tCommon("cancel")}
        submitLabel={isNew ? t("addAction") : tCommon("save")}
        loading={isSubmitting}
        onSubmit={onSubmit}
      />
    </>
  );
}
