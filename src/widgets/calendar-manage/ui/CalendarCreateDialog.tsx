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
import { FormFooter } from "@/shared/ui/groo/form-footer";
import { ColorPickerRow } from "@/shared/ui/groo/icon-color-rows";
import { useCreateUserCalendar } from "@/features/user-calendar";
import type { UserCalendar } from "@/entities/user-calendar";
import { nextColorHex } from "../lib/next-color";

/** 캘린더 이름 상한 — 서버 `FieldLimits.NAME_MAX`(캘린더 · 라벨 50). 화면이 더 줄이지 않는다 */
export const CALENDAR_NAME_MAX = 50;

/**
 * 캘린더 추가(I-09b 34 · 35) — Responsive Dialog 입력 폼 + 줄 칸: 이름 칸 → "색상" 줄(누르면 1280 미만 고르기 시트 · 이상 Popover).
 * 처음 색은 내 캘린더가 아직 쓰지 않은 첫 색. [만들기] 는 켜 두고 비운 채 누르면 칸 아래 오류. 저장이 실패하면 폼 맨 위 Callout(고정 글).
 * 만든 뒤 닫힌다 — 목록에 새 줄이 생기는 것이 알림이다.
 */
export function CalendarCreateDialog({
  owned,
  onClose,
}: {
  /** 내가 소유한 캘린더 — 처음 색을 고르는 기준 */
  owned: UserCalendar[];
  onClose: () => void;
}) {
  const { t } = useTranslation("calendar");
  const { t: tc } = useTranslation("common");
  const createMut = useCreateUserCalendar({ silent: true });
  const [initialColor] = useState(() =>
    nextColorHex(owned.map((c) => c.color)),
  );
  const [name, setName] = useState("");
  const [color, setColor] = useState(initialColor);
  const [showError, setShowError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saveErrorSeq, setSaveErrorSeq] = useState(0);
  const nameRef = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const errorRef = useScrollToError<HTMLDivElement>(saveError, saveErrorSeq);

  const nameTrim = name.trim();
  const dirty = name !== "" || color !== initialColor;

  const submit = async () => {
    if (inFlight.current) return;
    if (!nameTrim) {
      setShowError(true);
      nameRef.current?.focus();
      return;
    }
    inFlight.current = true;
    setSaveError(false);
    try {
      await createMut.mutateAsync({ calendarName: nameTrim, color });
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
      busy={createMut.isPending}
    >
      <ResponsiveDialogContent
        title={t("newCalendar")}
        aria-describedby={undefined}
        // 새 폼은 이름 칸에 초점 — 폰에서도 바로 쓸 수 있다
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          nameRef.current?.focus({ preventScroll: true });
        }}
      >
        <ResponsiveDialogBody>
          {saveError && (
            <div ref={errorRef}>
              <Callout tone="critical" role="alert" className="mb-x4">
                {t("shareSection.createFailed")}
              </Callout>
            </div>
          )}
          <Field
            label={t("name")}
            labelHidden
            invalid={showError && !nameTrim}
            errorMessage={t("shareSection.nameRequired")}
            className="pb-x2"
          >
            <Input
              ref={nameRef}
              value={name}
              maxLength={CALENDAR_NAME_MAX}
              placeholder={t("shareSection.createNamePlaceholder")}
              autoComplete="off"
              onChange={(e) => {
                setName(e.target.value);
                if (showError) setShowError(false);
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
          submitLabel={t("shareSection.create")}
          loading={createMut.isPending}
          onSubmit={() => void submit()}
        />
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
