import { useEffect, useRef } from "react";
import { Callout } from "@/shared/ds/callout";
import { ResponsiveDialogBody } from "@/shared/ds/dialog";
import { useScrollToError } from "@/shared/hooks/useScrollToError";
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
  saveFailed,
  saveError,
  refFailed,
}: {
  f: AssetForm;
  onSubmit: () => void;
  isSubmitting?: boolean;
  /** 저장 요청이 실패했다 — 폼 맨 위 critical Callout(고정 글), 폼은 열린 채 · 쓴 값 그대로 */
  saveFailed?: boolean;
  /** 실패마다 새 값 — 같은 실패가 이어져도 Callout 을 다시 보이게 올린다 */
  saveError?: unknown;
  /** 폼 안 참조 목록을 저장 때 다시 받다 또 실패했다 — 요청은 보내지 않았다. 같은 Callout 자리에 다른 글 */
  refFailed?: boolean;
}) {
  const { t, tCommon, isNew, editingGroup, submitTick } = f;
  const bodyRef = useRef<HTMLDivElement>(null);
  // 본문은 스크롤되고 [저장] 은 바닥이라 내린 채 실패하면 맨 위 Callout 이 가려진다 — 실패하면 올려 보인다
  const errorRef = useScrollToError<HTMLDivElement>(
    !!saveFailed || !!refFailed,
    saveError ?? refFailed,
  );
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
        {(saveFailed || refFailed) && (
          <div ref={errorRef}>
            <Callout tone="critical" role="alert" className="mb-x4">
              {refFailed && !saveFailed
                ? tCommon("query.referenceSaveFailed")
                : t("editDialog.saveFailed")}
            </Callout>
          </div>
        )}
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
