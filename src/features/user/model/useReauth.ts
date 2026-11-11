import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ReauthPurpose } from "../api/userApi";
import {
  useSendReauthEmailCodeMutation,
  useVerifyReauthEmailCodeMutation,
  useVerifyReauthPasswordMutation,
} from "./useWithdrawal";

/** 서버 `REAUTH_FAILED`(AUTH_021) — 비밀번호 · 코드가 틀렸거나 지났다. */
const REAUTH_FAILED = "AUTH_021";
/** 서버 `REAUTH_LOCKED`(AUTH_022, 429) — 5번 틀려 잠겼다. 코드를 다시 받아야 풀린다. */
const REAUTH_LOCKED = "AUTH_022";
const errorCode = (e: unknown) =>
  (e as { response?: { data?: { code?: string } } } | null)?.response?.data
    ?.code;

/** 본인 확인 방법. 비밀번호가 없는 소셜 전용 계정은 코드 말고 길이 없다. */
export type ReauthMethod = "password" | "emailCode";

/**
 * 본인 확인(재인증) — 비밀번호 또는 메일 코드로 티켓 한 장을 받는다.
 *
 * <p>해지와 소셜 연동이 같은 칸 · 같은 오류 글로 묻는다. 칸은 `ReauthFields` 가 그리고, 티켓을 받은 뒤
 * 무엇을 할지는 부르는 쪽 몫이다 — 티켓은 10분 · 단회라 받자마자 쓸 곳에 싣고 어디에도 남기지 않는다.
 *
 * <p>글 키가 `withdraw.*` 인 것은 해지에서 먼저 만들어서다. 글 자체는 해지 말이 아니라 두 흐름이 함께
 * 쓴다 — 해지에만 맞는 말은 `failedText`(확인 단계의 네트워크 · 서버 오류 글)로 부르는 쪽이 넘긴다.
 */
export function useReauth({
  purpose,
  idPrefix,
  failedText,
}: {
  /** 티켓을 어디에 쓸지 — 서버가 티켓에 새긴다 */
  purpose: ReauthPurpose;
  /** 칸 id 머리(`<idPrefix>-password` · `<idPrefix>-code`) — 한 화면에 둘이 떠도 겹치지 않게 */
  idPrefix: string;
  /** 확인 단계가 틀림 · 잠김이 아닌 이유(네트워크 · 서버)로 실패했을 때의 글 */
  failedText: string;
}) {
  const { t } = useTranslation("user");
  const [method, setMethod] = useState<ReauthMethod>("password");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<number | null>(null);

  const sendCode = useSendReauthEmailCodeMutation();
  const verifyCode = useVerifyReauthEmailCodeMutation(purpose);
  const verifyPassword = useVerifyReauthPasswordMutation(purpose);

  const passwordId = `${idPrefix}-password`;
  const codeId = `${idPrefix}-code`;

  // 방법을 바꾸면 앞선 오류를 지운다 — 비밀번호가 틀렸다는 빨간 줄이 코드 칸 위에
  // 남아 있으면 무엇이 잘못됐는지 알 수 없다.
  const switchMethod = (next: ReauthMethod) => {
    setMethod(next);
    setError(null);
  };

  const changePassword = (v: string) => {
    setPassword(v);
    setError(null);
  };

  const changeCode = (v: string) => {
    setCode(v);
    setError(null);
  };

  const onSendCode = () => {
    sendCode.mutate(undefined, {
      onError: () => {
        // 확인 실패와 같은 자리에 붙인다 — 한쪽만 토스트로 띄우면 같은 흐름 안에서
        // 오류가 두 가지 방식으로 나타난다. 서버 글 대신 화면 글.
        setError(t("withdraw.sendCodeFailed"));
      },
      onSuccess: () => {
        setSentAt(Date.now());
        setError(null);
        // 대화상자가 열린 채라 스낵바가 아니라 코드 칸 아래 안내 글(role=status)이 말한다
      },
    });
  };

  /**
   * 서버에 보내기 전 칸 검사. 6자리가 안 되면 칸 오류로 알린다(input-otp.md "6자리 전 확인 막힘") —
   * 서버에 보내지 않는다. 통과하면 true.
   */
  const checkInput = () => {
    if (method === "emailCode" && !/^\d{6}$/.test(code)) {
      setError(t("withdraw.codeIncomplete"));
      document.getElementById(codeId)?.focus();
      return false;
    }
    return true;
  };

  /**
   * 확인 → 티켓. 실패하면 칸 밑 글을 세우고 null.
   *
   * <p>본인 확인 실패는 그 칸의 문제다 — 토스트로 띄우면 어느 칸을 고쳐야 하는지 안 보인다. 칸 밑에 붙인다.
   * 서버가 보낸 글을 그대로 보이지 않고 화면 글로 바꾼다(input-otp.md · Writing 오류) — 틀린 코드 · 틀린
   * 비밀번호는 같은 한 문장이고, 네트워크 · 서버 오류는 `failedText` 다.
   */
  const verify = async (): Promise<string | null> => {
    setError(null);
    try {
      return method === "password"
        ? await verifyPassword.mutateAsync(password)
        : await verifyCode.mutateAsync(code);
    } catch (e) {
      // 틀림 · 지남(서버 AUTH_021 REAUTH_FAILED)만 그 칸의 글이다(앱과 한 벌).
      const c = errorCode(e);
      setError(
        c === REAUTH_LOCKED
          ? t("withdraw.locked")
          : c === REAUTH_FAILED
            ? method === "password"
              ? t("withdraw.passwordWrong")
              : t("withdraw.codeWrong")
            : failedText,
      );
      return null;
    }
  };

  /**
   * 받은 티켓이 쓰이지 못했다(뒤 요청 실패). 티켓은 이미 쓰였을 수 있어 같은 입력으로 다시 보내지 않게
   * 칸을 비우고 글을 세운다 — 다음 확인은 처음부터 다시 받는다.
   */
  const restart = (message: string) => {
    setPassword("");
    setCode("");
    setError(message);
  };

  return {
    method,
    switchMethod,
    password,
    changePassword,
    code,
    changeCode,
    error,
    setError,
    sentAt,
    onSendCode,
    passwordId,
    codeId,
    /** 확인 버튼을 켤지 — 비밀번호는 비면 끈다. 코드는 켜 두고 누르면 칸 오류로 알린다 */
    canConfirm: method === "password" ? password.length > 0 : true,
    /** 바뀐 값이 있는지 — 닫기 전에 물을지 */
    dirty: password !== "" || code !== "",
    checkInput,
    verify,
    restart,
  };
}

export type Reauth = ReturnType<typeof useReauth>;
