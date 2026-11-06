import { loadFailed } from "@/shared/api";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, KeyRound } from "lucide-react";
import {
  Alert,
  AlertBody,
  AlertDescription,
  AlertTitle,
} from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Callout } from "@/shared/ds/callout";
import { useSnackbar } from "@/shared/ds/snackbar";
import { useConfirmFail } from "@/shared/lib/confirm-fail";
import { Card } from "@/shared/ui/card";
import { Field, FieldLabel } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";
import { Textarea } from "@/shared/ui/textarea";
import { config } from "@/shared/config";
import { toLocalDateKey, toLocalDateTime } from "@/shared/lib/date";
import type {
  ApiToken,
  IssuedApiToken,
} from "@/features/subscription/api/subscriptionApi";
import {
  useApiTokens,
  useIssueApiToken,
  useRevokeApiToken,
} from "@/features/subscription/model/useSubscription";

/** 서버가 받는 이름 길이 상한(`ApiTokenServiceImpl.NAME_MAX_LENGTH`). */
const NAME_MAX_LENGTH = 50;

/** 호출 예시에 넣는 자리 — 토큰으로 열리는 셋(시세·환율·캔들) 중 차트. */
const EXAMPLE_PATH = "/v1/securities/candles?symbol=005930&interval=1m";

/**
 * 호출 예시에 적는 **전체 주소**.
 *
 * dev·운영 빌드의 `config.apiBaseUrl` 은 `/api` 같은 상대 경로다 — 화면과 API 가 같은 출처에 있어
 * 브라우저에게는 그걸로 충분하다. 하지만 이 예시를 쓰는 건 사용자의 프로그램이고, 거기에는 "지금
 * 이 화면의 출처" 가 없다. 상대 경로를 그대로 보여 주면 어디로 부르라는 건지 알 수 없는 예시가 된다
 * (처음에 그렇게 나갔다). 절대 주소로 설정된 빌드에서는 그 주소가 그대로 나온다.
 */
const exampleUrl = () =>
  new URL(
    `${config.apiBaseUrl}${EXAMPLE_PATH}`,
    window.location.origin,
  ).toString();

/**
 * 프로그램용 API 토큰 카드 — 발급 / 목록 / 폐기.
 *
 * desk 는 사용자마다 **자기 증권사 키로 자기 데이터**를 대신 조회해 준다. 브라우저·앱은
 * 로그인으로 그 길을 여는데, 사용자가 만든 프로그램은 로그인을 할 수 없다. 이 토큰이 그 자리를
 * 대신한다 — 토큰 하나가 로그인 한 명이고, 누가 쓰든 주인의 키로 주인의 시세만 나온다.
 *
 * **원문은 발급 직후 한 번만 보인다.** 서버에도 해시만 남아서 다시 받아 올 길이 없다. 그래서
 * 발급 응답을 이 컴포넌트가 들고 있다가 사용자가 닫으면 버린다 — 목록 조회로는 되살아나지 않는다.
 *
 * 증권사 카드(`BrokerConnectCard`)와 같은 틀을 쓴다. 같은 다이얼로그에 나란히 선다.
 */
export function ApiTokenCard() {
  const { t } = useTranslation("subscription");
  const { data: tokens, isLoading, isError } = useApiTokens();
  const issue = useIssueApiToken();
  const revoke = useRevokeApiToken();

  const [name, setName] = useState("");
  const [issued, setIssued] = useState<IssuedApiToken | null>(null);

  const canIssue = name.trim().length > 0;

  const snackbar = useSnackbar();
  const confirmFail = useConfirmFail();
  // 이중 제출 가드 — 같은 프레임의 두 번째 누름은 렌더 전 클로저라 isPending 이 아직 false 다. 누르는 순간 켜고 끝나면 끈다
  const issuingRef = useRef(false);

  // 발급 실패는 폼 맨 위 Callout(고정 글) — 요청은 silent, 쓴 이름 그대로
  const onIssue = () => {
    if (!canIssue || issue.isPending || issuingRef.current) return;
    issuingRef.current = true;
    issue.reset();
    issue.mutate(name.trim(), {
      onSuccess: (data) => {
        setIssued(data);
        setName("");
      },
      onSettled: () => {
        issuingRef.current = false;
      },
    });
  };

  // 폐기는 단추 동작 — 실패는 critical 스낵바 + [다시 시도](같은 폐기)
  const onRevoke = (token: ApiToken) => {
    const run = () => revoke.mutateAsync(token.rowId);
    const done = () => {
      snackbar.show({ message: t("apiToken.toastRevoked"), tone: "neutral" });
      // 방금 만든 토큰을 곧바로 폐기했으면 원문을 계속 보여 줄 이유가 없다 — 이미 죽은 값이다.
      if (issued?.rowId === token.rowId) setIssued(null);
    };
    run().then(done, () =>
      confirmFail({
        message: t("apiToken.revokeFailed"),
        retry: run,
        onRetried: done,
      }),
    );
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // 권한이 없거나 보안 컨텍스트가 아니면 clipboard API 가 거절한다 — 옛 방식으로 한 번 더.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    snackbar.show({ message: t("apiToken.toastCopied"), tone: "neutral" });
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
          <KeyRound size={18} />
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
            {t("apiToken.title")}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--fg-secondary)",
              marginTop: 3,
              lineHeight: 1.5,
            }}
          >
            {t("apiToken.desc")}
          </div>
        </div>
      </div>

      <div
        style={{
          padding: "0 16px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {isLoading && (
          <Skeleton style={{ height: 60, borderRadius: "var(--radius-md)" }} />
        )}

        {loadFailed({ isError, data: tokens }) && (
          <div style={{ fontSize: 13, color: "var(--fg-secondary)" }}>
            {t("apiToken.loadFailed")}
          </div>
        )}

        {tokens?.map((token) => (
          <div
            key={token.rowId}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              borderRadius: "var(--radius-md)",
              background: "var(--bg-canvas)",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--fg-primary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {token.name}
              </div>
              <div
                style={{
                  fontSize: "var(--text-badge)",
                  color: "var(--fg-tertiary)",
                  marginTop: 2,
                  lineHeight: 1.5,
                }}
              >
                {/* createAt·lastUsedAt 은 서버 `[UTC]` — 자르면 UTC 날짜라 KST 새벽이 전날로 찍힌다 */}
                {[
                  `${token.tokenPrefix}…`,
                  t("apiToken.created", {
                    date:
                      toLocalDateKey(token.createAt) ??
                      token.createAt.slice(0, 10),
                  }),
                  token.lastUsedAt
                    ? t("apiToken.lastUsed", {
                        date:
                          toLocalDateTime(token.lastUsedAt) ?? token.lastUsedAt,
                      })
                    : t("apiToken.neverUsed"),
                ].join(" · ")}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRevoke(token)}
              loading={revoke.isPending && revoke.variables === token.rowId}
              aria-label={t("apiToken.revokeAria", { name: token.name })}
            >
              {t("apiToken.revoke")}
            </Button>
          </div>
        ))}

        {tokens?.length === 0 && !issued && (
          <div
            style={{
              fontSize: "var(--text-badge)",
              color: "var(--fg-tertiary)",
              lineHeight: 1.5,
            }}
          >
            {t("apiToken.empty")}
          </div>
        )}

        {issued ? (
          <>
            <Alert variant="warning">
              <AlertBody>
                <AlertTitle>{t("apiToken.issuedTitle")}</AlertTitle>
                <AlertDescription>{t("apiToken.issuedDesc")}</AlertDescription>
              </AlertBody>
            </Alert>
            <Field>
              <FieldLabel>{t("apiToken.tokenLabel")}</FieldLabel>
              <div style={{ position: "relative" }}>
                <Input
                  readOnly
                  value={issued.token}
                  onFocus={(e) => e.currentTarget.select()}
                  spellCheck={false}
                  className="w-full"
                  style={{ paddingRight: 40 }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => copy(issued.token)}
                  aria-label={t("apiToken.copy")}
                  style={{
                    position: "absolute",
                    right: 4,
                    top: "50%",
                    transform: "translateY(-50%)",
                    height: 32,
                    width: 32,
                  }}
                >
                  <Copy size={16} />
                </Button>
              </div>
            </Field>
            <Field>
              <FieldLabel>{t("apiToken.exampleLabel")}</FieldLabel>
              <Textarea
                readOnly
                value={`curl -H "Authorization: Bearer ${issued.token}" "${exampleUrl()}"`}
                onFocus={(e) => e.currentTarget.select()}
                spellCheck={false}
                rows={4}
                className="resize-none"
              />
            </Field>
            <Button
              size="md"
              onClick={() => setIssued(null)}
              style={{ width: "100%" }}
            >
              {t("apiToken.done")}
            </Button>
          </>
        ) : (
          <>
            {issue.isError && (
              <Callout tone="critical" role="alert">
                {t("apiToken.issueFailed")}
              </Callout>
            )}
            <Field>
              <FieldLabel>{t("apiToken.nameLabel")}</FieldLabel>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  // 한글 조합 중 Enter 는 글자 확정이다 — 그때 발급이 나가면 이름이 잘린다.
                  if (e.key === "Enter" && !e.nativeEvent.isComposing)
                    onIssue();
                }}
                placeholder={t("apiToken.namePlaceholder")}
                maxLength={NAME_MAX_LENGTH}
                className="w-full"
              />
            </Field>
            <Button
              size="md"
              onClick={onIssue}
              loading={issue.isPending}
              disabled={!canIssue}
              style={{ width: "100%" }}
            >
              {t("apiToken.issue")}
            </Button>
          </>
        )}

        <div
          style={{
            fontSize: "var(--text-badge)",
            color: "var(--fg-tertiary)",
            lineHeight: 1.5,
          }}
        >
          {t("apiToken.scopeHint")}
        </div>
      </div>
    </Card>
  );
}
