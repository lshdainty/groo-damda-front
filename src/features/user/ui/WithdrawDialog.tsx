import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { useDsText } from "@/shared/ds/i18n";
import { Input } from "@/shared/ds/input";
import { InputOTP, InputOTPResend } from "@/shared/ds/input-otp";
import { List, ListItem } from "@/shared/ds/list";
import { useWideSurface } from "@/shared/ds/overlay";
import { ProgressCircle } from "@/shared/ds/progress-circle";
import { ResultSection } from "@/shared/ds/result-section";
import { toLocalDateKey } from "@/shared/lib/date";
import { BusyOverlay } from "@/shared/ui/groo/busy-overlay";
// 배럴(`@/features/user`)이 이 파일을 다시 내보내므로 거기서 가져오면 순환이 된다 —
// ESM 이 버티긴 해도 초기화 순서에 따라 undefined 가 잡힌다. 상대 경로로 간다.
import { WITHDRAW_BLOCK_SUBSCRIPTION } from "../api/userApi";
import {
  useSendReauthEmailCodeMutation,
  useVerifyReauthEmailCodeMutation,
  useVerifyReauthPasswordMutation,
  useWithdrawMutation,
  useWithdrawalCheck,
} from "../model/useWithdrawal";

/**
 * 해지 흐름의 단계.
 *
 * <p>한 다이얼로그 안에서 단계를 넘기는 이유 — 다이얼로그를 갈아 끼우면 뒤로 가기가
 * 끊기고(모바일 뒤로가기 = 닫기), 사용자가 "안내를 읽던 자리" 로 돌아올 수 없다.
 */
type Step = "impact" | "reauth";

/** 서버 `REAUTH_FAILED`(AUTH_021) — 비밀번호 · 코드가 틀렸거나 지났다. */
const REAUTH_FAILED = "AUTH_021";
/** 서버 `REAUTH_LOCKED`(AUTH_022, 429) — 5번 틀려 잠겼다. 코드를 다시 받아야 풀린다. */
const REAUTH_LOCKED = "AUTH_022";
const errorCode = (e: unknown) =>
  (e as { response?: { data?: { code?: string } } } | null)?.response?.data
    ?.code;
const isReauthFailed = (e: unknown) => errorCode(e) === REAUTH_FAILED;

/** 본인 확인 방법. 비밀번호가 없는 소셜 전용 계정은 코드 말고 길이 없다. */
type ReauthMethod = "password" | "emailCode";

/** 해지하면 없어지는 것들 — 개수가 0 이면 줄을 아예 안 보여 준다. ds List 의 누르지 않는 줄. */
function ImpactList({
  counts,
  t,
}: {
  counts: {
    sharedCalendarsOwned: number;
    calendarMemberships: number;
    dutchPaysOwned: number;
    dutchPayParticipations: number;
  };
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const rows = [
    { key: "impact.calendarsOwned", n: counts.sharedCalendarsOwned },
    { key: "impact.calendarMemberships", n: counts.calendarMemberships },
    { key: "impact.dutchPaysOwned", n: counts.dutchPaysOwned },
    {
      key: "impact.dutchPayParticipations",
      n: counts.dutchPayParticipations,
    },
  ].filter((r) => r.n > 0);

  if (rows.length === 0) return null;

  return (
    <List>
      {rows.map((r) => (
        <ListItem key={r.key} title={t(r.key, { count: r.n })} />
      ))}
    </List>
  );
}

/**
 * 그루 담다 이용 해지.
 *
 * <p>세 번 확인한다 — ① 무엇을 잃는지 개수로 보여 주고 ② 본인 확인을 다시 받고
 * ③ 마지막 버튼이 빨갛다. 되돌릴 수 없는 일이라 한 번의 오조작으로 끝나면 안 된다.
 *
 * <p>성공하면 이 세션은 끝난다. `onWithdrawn` 이 로그아웃까지 책임진다 — 여기서
 * 화면을 갱신하려 들면 이미 없는 계정으로 API 를 부르게 된다.
 *
 * <p>표면은 ds ResponsiveDialog — 1280 미만 Bottom Sheet · 이상 Dialog. 입력 폼이라 바깥을
 * 눌러도 닫히지 않고, 바뀐 값(사유 · 비밀번호 · 코드)이 있으면 닫기 전에 묻는다.
 * 해지가 나가는 동안은 화면 전체를 덮는다(BusyOverlay, I-05 37).
 */
export function WithdrawDialog({
  onClose,
  onWithdrawn,
}: {
  onClose: () => void;
  /** 해지가 끝났다. 부르는 쪽이 로그아웃시키고 안내 화면으로 보낸다. */
  onWithdrawn: () => void;
}) {
  const { t } = useTranslation("user");
  const { t: tc } = useTranslation("common");
  const dsT = useDsText();
  const wide = useWideSurface();

  const [step, setStep] = useState<Step>("impact");
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState<ReauthMethod>("password");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [reauthError, setReauthError] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<number | null>(null);
  // 본인 확인 요청이 시작될 때 켠다. 성공하면 걷지 않는다 — 안내 화면으로 떠나며 사라진다.
  const [busy, setBusy] = useState(false);

  const checkQ = useWithdrawalCheck(true);
  const sendCode = useSendReauthEmailCodeMutation();
  const verifyCode = useVerifyReauthEmailCodeMutation();
  const verifyPassword = useVerifyReauthPasswordMutation();
  const withdraw = useWithdrawMutation();

  // 해지가 나가 있는 동안 또 눌려도 아무 일이 없어야 한다 — 두 번 불러도 결과는
  // 같지만(서버가 멱등) 그 사이 두 번째 요청이 이미 쓴 티켓을 들고 가 401 이 뜬다.
  const runningRef = useRef(false);

  const check = checkQ.data;
  const blocked = (check?.blocked?.length ?? 0) > 0;
  const blockedBySubscription =
    check?.blocked?.includes(WITHDRAW_BLOCK_SUBSCRIPTION) ?? false;
  // 서버가 시간대 없이 주는 `[UTC]` — 자르면 KST 에서 하루 이르게 보인다.
  // 구독 다이얼로그·설정 화면과 같은 값이라 같은 방식으로 읽어야 세 화면이
  // 다른 날짜를 말하지 않는다.
  const unblockDate = check?.subscriptionPeriodEnd
    ? (toLocalDateKey(check.subscriptionPeriodEnd) ??
      check.subscriptionPeriodEnd.slice(0, 10))
    : null;

  // 방법을 바꾸면 앞선 오류를 지운다 — 비밀번호가 틀렸다는 빨간 줄이 코드 칸 위에
  // 남아 있으면 무엇이 잘못됐는지 알 수 없다.
  useEffect(() => {
    setReauthError(null);
  }, [method]);

  // 입력 폼인 때 — 점검이 끝났고 막히지 않았을 때만. 아니면 안내 표면(위 ✕ 하나).
  const form = !checkQ.isLoading && !checkQ.isError && !blocked;
  const dirty = reason.trim() !== "" || password !== "" || code !== "";

  const doWithdraw = async (reauthToken: string) => {
    await withdraw.mutateAsync({
      reauthToken,
      reason: reason.trim() || undefined,
    });
    onWithdrawn();
  };

  const onConfirm = async () => {
    if (runningRef.current) return;
    // 6자리가 안 되면 칸 오류로 알린다(input-otp.md "6자리 전 확인 막힘") — 서버에 보내지 않는다.
    if (method === "emailCode" && !/^\d{6}$/.test(code)) {
      setReauthError(t("withdraw.codeIncomplete"));
      document.getElementById("withdraw-code")?.focus();
      return;
    }
    runningRef.current = true;
    setReauthError(null);
    setBusy(true);
    // 본인 확인 실패는 그 칸의 문제다 — 토스트로 띄우면 어느 칸을 고쳐야 하는지 안 보인다. 칸 밑에 붙인다.
    // 서버가 보낸 글을 그대로 보이지 않고 화면 글로 바꾼다(input-otp.md "서버가 보낸 글을 그대로 보이지 않고 화면 글로" ·
    // Writing 오류) — 틀린 코드 · 틀린 비밀번호는 같은 한 문장이고, 해지 요청이 실패하면 해지 실패 문장이다.
    let token: string;
    try {
      token =
        method === "password"
          ? await verifyPassword.mutateAsync(password)
          : await verifyCode.mutateAsync(code);
    } catch (e) {
      // 틀림 · 지남(서버 AUTH_021 REAUTH_FAILED)만 그 칸의 글이고, 네트워크 · 서버 오류는 해지 실패 글이다(앱과 한 벌).
      setReauthError(
        errorCode(e) === REAUTH_LOCKED
          ? t("withdraw.locked")
          : isReauthFailed(e)
            ? method === "password"
              ? t("withdraw.passwordWrong")
              : t("withdraw.codeWrong")
            : t("withdraw.failed"),
      );
      setBusy(false);
      runningRef.current = false;
      return;
    }
    try {
      await doWithdraw(token);
    } catch {
      setReauthError(t("withdraw.failed"));
      setBusy(false);
    } finally {
      runningRef.current = false;
    }
  };

  const onSendCode = () => {
    sendCode.mutate(undefined, {
      onError: () => {
        // 확인 실패와 같은 자리에 붙인다 — 한쪽만 토스트로 띄우면 같은 흐름 안에서
        // 오류가 두 가지 방식으로 나타난다. 서버 글 대신 화면 글.
        setReauthError(t("withdraw.sendCodeFailed"));
      },
      onSuccess: () => {
        setSentAt(Date.now());
        setReauthError(null);
        // 대화상자가 열린 채라 스낵바가 아니라 코드 칸 아래 안내 글(아래 role=status)이 말한다
      },
    });
  };

  const canConfirm = method === "password" ? password.length > 0 : true;

  // ── 본문 ────────────────────────────────────────────────────────────────
  let body;
  if (checkQ.isLoading) {
    body = (
      <div className="flex justify-center py-x8">
        <ProgressCircle size="40" aria-label={dsT("common.loading")} />
      </div>
    );
  } else if (checkQ.isError) {
    body = (
      <ResultSection
        kind="failure"
        size="medium"
        title={t("withdraw.loadFailed")}
        description={t("withdraw.loadFailedDesc")}
        primaryAction={{
          label: dsT("common.retry"),
          onClick: () => void checkQ.refetch(),
          loading: checkQ.isFetching,
        }}
      />
    );
  } else if (blocked) {
    body = (
      <Callout
        tone="warning"
        title={
          blockedBySubscription
            ? unblockDate
              ? t("withdraw.blockedSubscriptionUntil", { date: unblockDate })
              : t("withdraw.blockedSubscription")
            : t("withdraw.blockedOther")
        }
      >
        {t("withdraw.blockedHint")}
      </Callout>
    );
  } else if (step === "impact") {
    body = (
      <div className="flex flex-col gap-x4">
        <ImpactList counts={check!} t={t} />
        {/* 되돌릴 수 없는 것 둘 — 여기서 말하지 않으면 사용자가 알 길이 없다. */}
        <Callout tone="warning" title={t("withdraw.irreversibleTitle")}>
          <span className="block">{t("withdraw.irreversibleRejoin")}</span>
          <span className="block">{t("withdraw.irreversibleData")}</span>
        </Callout>
        {/* 데이터가 어떻게 되는지 — "사라진다" 가 아니라 보관 뒤 파기다. 내보내기
            권유는 해지 전에만 할 수 있는 말이라 여기 둔다(설계서 결정 12). */}
        <p className="m-0 text-t4 text-fg-neutral-subtle">
          {t("withdraw.dataRetention")}
        </p>
        <Field
          label={t("withdraw.reasonLabel")}
          indicator={t("withdraw.optional")}
        >
          <Input
            id="withdraw-reason"
            value={reason}
            maxLength={200}
            placeholder={t("withdraw.reasonPlaceholder")}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
      </div>
    );
  } else {
    body = (
      <div className="flex flex-col gap-x4">
        {method === "password" ? (
          <>
            <Field
              label={t("currentPassword")}
              invalid={!!reauthError}
              errorMessage={reauthError}
            >
              <Input
                id="withdraw-password"
                type="password"
                autoComplete="current-password"
                value={password}
                placeholder={t("currentPasswordPlaceholder")}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setReauthError(null);
                }}
              />
            </Field>
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="small"
                onClick={() => setMethod("emailCode")}
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
                invalid={!!reauthError}
                errorMessage={reauthError}
              >
                <InputOTP
                  id="withdraw-code"
                  value={code}
                  placeholder={t("withdraw.codePlaceholder")}
                  onValueChange={(v) => {
                    setCode(v);
                    setReauthError(null);
                  }}
                />
              </Field>
              <InputOTPResend
                sentAt={sentAt}
                codeInputId="withdraw-code"
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
                onClick={() => setMethod("password")}
              >
                {t("withdraw.usePassword")}
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── 바닥 ────────────────────────────────────────────────────────────────
  // 점검 중 · 불러오기 실패 · 막힘은 안내 표면이다 — 시트는 위 ✕ 만(바닥 없음), 대화상자는 [닫기] 하나.
  let footer;
  if (!form) {
    footer =
      checkQ.isLoading || !wide ? null : (
        <ResponsiveDialogFooter>
          <Button variant="neutralWeak" onClick={onClose}>
            {tc("close")}
          </Button>
        </ResponsiveDialogFooter>
      );
  } else if (step === "impact") {
    footer = (
      <ResponsiveDialogFooter>
        <ResponsiveDialogCancel>{tc("cancel")}</ResponsiveDialogCancel>
        <Button variant="criticalSolid" onClick={() => setStep("reauth")}>
          {t("withdraw.next")}
        </Button>
      </ResponsiveDialogFooter>
    );
  } else {
    footer = (
      <ResponsiveDialogFooter>
        <Button
          variant="neutralWeak"
          // 확인 중에는 앞 단계로 가지 않는다 — 실패 글을 그릴 칸이 사라진다
          onClick={() => {
            if (!busy) setStep("impact");
          }}
        >
          {tc("back")}
        </Button>
        <Button
          variant="criticalSolid"
          onClick={onConfirm}
          disabled={!canConfirm}
        >
          {t("withdraw.confirm")}
        </Button>
      </ResponsiveDialogFooter>
    );
  }

  return (
    <>
      <ResponsiveDialog
        open
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
        form={form}
        dirty={dirty}
        busy={busy}
      >
        <ResponsiveDialogContent
          title={t("withdraw.title")}
          // 안내 첫 문장은 표면 머리 설명(R7)이다 — 점검 · 막힘 · 실패 표면에는 두지 않는다
          description={
            form
              ? step === "impact"
                ? t("withdraw.intro")
                : t("withdraw.reauthIntro")
              : undefined
          }
        >
          <ResponsiveDialogBody>{body}</ResponsiveDialogBody>
          {footer}
        </ResponsiveDialogContent>
      </ResponsiveDialog>
      <BusyOverlay busy={busy} label={t("withdraw.closing")} />
    </>
  );
}
