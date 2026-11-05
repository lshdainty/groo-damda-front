import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CircleCheck, Link2 } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Callout } from "@/shared/ds/callout";
import { useSnackbar } from "@/shared/ds/snackbar";
import { useConfirmFail } from "@/shared/lib/confirm-fail";
import { Card } from "@/shared/ui/card";
import { SecretField } from "@/features/subscription/ui/SecretField";
import { toLocalDateKey } from "@/shared/lib/date";
import type { BrokerConnection } from "@/features/subscription/api/subscriptionApi";
import {
  useRegisterBrokerCredential,
  useDisconnectBrokerCredential,
  useSetPrimaryBroker,
} from "@/features/subscription/model/useSubscription";

/**
 * 증권사 한 곳의 연결 카드 — 키 등록 / 해제 / 기본 시세 소스 지정.
 *
 * **증권사 이름을 프론트에 박지 않는다.** 표시명·발급처·입력 라벨은 서버가 주는
 * `BrokerConnection` 에서 온다. 증권사가 늘어도 배포 없이 목록에 나타나고, 같은 자리를
 * 회사마다 다르게 부르는 문제(토스 Client ID / 나무 App Key)도 여기서 풀린다.
 *
 * 시크릿은 서버에 암호화 저장되며 응답으로 반환되지 않는다(연결 여부만 표시).
 */
export function BrokerConnectCard({
  connection,
  showPrimaryAction,
}: {
  connection: BrokerConnection;
  /** 기본 시세 소스 지정 버튼 노출 여부. 연결이 하나뿐이면 고를 게 없어 감춘다. */
  showPrimaryAction: boolean;
}) {
  const { t } = useTranslation("subscription");
  const register = useRegisterBrokerCredential();
  const disconnect = useDisconnectBrokerCredential();
  const setPrimary = useSetPrimaryBroker();

  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");

  const { broker, displayName, connected, primary, verifiedAt } = connection;
  const canConnect = apiKey.trim().length > 0 && apiSecret.trim().length > 0;

  const snackbar = useSnackbar();
  const confirmFail = useConfirmFail();
  // 이중 제출 가드 — 같은 프레임의 두 번째 누름은 렌더 전 클로저라 isPending 이 아직 false 다. 누르는 순간 켜고 끝나면 끈다
  const connectingRef = useRef(false);
  // 키 · 시크릿을 고쳐 다시 넣는 폼이라 실패는 카드 안 폼 위 Callout(고정 글) — 서버 글 없음, 쓴 값 그대로.
  // 자격증명 문제(4xx)와 서버 문제를 글로 나눈다
  const status = (register.error as { response?: { status?: number } } | null)
    ?.response?.status;
  const connectFailedText =
    status != null && status >= 400 && status < 500
      ? t("broker.toastInvalid")
      : t("broker.connectFailed");

  const onConnect = () => {
    if (!canConnect || connectingRef.current) return;
    connectingRef.current = true;
    register.reset();
    register.mutate(
      { broker, apiKey: apiKey.trim(), apiSecret: apiSecret.trim() },
      {
        onSuccess: () => {
          snackbar.show({
            message: t("broker.toastConnected", { broker: displayName }),
            tone: "neutral",
          });
          setApiKey("");
          setApiSecret("");
        },
        onSettled: () => {
          connectingRef.current = false;
        },
      },
    );
  };

  // 확인창 없는 단추 동작 — 실패는 critical 스낵바 + [다시 시도](묻지 않고 같은 요청)
  const onDisconnect = () => {
    const run = () => disconnect.mutateAsync(broker);
    const done = () =>
      snackbar.show({
        message: t("broker.toastDisconnected", { broker: displayName }),
        tone: "neutral",
      });
    run().then(done, () =>
      confirmFail({
        message: t("broker.toastDisconnectFailed"),
        retry: run,
        onRetried: done,
      }),
    );
  };

  const onSetPrimary = () => {
    const run = () => setPrimary.mutateAsync(broker);
    const done = () =>
      snackbar.show({
        message: t("broker.toastPrimaryChanged", { broker: displayName }),
        tone: "neutral",
      });
    run().then(done, () =>
      confirmFail({
        message: t("broker.toastPrimaryFailed"),
        retry: run,
        onRetried: done,
      }),
    );
  };

  return (
    <Card variant="bordered" style={{ padding: 0, overflow: "hidden" }}>
      {/* 헤더 */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          padding: "16px 16px 14px",
        }}
      >
        <span
          style={{
            width: 40,
            height: 40,
            borderRadius: "var(--radius-md)",
            flexShrink: 0,
            background: "var(--bg-brand-subtle)",
            color: "var(--fg-brand)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Link2 size={18} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "var(--fg-primary)",
              letterSpacing: "-0.01em",
            }}
          >
            {displayName}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--fg-secondary)",
              marginTop: 3,
              lineHeight: 1.5,
            }}
          >
            {t("broker.connectDesc")}
          </div>
        </div>
        {primary ? (
          /* 앱은 softBrand 를 쓰지만 front Badge spec 에는 soft-brand 가 없다 — solid default 로 둔다. */
          <Badge variant="default" style={{ flexShrink: 0 }}>
            {t("broker.primary")}
          </Badge>
        ) : connected ? (
          <Badge variant="success" style={{ flexShrink: 0 }}>
            {t("broker.connected")}
          </Badge>
        ) : null}
      </div>

      {connected ? (
        <div
          style={{
            padding: "0 16px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              borderRadius: "var(--radius-md)",
              background: "var(--bg-canvas)",
            }}
          >
            <CircleCheck
              size={18}
              style={{ color: "var(--status-success-fg)", flexShrink: 0 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--fg-primary)",
                }}
              >
                {t("broker.keyConnected", { broker: displayName })}
              </div>
              <div
                style={{
                  fontSize: "var(--text-badge)",
                  color: "var(--fg-tertiary)",
                  marginTop: 2,
                }}
              >
                {/* verifiedAt 은 서버 `[UTC]` — 자르면 UTC 날짜라 KST 새벽 검증이 전날로 찍힌다 */}
                {verifiedAt
                  ? t("broker.lastVerified", {
                      date:
                        toLocalDateKey(verifiedAt) ?? verifiedAt.slice(0, 10),
                    })
                  : t("broker.autoCollecting")}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onDisconnect}
              loading={disconnect.isPending}
            >
              {t("broker.disconnect")}
            </Button>
          </div>

          {/* 연결이 둘 이상일 때만 고를 의미가 있다. */}
          {showPrimaryAction && !primary && (
            <>
              <Button
                variant="outline"
                size="md"
                onClick={onSetPrimary}
                loading={setPrimary.isPending}
                style={{ width: "100%" }}
              >
                {t("broker.useAsPrimary")}
              </Button>
              <div
                style={{
                  fontSize: "var(--text-badge)",
                  color: "var(--fg-tertiary)",
                  lineHeight: 1.5,
                }}
              >
                {t("broker.primaryHint")}
              </div>
            </>
          )}
        </div>
      ) : (
        <div
          style={{
            padding: "0 16px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {register.isError && (
            <Callout tone="critical" role="alert">
              {connectFailedText}
            </Callout>
          )}
          {/* 라벨은 서버가 준다 — 회사마다 같은 자리를 다르게 부른다. */}
          {/* 키도 시크릿과 같은 자격증명의 반쪽이라 같은 칸을 쓴다. */}
          <SecretField
            label={connection.keyLabel}
            value={apiKey}
            onChange={setApiKey}
            toggleAriaLabel={t("broker.toggleReveal", {
              field: connection.keyLabel,
            })}
          />
          <SecretField
            label={connection.secretLabel}
            value={apiSecret}
            onChange={setApiSecret}
            toggleAriaLabel={t("broker.toggleReveal", {
              field: connection.secretLabel,
            })}
          />
          <Button
            size="md"
            onClick={onConnect}
            loading={register.isPending}
            disabled={!canConnect}
            style={{ width: "100%" }}
          >
            {t("broker.connect")}
          </Button>
          <div
            style={{
              fontSize: "var(--text-badge)",
              color: "var(--fg-tertiary)",
              lineHeight: 1.5,
            }}
          >
            {t("broker.keyHint", { broker: displayName })}
          </div>
        </div>
      )}
    </Card>
  );
}
