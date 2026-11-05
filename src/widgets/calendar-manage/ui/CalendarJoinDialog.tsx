import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
} from "@/shared/ds/dialog";
import { Field } from "@/shared/ds/field";
import { Input } from "@/shared/ds/input";
import { useSnackbar } from "@/shared/ds/snackbar";
import { isEnterSave } from "@/shared/lib/groo/enter-save";
import { FormFooter } from "@/shared/ui/groo/form-footer";
import { useJoinCalendar } from "@/features/user-calendar";

/** 초대 코드 = 대문자 16진 8자(서버 `UserCalendar` 가 만든다). 칸은 영문 · 숫자만 받고 8자에서 멈춘다 */
export const INVITE_CODE_MAX = 8;

/**
 * 초대 코드로 참여(I-09b 36) — Responsive Dialog 입력 폼, 칸 하나. 보이는 이름 "초대 코드"(칸이 하나뿐) + 예시 "예: 3F9A1C2B".
 * 틀린 코드 · 이미 참여한 캘린더는 칸 아래 고정 글 한 줄(서버가 보낸 글은 화면에 내지 않는다 — 이 요청은 전역 오류 알림도 끈다).
 * 성공하면 닫고 스낵바 "'{이름}' 캘린더에 참여했어요".
 *
 * **연타 가드는 문이 아니라 나가는 함수가 든다** — 버튼 · Enter 둘이 모두 `submit` 을 지나고, `submit` 이 이미 나가 있으면 무시한다
 * (코드를 넣고 Enter 를 다섯 번 눌러 참여 요청이 다섯 번 나갔다 — QA #134, `shared/lib/groo/enter-save.ts`).
 */
export function CalendarJoinDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("calendar");
  const { t: tc } = useTranslation("common");
  const snackbar = useSnackbar();
  const joinMut = useJoinCalendar();
  const [code, setCode] = useState("");
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (inFlight.current) return;
    const value = code.trim();
    if (!value) {
      inputRef.current?.focus();
      return;
    }
    inFlight.current = true;
    setFailed(false);
    try {
      const joined = await joinMut.mutateAsync(value.toUpperCase());
      snackbar.show({
        message: t("shareSection.joinedNamed", { name: joined.calendarName }),
      });
      onClose();
    } catch {
      setFailed(true);
      inputRef.current?.focus();
    } finally {
      inFlight.current = false;
    }
  };

  return (
    <ResponsiveDialog
      open
      form
      dirty={code !== ""}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <ResponsiveDialogContent
        title={t("joinByCode")}
        aria-describedby={undefined}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus({ preventScroll: true });
        }}
      >
        <ResponsiveDialogBody>
          <Field
            label={t("inviteCode")}
            invalid={failed}
            errorMessage={t("shareSection.codeInvalid")}
          >
            <Input
              ref={inputRef}
              value={code}
              maxLength={INVITE_CODE_MAX}
              placeholder={t("shareSection.joinCodePlaceholder")}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              onChange={(e) => {
                setCode(
                  e.target.value
                    .replace(/[^A-Za-z0-9]/g, "")
                    .slice(0, INVITE_CODE_MAX)
                    .toUpperCase(),
                );
                if (failed) setFailed(false);
              }}
              // Enter 로 참여 — 한글 조합 중 Enter · 포털 안의 칸은 거른다(isEnterSave)
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
          submitLabel={t("join")}
          loading={joinMut.isPending}
          onSubmit={() => void submit()}
        />
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
