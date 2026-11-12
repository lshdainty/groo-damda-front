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

/**
 * 초대 코드 = 대문자 16진 32자(128비트, 서버 `UserCalendar` 가 공유를 켤 때 만든다). 손으로 치기보다 받은 코드를
 * 붙여 넣는 칸이다 — 붙여 넣으며 섞인 공백 · 하이픈은 걷고(영문 · 숫자만) 32자에서 멈춘다(보안 점검 DAM-4).
 */
export const INVITE_CODE_MAX = 32;

type JoinErrorKey =
  | "codeRequired"
  | "codeInvalid"
  | "codeAlreadyJoined"
  | "codeRateLimited"
  | "joinFailed";

/**
 * 서버 오류 코드(`CAL_012` 틀린 코드 · `CAL_011` 이미 참여 · `CAL_017` 틀린 시도 한도)만 읽는다 — 글이 아니라 코드로 가른다.
 * 그 밖은 일반 한 문장
 */
function joinErrorKey(err: unknown): JoinErrorKey {
  const data = (
    err as { response?: { data?: { code?: unknown; message?: unknown } } }
  )?.response?.data;
  const hit = [data?.code, data?.message].find(
    (v) => v === "CAL_012" || v === "CAL_011" || v === "CAL_017",
  );
  if (hit === "CAL_012") return "codeInvalid";
  if (hit === "CAL_011") return "codeAlreadyJoined";
  if (hit === "CAL_017") return "codeRateLimited";
  return "joinFailed";
}

/**
 * 초대 코드로 참여(I-09b 36) — Responsive Dialog 입력 폼, 칸 하나. 보이는 이름 "초대 코드"(칸이 하나뿐) + 안내 "받은 초대 코드를 붙여 넣으세요".
 * 비운 채 누르면 · 틀린 코드 · 이미 참여한 캘린더 · 틀린 시도 한도 · 그 밖의 실패는 칸 아래 고정 글 한 줄(서버가 보낸 글은 화면에 내지 않는다 — 이 요청은 전역 오류 알림도 끈다).
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
  // 칸 아래 오류 글의 키 — 비운 채 · 틀린 코드(CAL_012) · 이미 참여(CAL_011) · 한도(CAL_017) · 그 밖(5xx · 네트워크). 서버가 보낸 글은 내지 않는다
  const [errorKey, setErrorKey] = useState<JoinErrorKey | null>(null);
  const inFlight = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (inFlight.current) return;
    const value = code.trim();
    if (!value) {
      setErrorKey("codeRequired");
      inputRef.current?.focus();
      return;
    }
    inFlight.current = true;
    setErrorKey(null);
    try {
      const joined = await joinMut.mutateAsync(value.toUpperCase());
      snackbar.show({
        message: t("shareSection.joinedNamed", { name: joined.calendarName }),
      });
      onClose();
    } catch (e) {
      setErrorKey(joinErrorKey(e));
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
      busy={joinMut.isPending}
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
            invalid={errorKey != null}
            errorMessage={errorKey ? t(`shareSection.${errorKey}`) : null}
          >
            <Input
              ref={inputRef}
              value={code}
              // 칸의 maxLength 는 거르기 전 글자에 걸린다 — 공백 · 하이픈이 섞인 코드를 붙여 넣으면 뒷부분이 잘리므로
              // 넉넉히 두고, 32자 자르기는 아래 onChange 가 거른 뒤에 한다
              maxLength={INVITE_CODE_MAX * 2}
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
                if (errorKey) setErrorKey(null);
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
