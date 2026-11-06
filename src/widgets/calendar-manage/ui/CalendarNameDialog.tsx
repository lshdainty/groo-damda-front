import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { FormFooter } from "@/shared/ui/groo/form-footer";
import { useUpdateUserCalendar } from "@/features/user-calendar";
import type { UserCalendar } from "@/entities/user-calendar";
import { CALENDAR_NAME_MAX } from "./CalendarCreateDialog";

/**
 * 캘린더 이름 바꾸기(I-09b 24) — 관리 페이지의 "이름" 줄이 여는 입력 폼. 지금 이름이 채워져 열리고, 저장은 **이름만** 보낸다
 * (서버 `UpdateRequest` 는 보낸 칸만 바꾼다). 비우고 누르면 칸 아래 오류. 저장이 실패하면 폼 맨 위 Callout(고정 글).
 */
export function CalendarNameDialog({
  calendar,
  onClose,
}: {
  calendar: UserCalendar;
  onClose: () => void;
}) {
  const { t } = useTranslation("calendar");
  const { t: tc } = useTranslation("common");
  const updateMut = useUpdateUserCalendar({ silent: true });
  const [name, setName] = useState(calendar.calendarName);
  const [showError, setShowError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saveErrorSeq, setSaveErrorSeq] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const errorRef = useScrollToError<HTMLDivElement>(saveError, saveErrorSeq);

  const nameTrim = name.trim();
  const dirty = name !== calendar.calendarName;

  const submit = async () => {
    if (inFlight.current) return;
    if (!nameTrim) {
      setShowError(true);
      inputRef.current?.focus();
      return;
    }
    // 바뀐 게 없으면 요청 없이 닫는다
    if (nameTrim === calendar.calendarName) {
      onClose();
      return;
    }
    inFlight.current = true;
    setSaveError(false);
    try {
      await updateMut.mutateAsync({
        id: calendar.rowId,
        data: { calendarName: nameTrim },
      });
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
      busy={updateMut.isPending}
    >
      <ResponsiveDialogContent
        title={t("shareSection.renameTitle")}
        aria-describedby={undefined}
        // 지금 이름이 채워져 열린다 — 처음부터 고칠 수 있게 이름 칸에 초점
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus({ preventScroll: true });
        }}
      >
        <ResponsiveDialogBody>
          {saveError && (
            <div ref={errorRef}>
              <Callout tone="critical" role="alert" className="mb-x4">
                {t("shareSection.saveFailed")}
              </Callout>
            </div>
          )}
          <Field
            label={t("shareSection.renameTitle")}
            labelHidden
            invalid={showError && !nameTrim}
            errorMessage={t("shareSection.nameRequired")}
          >
            <Input
              ref={inputRef}
              value={name}
              maxLength={CALENDAR_NAME_MAX}
              placeholder={t("shareSection.namePlaceholder")}
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
        </ResponsiveDialogBody>
        <FormFooter
          cancelLabel={tc("cancel")}
          submitLabel={tc("save")}
          loading={updateMut.isPending}
          onSubmit={() => void submit()}
        />
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
