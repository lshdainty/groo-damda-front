import { useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  passwordChangeErrorKey,
  useChangePasswordMutation,
} from "@/features/user";
import { Button } from "@/shared/ds/button";
import { Callout } from "@/shared/ds/callout";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogCancel,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
} from "@/shared/ds/dialog";
import { Field } from "@/shared/ds/field";
import { useScrollToError } from "@/features/expense/model/useScrollToError";
import { Input } from "@/shared/ds/input";
import { PASSWORD_RULES, isPasswordValid } from "@/shared/lib";

interface PasswordChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * 비밀번호 바꾸기(I-14 14 ~ 16) — ds Responsive Dialog 입력 폼. 1280 이상 대화상자 480(바닥 [취소] [저장]) · 미만 시트(위 닫기 원 + 바닥 [저장]).
 * 칸 셋은 필수 표시도 자리 글도 없다(셋 모두 필수라 표시하지 않고, 조건은 새 비밀번호 아래 체크 줄이 말한다).
 * [저장]은 네 조건(현재 칸 값 · 조건 충족 · 확인 일치 · 현재와 다름)이 맞을 때만 눌린다. 실패 글은 서버 글이 아니라 고정 글이다 —
 * 현재 비밀번호가 틀리면(USER_003) 그 칸 오류, 그 밖은 본문 맨 위 Callout.
 * 열려 있는 동안에만 마운트되므로(부르는 쪽이 조건부로 그린다) 칸 값은 처음부터 빈 값으로 서고 reset 이 따로 필요 없다.
 */
export const PasswordChangeDialog = ({
  onOpenChange,
}: PasswordChangeDialogProps) => {
  const { t } = useTranslation("user");
  const { t: tc } = useTranslation("common");
  const changePasswordMutation = useChangePasswordMutation();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  // 현재 비밀번호가 틀렸다는 서버 판정 — 그 칸 값을 고치면 걷는다
  const [currentWrong, setCurrentWrong] = useState(false);
  const [failed, setFailed] = useState(false);
  // 실패마다 새로 생기는 값 — 같은 실패가 이어져도 Callout 을 보이는 자리로 다시 올린다
  const [failedAt, setFailedAt] = useState(0);
  // 글자를 키우거나 키보드가 올라와 본문이 스크롤될 때, 아래 [저장] 을 눌러 실패하면 맨 위 Callout 이 화면 밖이다(폼 저장 실패 규칙)
  const failedRef = useScrollToError<HTMLDivElement>(failed, failedAt);
  const currentRef = useRef<HTMLInputElement>(null);

  const rulesOk = isPasswordValid(next);
  const sameAsCurrent = next !== "" && current !== "" && next === current;
  const mismatch = confirm !== "" && confirm !== next;
  const canSubmit =
    current !== "" &&
    next !== "" &&
    rulesOk &&
    confirm === next &&
    !sameAsCurrent;
  const dirty = current !== "" || next !== "" || confirm !== "";

  const submit = () => {
    if (!canSubmit || changePasswordMutation.isPending) return;
    setFailed(false);
    // 다시 제출하면 지난 판정(현재 비밀번호 틀림)은 걷는다 — 서버 장애로 실패하면 현재 칸 오류와 Callout 이 함께 보이지 않게
    setCurrentWrong(false);
    changePasswordMutation.mutate(
      { currentPassword: current, newPassword: next, confirmPassword: confirm },
      {
        onSuccess: () => {
          toast.success(t("passwordChangeSuccess"), {
            id: "password-change-success",
          });
          onOpenChange(false);
        },
        // 실패 문구는 여기서 정한다 — 요청이 `silent` 라 전역 토스트를 안 탄다(QA #128). 서버 글은 어디에도 내지 않는다.
        onError: (e) => {
          if (passwordChangeErrorKey(e) === "currentPasswordInvalid") {
            setCurrentWrong(true);
            currentRef.current?.focus();
            return;
          }
          setFailed(true);
          setFailedAt((n) => n + 1);
        },
      },
    );
  };

  return (
    <ResponsiveDialog
      open
      form
      dirty={dirty}
      onOpenChange={(o) => {
        if (!o) onOpenChange(false);
      }}
    >
      <ResponsiveDialogContent
        title={t("passwordChange")}
        description={t("passwordChangeDescription")}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          currentRef.current?.focus({ preventScroll: true });
        }}
      >
        <ResponsiveDialogBody>
          <div className="flex flex-col gap-x5">
            {failed && (
              <div ref={failedRef}>
                <Callout tone="critical" role="alert">
                  {t("passwordChangeError")}
                </Callout>
              </div>
            )}
            <Field
              id="currentPassword"
              label={t("currentPassword")}
              invalid={currentWrong}
              errorMessage={t("currentPasswordInvalid")}
            >
              <Input
                ref={currentRef}
                type="password"
                size="large"
                autoComplete="current-password"
                value={current}
                onChange={(e) => {
                  setCurrent(e.target.value);
                  setCurrentWrong(false);
                }}
              />
            </Field>
            <Field
              id="newPassword"
              label={t("newPassword")}
              invalid={sameAsCurrent}
              errorMessage={t("passwordSameAsCurrent")}
              description={next ? <PasswordRules password={next} /> : undefined}
            >
              <Input
                type="password"
                size="large"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
            </Field>
            <Field
              id="confirmPassword"
              label={t("confirmPassword")}
              invalid={mismatch}
              errorMessage={t("passwordMismatch")}
              description={
                confirm !== "" && !mismatch ? (
                  <span className="flex items-center gap-x1 text-fg-positive">
                    <Check aria-hidden className="size-4 shrink-0" />
                    {t("passwordMatched")}
                  </span>
                ) : undefined
              }
            >
              <Input
                type="password"
                size="large"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </Field>
          </div>
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <ResponsiveDialogCancel>{tc("cancel")}</ResponsiveDialogCancel>
          <Button
            disabled={!canSubmit}
            loading={changePasswordMutation.isPending}
            onClick={submit}
          >
            {tc("save")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
};

/** 새 비밀번호 조건 체크 줄 — 충족 `check` · 미달 `x`, 줄 사이 4(값이 있을 때만 부른다) */
function PasswordRules({ password }: { password: string }) {
  const { t } = useTranslation("user");
  return (
    <ul className="m-0 flex list-none flex-col gap-x1 p-0" aria-live="polite">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(password);
        const Icon = ok ? Check : X;
        return (
          <li
            key={rule.key}
            className={`flex items-center gap-x1 ${
              ok ? "text-fg-positive" : "text-fg-neutral-subtle"
            }`}
          >
            <Icon aria-hidden className="size-4 shrink-0" />
            <span>{t(rule.key)}</span>
          </li>
        );
      })}
    </ul>
  );
}
