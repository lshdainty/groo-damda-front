import { useSaveFailureText } from "@/shared/lib/save-failure-text";
import { loadFailed } from "@/shared/api";
import { useRef, useState } from "react";
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
import { List, ListItem } from "@/shared/ds/list";
import { useWideSurface } from "@/shared/ds/overlay";
import { ProgressCircle } from "@/shared/ds/progress-circle";
import { ResultSection } from "@/shared/ds/result-section";
import { formatDateSmart, toLocalDateKey } from "@/shared/lib/date";
import { BusyOverlay } from "@/shared/ui/groo/busy-overlay";
// 배럴(`@/features/user`)이 이 파일을 다시 내보내므로 거기서 가져오면 순환이 된다 —
// ESM 이 버티긴 해도 초기화 순서에 따라 undefined 가 잡힌다. 상대 경로로 간다.
import { WITHDRAW_BLOCK_SUBSCRIPTION } from "../api/userApi";
import { useReauth } from "../model/useReauth";
import {
  useWithdrawMutation,
  useWithdrawalCheck,
} from "../model/useWithdrawal";
import { ReauthFields } from "./ReauthFields";

/**
 * 해지 흐름의 단계.
 *
 * <p>한 다이얼로그 안에서 단계를 넘기는 이유 — 다이얼로그를 갈아 끼우면 뒤로 가기가
 * 끊기고(모바일 뒤로가기 = 닫기), 사용자가 "안내를 읽던 자리" 로 돌아올 수 없다.
 */
type Step = "impact" | "reauth";

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
  // 본인 확인 요청이 시작될 때 켠다. 성공하면 걷지 않는다 — 안내 화면으로 떠나며 사라진다.
  const [busy, setBusy] = useState(false);

  const checkQ = useWithdrawalCheck(true);
  // 본인 확인 칸 · 확인은 소셜 연동과 함께 쓴다 — 티켓은 해지용("withdraw")으로 받는다
  const reauth = useReauth({
    purpose: "withdraw",
    idPrefix: "withdraw",
    failedText: t("withdraw.failed"),
  });
  const withdraw = useWithdrawMutation();
  const sft = useSaveFailureText();

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
  const unblockKey = check?.subscriptionPeriodEnd
    ? toLocalDateKey(check.subscriptionPeriodEnd)
    : null;
  // 화면에는 날짜 규칙대로("10월 31일") — 날짜를 못 읽을 때만 서버 값 앞 10자를 그대로 보인다
  const unblockDate = check?.subscriptionPeriodEnd
    ? unblockKey
      ? formatDateSmart(unblockKey)
      : check.subscriptionPeriodEnd.slice(0, 10)
    : null;

  // 입력 폼인 때 — 점검이 끝났고 막히지 않았을 때만. 아니면 안내 표면(위 ✕ 하나).
  const form = !checkQ.isLoading && !loadFailed(checkQ) && !blocked;
  const dirty = reason.trim() !== "" || reauth.dirty;

  const doWithdraw = async (reauthToken: string) => {
    await withdraw.mutateAsync({
      reauthToken,
      reason: reason.trim() || undefined,
    });
    onWithdrawn();
  };

  const onConfirm = async () => {
    if (runningRef.current) return;
    // 6자리가 안 되면 칸 오류로 알린다 — 서버에 보내지 않는다(useReauth.checkInput)
    if (!reauth.checkInput()) return;
    runningRef.current = true;
    setBusy(true);
    // 틀림 · 잠김은 그 칸의 글, 네트워크 · 서버 오류는 해지 실패 글이다 — 칸 밑에 붙는다(useReauth.verify)
    const token = await reauth.verify();
    if (token == null) {
      setBusy(false);
      runningRef.current = false;
      return;
    }
    try {
      await doWithdraw(token);
    } catch (e) {
      // 결과를 확인하지 못했으면(응답을 못 읽음 · 응답 전에 끊김) 실패라 하지 않는다 — 해지됐을 수 있다(앱 withdrawUnconfirmed 와 같은 자리, 글은 웹 전용 — 새로 고침)
      reauth.setError(sft(e, t("withdraw.failed"), "withdraw"));
      setBusy(false);
    } finally {
      runningRef.current = false;
    }
  };

  // ── 본문 ────────────────────────────────────────────────────────────────
  let body;
  if (checkQ.isLoading) {
    body = (
      <div className="flex justify-center py-x8">
        <ProgressCircle size="40" aria-label={dsT("common.loading")} />
      </div>
    );
  } else if (loadFailed(checkQ)) {
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
    body = <ReauthFields reauth={reauth} />;
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
          disabled={!reauth.canConfirm}
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
