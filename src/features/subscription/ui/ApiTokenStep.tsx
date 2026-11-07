import { useTranslation } from "react-i18next";
import { Copy } from "lucide-react";
import { Button } from "@/shared/ds/button";
import { Callout } from "@/shared/ds/callout";
import { Field } from "@/shared/ds/field";
import { Input } from "@/shared/ds/input";
import { List, ListItem } from "@/shared/ds/list";
import {
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
} from "@/shared/ds/dialog";
import { ResultSection } from "@/shared/ds/result-section";
import { Skeleton } from "@/shared/ds/skeleton";
import { Textarea } from "@/shared/ds/textarea";
import { useSnackbar } from "@/shared/ds/snackbar";
import { useWideSurface } from "@/shared/ds/overlay";
import { FormFooter } from "@/shared/ui/groo/form-footer";
import { loadFailed } from "@/shared/api";
import { config } from "@/shared/config";
import { formatDateSmart, parseServerUtc } from "@/shared/lib/date";
import { TOKEN_NAME_MAX_LENGTH } from "@/features/subscription/model/useSecuritiesLinkFlow";
import type { SecuritiesLinkFlow } from "@/features/subscription/model/useSecuritiesLinkFlow";
import { useApiTokens } from "@/features/subscription/model/useSubscription";

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

const dateOf = (iso: string) => {
  const d = parseServerUtc(iso);
  return d ? formatDateSmart(d) : iso.slice(0, 10);
};

/**
 * 프로그램용 API 토큰의 다음 단계 — 발급 / 목록(폐기) / 발급 직후 원문.
 *
 * desk 는 사용자마다 **자기 증권사 키로 자기 데이터**를 대신 조회해 준다. 사용자가 만든 프로그램은 로그인을 할 수
 * 없어서 이 토큰이 그 자리를 대신한다 — 토큰 하나가 로그인 한 명이고, 누가 쓰든 주인의 키로 주인의 시세만 나온다.
 *
 * **원문은 발급 직후 한 번만 보인다.** 서버에도 해시만 남아서 다시 받아 올 길이 없다. 그래서 발급 응답을
 * 부르는 쪽(`useSecuritiesLinkFlow`, 표면 위)이 들고 있다가 사용자가 닫거나 ← 로 나가면 버린다 — 표면이 바뀌어도
 * 남고, 목록 조회로는 되살아나지 않는다. 머리는 부르는 쪽이 그린다(본문 + 바닥).
 */
export function ApiTokenStep({ flow }: { flow: SecuritiesLinkFlow }) {
  const { t } = useTranslation("subscription");
  const { t: tc } = useTranslation("common");
  const { t: tDs } = useTranslation("ds");
  const tokensQ = useApiTokens();
  const { data: tokens, isLoading, isError, refetch } = tokensQ;
  const snackbar = useSnackbar();
  const wide = useWideSurface();
  const { issued } = flow;

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
    flow.setCopied(true);
    snackbar.show({ message: t("apiToken.toastCopied"), tone: "neutral" });
  };

  // 목록을 못 받았다 — 그 자리 실패 + [다시 시도]. 발급도 목록이 있어야 의미가 있어 폼 없이 이것만 둔다
  if (loadFailed({ isError, data: tokens }) && !issued) {
    return (
      <ResponsiveDialogBody>
        <ResultSection
          kind="failure"
          size="medium"
          title={t("apiToken.loadFailed")}
          primaryAction={{
            label: tDs("common.retry"),
            onClick: () => void refetch(),
            loading: tokensQ.isRefetching,
          }}
        />
      </ResponsiveDialogBody>
    );
  }

  if (issued) {
    return (
      <>
        <ResponsiveDialogBody scrollFog>
          <div className="flex flex-col gap-x5">
            <Callout tone="warning" title={t("apiToken.issuedTitle")}>
              {t("apiToken.issuedDesc")}
            </Callout>
            <Field label={t("apiToken.tokenLabel")}>
              <Input
                readOnly
                value={issued.token}
                onFocus={(e) => e.currentTarget.select()}
                spellCheck={false}
                suffixAction={
                  <Button
                    variant="neutralWeak"
                    size="xsmall"
                    layout="iconOnly"
                    aria-label={t("apiToken.copy")}
                    onClick={() => void copy(issued.token)}
                  >
                    <Copy aria-hidden />
                  </Button>
                }
              />
            </Field>
            <Field label={t("apiToken.exampleLabel")}>
              <Textarea
                readOnly
                value={`curl -H "Authorization: Bearer ${issued.token}" "${exampleUrl()}"`}
                onFocus={(e) => e.currentTarget.select()}
                spellCheck={false}
                rows={4}
              />
            </Field>
            <p className="m-0 text-t3 text-fg-neutral-subtle break-keep [overflow-wrap:break-word]">
              {t("apiToken.scopeHint")}
            </p>
          </div>
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <Button
            size={wide ? "small" : "large"}
            className={wide ? undefined : "flex-1"}
            onClick={() =>
              flow.needCopyAsk ? flow.setCopyAsk("done") : flow.setIssued(null)
            }
          >
            {t("apiToken.done")}
          </Button>
        </ResponsiveDialogFooter>
      </>
    );
  }

  return (
    <>
      <ResponsiveDialogBody scrollFog>
        <div className="flex flex-col gap-x5">
          {flow.issue.isError && (
            <Callout tone="critical" role="alert">
              {t("apiToken.issueFailed")}
            </Callout>
          )}
          {isLoading && (
            <div className="flex flex-col gap-x3">
              <Skeleton radius="12" className="h-[56px] w-full" />
              <Skeleton radius="12" className="h-[56px] w-full" />
            </div>
          )}
          {tokens && tokens.length > 0 && (
            <List>
              {tokens.map((token) => (
                <ListItem
                  key={token.rowId}
                  title={token.name}
                  detail={[
                    `${token.tokenPrefix}…`,
                    t("apiToken.created", { date: dateOf(token.createAt) }),
                    token.lastUsedAt
                      ? t("apiToken.lastUsed", {
                          date: dateOf(token.lastUsedAt),
                        })
                      : t("apiToken.neverUsed"),
                  ].join(" · ")}
                  suffix={
                    <Button
                      variant="neutralWeak"
                      size="small"
                      aria-label={t("apiToken.revokeAria", {
                        name: token.name,
                      })}
                      loading={
                        flow.revoke.isPending &&
                        flow.revoke.variables === token.rowId
                      }
                      onClick={() => flow.setRevokeAsk(token)}
                    >
                      {t("apiToken.revoke")}
                    </Button>
                  }
                />
              ))}
            </List>
          )}
          {tokens?.length === 0 && (
            <p className="m-0 text-t3 text-fg-neutral-subtle">
              {t("apiToken.empty")}
            </p>
          )}
          <Field label={t("apiToken.nameLabel")}>
            <Input
              value={flow.tokenName}
              onChange={(e) => flow.setTokenName(e.target.value)}
              onKeyDown={(e) => {
                // 한글 조합 중 Enter 는 글자 확정이다 — 그때 발급이 나가면 이름이 잘린다.
                if (e.key === "Enter" && !e.nativeEvent.isComposing)
                  flow.issueToken();
              }}
              maxLength={TOKEN_NAME_MAX_LENGTH}
            />
          </Field>
          <p className="m-0 text-t3 text-fg-neutral-subtle break-keep [overflow-wrap:break-word]">
            {t("apiToken.scopeHint")}
          </p>
        </div>
      </ResponsiveDialogBody>
      <FormFooter
        cancelLabel={tc("cancel")}
        submitLabel={t("apiToken.issue")}
        loading={flow.issue.isPending}
        submitDisabled={!flow.canIssue}
        onSubmit={flow.issueToken}
      />
    </>
  );
}
