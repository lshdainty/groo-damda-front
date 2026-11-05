import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Palette } from "lucide-react";
import { useScrollToError } from "@/shared/hooks/useScrollToError";
import { Callout } from "@/shared/ds/callout";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
} from "@/shared/ds/dialog";
import { Field } from "@/shared/ds/field";
import { Input } from "@/shared/ds/input";
import { isEnterSave } from "@/shared/lib/groo/enter-save";
import { nameIssue } from "@/shared/lib/groo/name-policy";
import { FormFooter } from "@/shared/ui/groo/form-footer";
import { ColorPickerRow } from "@/shared/ui/groo/icon-color-rows";
import {
  useCreateEventLabel,
  useUpdateEventLabel,
} from "@/features/event-label";
import type { EventLabel } from "@/entities/event-label";
import { nextColorHex } from "../lib/next-color";

/** 라벨 이름 상한 — 목록 줄 한 칸에 들어가는 길이(화면 규칙, 서버 상한은 50). 칸은 12자에서 멈춘다 */
export const LABEL_NAME_MAX = 12;

/**
 * 라벨 추가 · 수정(I-09b 39 · 40) — Responsive Dialog 입력 폼 + 줄 칸: 이름 칸(칸 아래 오른쪽 글자 수 {n}/12) → "색상" 줄. 미리보기는 없다.
 *
 * - 바닥: 시트 = 위 닫기 X + [저장] 하나(수정이면 왼쪽 [삭제]) · 대화상자 = [취소][저장](수정이면 왼쪽 [삭제]). 버튼 글은 동작 이름(추가 / 저장).
 *   [삭제] 는 수정 폼에만 — 눌러 이 폼을 닫고 삭제 확인창으로 간다(`onRequestDelete`). 목록 줄 밀기와 같은 확인창이다.
 * - 처음 색(추가) = 라벨 목록이 아직 쓰지 않은 첫 색. 수정 = 저장된 색을 고른 채(팔레트 밖이면 "지금 색" 칸).
 * - 이름 규칙(40): 12자를 넘게 칠 수 없다(셈은 앞뒤 공백을 뺀 길이). 빈 이름 · 같은 이름은 칸 아래 오류.
 *   이미 저장된 12자 넘는 옛 이름은 **이름을 고치기 전까지** 길이 검사에서 뺀다 — 색만 바꾸려는 사람에게 이름을 줄이라고 하지 않는다(고치기 시작하면 12자).
 * - [저장] 은 켜 두고 누를 때 오류를 보인다. 저장이 실패하면 폼 맨 위 Callout(고정 글)이고 폼은 열려 있다.
 */
export function LabelFormDialog({
  label,
  existing,
  onClose,
  onRequestDelete,
}: {
  label: EventLabel | null;
  existing: EventLabel[];
  onClose: () => void;
  /** 수정 폼 바닥 왼쪽 [삭제] — 새 라벨에는 없다 */
  onRequestDelete?: (label: EventLabel) => void;
}) {
  const { t } = useTranslation("calendar");
  const { t: tc } = useTranslation("common");
  const createMut = useCreateEventLabel({ silent: true });
  const updateMut = useUpdateEventLabel({ silent: true });
  const isNew = !label;
  const [initial] = useState(() => ({
    name: label?.labelName ?? "",
    color: label?.color ?? nextColorHex(existing.map((l) => l.color)),
  }));
  const [name, setName] = useState(initial.name);
  const [color, setColor] = useState(initial.color);
  const [showError, setShowError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saveErrorSeq, setSaveErrorSeq] = useState(0);
  const nameRef = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const errorRef = useScrollToError<HTMLDivElement>(saveError, saveErrorSeq);

  const nameTrim = name.trim();
  const dirty = name !== initial.name || color !== initial.color;

  // 중복은 서버가 409 로 막지만 폼에 아무 표시도 없으면 '버튼이 안 먹는' 것처럼 보였다(QA #55) — 보내기 전에 이 자리에서 알린다
  const rawIssue = nameIssue(
    name,
    LABEL_NAME_MAX,
    existing.filter((l) => l.rowId !== label?.rowId).map((l) => l.labelName),
  );
  // 12자보다 긴 옛 이름은 이름을 고치기 전까지 길이 검사에서 뺀다(추가 폼은 label 이 없어 해당 없음)
  const unchangedName = !!label && nameTrim === label.labelName.trim();
  const issue = unchangedName && rawIssue === "tooLong" ? null : rawIssue;
  const errorText =
    showError && issue
      ? issue === "required"
        ? t("labelsSection.nameRequired")
        : issue === "tooLong"
          ? t("labelsSection.nameTooLong")
          : t("labelsSection.nameDuplicate")
      : null;

  const submit = async () => {
    if (inFlight.current) return;
    if (issue) {
      setShowError(true);
      nameRef.current?.focus();
      return;
    }
    inFlight.current = true;
    setSaveError(false);
    try {
      const values = { labelName: nameTrim, color };
      if (label) await updateMut.mutateAsync({ id: label.rowId, data: values });
      else await createMut.mutateAsync(values);
      onClose();
    } catch {
      setSaveError(true);
      setSaveErrorSeq((n) => n + 1);
    } finally {
      inFlight.current = false;
    }
  };

  return (
    <ResponsiveDialog
      open
      form
      dirty={dirty}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <ResponsiveDialogContent
        title={isNew ? t("newLabel") : t("editLabel")}
        aria-describedby={undefined}
        // 새 폼은 이름 칸에 초점 — 수정은 표면이 받는다(폰에서 키보드가 바로 뜨지 않는다)
        onOpenAutoFocus={
          isNew
            ? (e) => {
                e.preventDefault();
                nameRef.current?.focus({ preventScroll: true });
              }
            : undefined
        }
      >
        <ResponsiveDialogBody>
          {saveError && (
            <div ref={errorRef}>
              <Callout tone="critical" role="alert" className="mb-x4">
                {t("labelsSection.saveFailed")}
              </Callout>
            </div>
          )}
          <Field
            label={t("name")}
            labelHidden
            maxGraphemeCount={LABEL_NAME_MAX}
            invalid={errorText != null}
            errorMessage={errorText}
            className="pb-x2"
          >
            <Input
              ref={nameRef}
              value={name}
              placeholder={t("labelsSection.namePlaceholder")}
              autoComplete="off"
              onChange={(e) => {
                setName(e.target.value);
                if (showError) setShowError(false);
              }}
              onKeyDown={(e) => {
                if (!isEnterSave(e)) return;
                e.preventDefault();
                void submit();
              }}
            />
          </Field>
          <div className="-mx-x6">
            <ColorPickerRow
              title={t("form.color")}
              prefix={<Palette />}
              value={color}
              onChange={setColor}
            />
          </div>
        </ResponsiveDialogBody>
        <FormFooter
          cancelLabel={tc("cancel")}
          submitLabel={isNew ? t("add") : tc("save")}
          loading={createMut.isPending || updateMut.isPending}
          onSubmit={() => void submit()}
          deleteLabel={label && onRequestDelete ? tc("delete") : undefined}
          onDelete={
            label && onRequestDelete ? () => onRequestDelete(label) : undefined
          }
          flushDelete
        />
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
