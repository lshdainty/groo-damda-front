import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ds/button";
import { Field } from "@/shared/ds/field";
import { Input } from "@/shared/ds/input";
import { InputOTP, InputOTPResend } from "@/shared/ds/input-otp";
import type { Reauth } from "../model/useReauth";

/**
 * 본인 확인 칸 — 비밀번호, 또는 (비밀번호가 없는 소셜 전용 계정이면) 메일 코드.
 *
 * <p>해지 · 소셜 연동이 같은 모양으로 묻는다. 상태와 확인은 `useReauth` 가 들고, 이 컴포넌트는
 * 그리기만 한다 — 바닥 버튼(확인 · 뒤로)은 부르는 표면의 몫이다.
 */
export function ReauthFields({ reauth }: { reauth: Reauth }) {
  const { t } = useTranslation("user");
  const {
    method,
    switchMethod,
    password,
    changePassword,
    code,
    changeCode,
    error,
    sentAt,
    onSendCode,
    passwordId,
    codeId,
  } = reauth;

  return (
    <div className="flex flex-col gap-x4">
      {method === "password" ? (
        <>
          <Field
            label={t("currentPassword")}
            invalid={!!error}
            errorMessage={error}
          >
            <Input
              id={passwordId}
              type="password"
              autoComplete="current-password"
              value={password}
              placeholder={t("currentPasswordPlaceholder")}
              onChange={(e) => changePassword(e.target.value)}
            />
          </Field>
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="small"
              onClick={() => switchMethod("emailCode")}
            >
              {t("withdraw.useEmailCode")}
            </Button>
          </div>
        </>
      ) : (
        <>
          {/* 칸 → [코드 받기] 12(input-otp.md ⓓ · 예제 mt-x3) — 본문 쌓기(16)와 따로 묶는다 */}
          <div className="flex flex-col items-start gap-x3">
            <Field
              label={t("withdraw.codeLabel")}
              description={t("withdraw.codeRule")}
              invalid={!!error}
              errorMessage={error}
            >
              <InputOTP
                id={codeId}
                value={code}
                placeholder={t("withdraw.codePlaceholder")}
                onValueChange={changeCode}
              />
            </Field>
            <InputOTPResend
              sentAt={sentAt}
              codeInputId={codeId}
              onResend={onSendCode}
            />
            {/* 스팸함 안내 — input-otp.md 해부에 없는 줄이지만 사용자 결정(10-24) 05-2 Q1 A 로 남긴다. 코드를 보낸 뒤에만 보인다
                (보내기 전에는 확인할 메일이 없다). 오류 때도 남는다 */}
            {sentAt != null && (
              <>
                <p role="status" className="m-0 text-t4 text-fg-neutral">
                  {t("withdraw.codeSent")}
                </p>
                <p className="m-0 text-t4 text-fg-neutral-subtle">
                  {t("withdraw.codeHint")}
                </p>
              </>
            )}
          </div>
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="small"
              onClick={() => switchMethod("password")}
            >
              {t("withdraw.usePassword")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
