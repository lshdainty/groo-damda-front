import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnackbar } from "@/shared/ds/snackbar";
import { useConfirmFail } from "@/shared/lib/confirm-fail";
import { isWriteUnconfirmed } from "@/shared/api";
import type {
  ApiToken,
  BrokerConnection,
  IssuedApiToken,
} from "@/features/subscription/api/subscriptionApi";
import {
  useDisconnectBrokerCredential,
  useIssueApiToken,
  useRegisterBrokerCredential,
  useRevokeApiToken,
  useSetPrimaryBroker,
} from "@/features/subscription/model/useSubscription";

/** 서버가 받는 이름 길이 상한(`ApiTokenServiceImpl.NAME_MAX_LENGTH`). */
export const TOKEN_NAME_MAX_LENGTH = 50;

/** 시트 안 단계 — 증권사 줄 목록(첫 단계) → 한 증권사의 키 · 연결 상태 / API 토큰 */
export type LinkStep =
  { kind: "list" } | { kind: "broker"; broker: string } | { kind: "tokens" };

/** 증권사 한 곳에 쓰고 있는 키 — 눈(보기) 상태까지 같이 든다 */
export interface BrokerDraft {
  key: string;
  secret: string;
  showKey: boolean;
  showSecret: boolean;
}

const EMPTY_DRAFT: BrokerDraft = {
  key: "",
  secret: "",
  showKey: false,
  showSecret: false,
};

/**
 * 증권사 연동 시트의 **상태 한 벌** — 단계 · 쓰던 키 · 발급 직후 토큰 원문 · 요청.
 *
 * 시트(1280 미만) ↔ 대화상자(1280 이상)는 `ResponsiveDialog` 가 폭에 따라 표면을 갈아 끼우고, 그 안의 부품은 새로 그려진다.
 * 그래서 쓰던 키 · 눈 · 발급 직후 원문처럼 잃으면 안 되는 값은 부품이 아니라 **이 훅(표면 위)** 이 든다(I-wrap-b1 M3).
 * 요청(mutation)도 여기 둔다 — 시트의 `busy`(닫기 막음)가 요청 중임을 표면 위에서 알아야 한다.
 */
export function useSecuritiesLinkFlow(
  connections: BrokerConnection[] | undefined,
) {
  const { t } = useTranslation("subscription");
  const { t: tc } = useTranslation("common");
  const snackbar = useSnackbar();
  const confirmFail = useConfirmFail();

  const [step, setStep] = useState<LinkStep>({ kind: "list" });
  const [drafts, setDrafts] = useState<Record<string, BrokerDraft>>({});
  const [tokenName, setTokenName] = useState("");
  const [issued, setIssued] = useState<IssuedApiToken | null>(null);
  // 발급 직후 원문을 한 번이라도 복사했는가 — 안 했으면 나가기 전에 한 번 묻는다(어느 길로 나가는지는 부르는 쪽이 정한다)
  const [copied, setCopied] = useState(false);
  const [copyAsk, setCopyAsk] = useState<"close" | "back" | "done" | null>(
    null,
  );
  // 확인창이 묻는 대상 — 해제 · 폐기는 확인창 한 번 뒤에 간다
  const [disconnectAsk, setDisconnectAsk] = useState<BrokerConnection | null>(
    null,
  );
  const [revokeAsk, setRevokeAsk] = useState<ApiToken | null>(null);

  const register = useRegisterBrokerCredential();
  const disconnect = useDisconnectBrokerCredential();
  const setPrimary = useSetPrimaryBroker();
  const issue = useIssueApiToken();
  const revoke = useRevokeApiToken();

  // 이중 제출 가드 — 같은 프레임의 두 번째 누름은 렌더 전 클로저라 isPending 이 아직 false 다. 누르는 순간 켜고 끝나면 끈다
  const connectingRef = useRef(false);
  const issuingRef = useRef(false);

  const draftOf = (broker: string): BrokerDraft =>
    drafts[broker] ?? EMPTY_DRAFT;
  const patchDraft = (broker: string, patch: Partial<BrokerDraft>) =>
    setDrafts((d) => ({
      ...d,
      [broker]: { ...(d[broker] ?? EMPTY_DRAFT), ...patch },
    }));
  const clearDraft = (broker: string) =>
    setDrafts((d) => {
      const { [broker]: _gone, ...rest } = d;
      void _gone;
      return rest;
    });

  /** 단계를 옮긴다 — 지난 단계의 실패 Callout 은 따라오지 않는다 */
  const go = (next: LinkStep) => {
    register.reset();
    issue.reset();
    setStep(next);
  };
  /** ← — 쓰던 것을 버리고 첫 단계로(쓴 값이 있으면 부르는 쪽이 먼저 묻는다) */
  const backToList = () => {
    if (step.kind === "broker") clearDraft(step.broker);
    if (step.kind === "tokens") {
      setTokenName("");
      // 발급 직후 원문은 단계를 떠나면 버린다 — 목록 조회로는 되살아나지 않는다
      setIssued(null);
    }
    go({ kind: "list" });
  };

  const brokerDirty =
    step.kind === "broker" &&
    (draftOf(step.broker).key.trim() !== "" ||
      draftOf(step.broker).secret.trim() !== "");
  const tokenDirty = step.kind === "tokens" && !issued && tokenName !== "";

  // ── 연결하기
  const connect = (connection: BrokerConnection) => {
    const d = draftOf(connection.broker);
    if (d.key.trim() === "" || d.secret.trim() === "" || connectingRef.current)
      return;
    connectingRef.current = true;
    register.reset();
    register.mutate(
      {
        broker: connection.broker,
        apiKey: d.key.trim(),
        apiSecret: d.secret.trim(),
      },
      {
        onSuccess: () => {
          snackbar.show({
            message: t("broker.toastConnected", {
              broker: connection.displayName,
            }),
            tone: "positive",
          });
          clearDraft(connection.broker);
        },
        onSettled: () => {
          connectingRef.current = false;
        },
      },
    );
  };

  // 자격증명 문제(4xx)와 서버 문제를 글로 나눈다. 응답을 못 받았으면 실패가 아니다 — 연결됐을 수 있다
  const status = (register.error as { response?: { status?: number } } | null)
    ?.response?.status;
  const connectFailedText = isWriteUnconfirmed(register.error)
    ? tc("query.unconfirmedConnect")
    : status != null && status >= 400 && status < 500
      ? t("broker.toastInvalid")
      : t("broker.connectFailed");

  // ── 연결 해제 · 기본 지정 — 실패는 critical 스낵바 + [다시 시도](묻지 않고 같은 요청)
  const runDisconnect = (connection: BrokerConnection) => {
    const run = () => disconnect.mutateAsync(connection.broker);
    // 해제가 끝나면 첫 단계로 — 이 증권사의 조회 화면은 더 보일 게 없다
    const done = () => {
      clearDraft(connection.broker);
      go({ kind: "list" });
      snackbar.show({
        message: t("broker.toastDisconnected"),
        tone: "neutral",
      });
    };
    return run().then(done, (error: unknown) =>
      confirmFail({
        error,
        message: t("broker.toastDisconnectFailed"),
        retry: run,
        onRetried: done,
      }),
    );
  };

  const makePrimary = (connection: BrokerConnection) => {
    const run = () => setPrimary.mutateAsync(connection.broker);
    const done = () =>
      snackbar.show({
        message: t("broker.toastPrimaryChanged", {
          broker: connection.displayName,
        }),
        tone: "neutral",
      });
    run().then(done, (error: unknown) =>
      confirmFail({
        error,
        message: t("broker.toastPrimaryFailed"),
        retry: run,
        onRetried: done,
      }),
    );
  };

  // ── API 토큰
  const canIssue = tokenName.trim().length > 0;
  const issueToken = () => {
    if (!canIssue || issue.isPending || issuingRef.current) return;
    issuingRef.current = true;
    issue.reset();
    issue.mutate(tokenName.trim(), {
      onSuccess: (data) => {
        setIssued(data);
        setCopied(false);
        setTokenName("");
      },
      onSettled: () => {
        issuingRef.current = false;
      },
    });
  };

  const runRevoke = (token: ApiToken) => {
    const run = () => revoke.mutateAsync(token.rowId);
    const done = () => {
      snackbar.show({ message: t("apiToken.toastRevoked"), tone: "neutral" });
      // 방금 만든 토큰을 곧바로 폐기했으면 원문을 계속 보여 줄 이유가 없다 — 이미 죽은 값이다.
      if (issued?.rowId === token.rowId) setIssued(null);
    };
    return run().then(done, (error: unknown) =>
      confirmFail({
        error,
        message: t("apiToken.revokeFailed"),
        retry: run,
        onRetried: done,
      }),
    );
  };

  return {
    step,
    go,
    backToList,
    draftOf,
    patchDraft,
    brokerDirty,
    tokenDirty,
    connect,
    register,
    connectFailedText,
    disconnect,
    runDisconnect,
    disconnectAsk,
    setDisconnectAsk,
    setPrimary,
    makePrimary,
    connections,
    tokenName,
    setTokenName,
    issued,
    setIssued,
    copied,
    setCopied,
    copyAsk,
    setCopyAsk,
    /** 원문을 아직 복사하지 않았다 — 나가기 전에 묻는다 */
    needCopyAsk: issued != null && !copied,
    canIssue,
    issue,
    issueToken,
    revoke,
    runRevoke,
    revokeAsk,
    setRevokeAsk,
    /** 요청 중 — 시트가 어느 닫는 길도 받지 않는다 */
    busy:
      register.isPending ||
      issue.isPending ||
      disconnect.isPending ||
      setPrimary.isPending ||
      revoke.isPending,
  };
}

export type SecuritiesLinkFlow = ReturnType<typeof useSecuritiesLinkFlow>;
