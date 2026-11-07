import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, KeyRound } from "lucide-react";
import { loadFailed } from "@/shared/api";
import { useWideSurface } from "@/shared/ds/overlay";
import { useStepBack } from "@/shared/ui/groo/use-step-back";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  useLeaveConfirm,
} from "@/shared/ds/alert-dialog";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
} from "@/shared/ds/dialog";
import { List, ListButtonItem, ListHeader, ListTile } from "@/shared/ds/list";
import { LogoTile } from "@/shared/ds/logo-tile";
import { ResultSection } from "@/shared/ds/result-section";
import { Skeleton } from "@/shared/ds/skeleton";
import { BrokerTitle } from "@/features/subscription/ui/BrokerTitle";
import { ApiTokenStep } from "@/features/subscription/ui/ApiTokenStep";
import { BrokerStep } from "@/features/subscription/ui/BrokerStep";
import { verifiedDate } from "@/features/subscription/lib/verified-date";
import {
  useSecuritiesLinkFlow,
  type SecuritiesLinkFlow,
} from "@/features/subscription/model/useSecuritiesLinkFlow";
import {
  useApiTokens,
  useBrokerConnections,
} from "@/features/subscription/model/useSubscription";

/**
 * 증권사 연동 시트 · 대화상자 — 결정 B(I-wrap-b1 β): 첫 단계는 증권사 줄 목록, 줄을 누르면 같은 표면 안 다음 단계.
 *
 * 예전에는 증권사마다 카드가 펼쳐져 폼이 증권사 수만큼 쌓였다. 줄 목록 → 다음 단계로 바꿔 폼은 한 번에 하나고,
 * 증권사가 늘어도 줄만 는다. **목록은 서버가 준다** — 미연결 증권사까지 내려오므로 배포 없이 나타난다.
 *
 * 표면(시트 ↔ 대화상자)은 1280 에서 `ResponsiveDialog` 가 가른다. 단계 · 쓰던 키 · 요청은 `useSecuritiesLinkFlow` 가
 * 표면 위에서 들고 있어 폭을 넘나들어도 입력한 키가 남는다. 앱은 같은 흐름이 `/settings/securities/:broker` 라우트다.
 */
export function SecuritiesLinkDialog({
  open,
  onClose,
  onClosed,
}: {
  open: boolean;
  /** 닫기를 청한다(✕ · Esc · 바깥 · 확인) — 부르는 쪽이 `open` 을 false 로 */
  onClose: () => void;
  /** 닫힘 모션(시트 ~500ms)이 끝났다 — 부르는 쪽이 이 시트를 내린다(상태 · 쓰던 키가 함께 사라진다) */
  onClosed: () => void;
}) {
  const { t } = useTranslation("subscription");
  const { t: tc } = useTranslation("common");
  const connectionsQ = useBrokerConnections();
  const tokensQ = useApiTokens();
  const connections = connectionsQ.data;
  const flow = useSecuritiesLinkFlow(connections);
  const contentRef = useRef<HTMLDivElement>(null);
  const wide = useWideSurface();

  // 닫기 = open 을 먼저 내려 닫힘 모션 · 초점 복귀(연 줄)를 ds 가 하게 하고, 모션이 끝난 뒤 통째로 내린다.
  // 내리면 단계 · 쓰던 키 · 발급 원문(훅 상태)이 함께 사라진다 — 다시 열면 늘 처음이다
  const onClosedRef = useRef(onClosed);
  useEffect(() => {
    onClosedRef.current = onClosed;
  });
  useEffect(() => {
    if (open) return;
    const id = window.setTimeout(() => onClosedRef.current(), 800);
    return () => window.clearTimeout(id);
  }, [open]);

  const step = flow.step;
  const brokerStep =
    step.kind === "broker"
      ? connections?.find((c) => c.broker === step.broker)
      : undefined;
  // 목록에서 사라진 증권사의 단계는 첫 단계로 본다
  const kind = step.kind === "broker" && !brokerStep ? "list" : step.kind;

  // 단계가 바뀔 때 초점 — 들어가면 새 단계 제목, 첫 단계로 돌아오면 누른 줄(누른 줄 · ← 가 사라지며 초점이 표면으로 떨어지지 않게)
  const lastRow = useRef<string | null>(null);
  const focusKey = `${kind}:${step.kind === "broker" ? step.broker : ""}:${brokerStep?.connected ?? ""}:${flow.issued ? "issued" : ""}`;
  const prevFocusKey = useRef(focusKey);
  useEffect(() => {
    if (prevFocusKey.current === focusKey) return;
    prevFocusKey.current = focusKey;
    const root = contentRef.current;
    if (!root) return;
    if (kind === "list") {
      root
        .querySelector<HTMLElement>(`[data-sec-row="${lastRow.current}"]`)
        ?.focus({ preventScroll: true });
    } else {
      const title = root.querySelector<HTMLElement>('[data-slot$="-title"]');
      if (title) {
        title.tabIndex = -1;
        title.focus({ preventScroll: true });
      }
    }
  }, [focusKey, kind]);

  const backAsk = useLeaveConfirm({
    dirty: flow.brokerDirty || flow.tokenDirty,
    contentRef,
    leave: flow.backToList,
  });

  // 기기 뒤로 가기(1280 미만) = 한 단계 뒤 — 첫 단계에서만 시트가 닫힌다. 묻고만 끝났으면 칸을 다시 쌓는다
  useStepBack(open && !wide && kind !== "list", () => {
    if (flow.needCopyAsk) {
      flow.setCopyAsk("back");
      return false;
    }
    return backAsk.request();
  });

  const tokenFormShown =
    kind === "tokens" &&
    !flow.issued &&
    !loadFailed({ isError: tokensQ.isError, data: tokensQ.data });
  // 입력 폼 — 연결 전 키 입력 · 토큰 만들기. 조회(첫 단계 · 연결됨 · 발급 직후)는 머리 ✕ 가 닫는다
  const form = (kind === "broker" && !brokerStep?.connected) || tokenFormShown;

  const title =
    kind === "broker"
      ? (brokerStep?.displayName ?? "")
      : kind === "tokens"
        ? t("apiToken.title")
        : t("broker.title");

  return (
    <>
      <ResponsiveDialog
        open={open}
        form={form}
        dirty={flow.brokerDirty || flow.tokenDirty}
        busy={flow.busy}
        onOpenChange={(next) => {
          if (next) return;
          // 발급 직후 원문을 복사하지 않았으면 닫기(✕ · Esc · 바깥) 전에 한 번 묻는다
          if (flow.needCopyAsk) flow.setCopyAsk("close");
          else onClose();
        }}
      >
        <ResponsiveDialogContent
          ref={contentRef}
          title={title}
          onBack={
            kind === "list"
              ? undefined
              : () =>
                  flow.needCopyAsk ? flow.setCopyAsk("back") : backAsk.request()
          }
        >
          {kind === "list" ? (
            <ListStep
              flow={flow}
              loading={connectionsQ.isLoading}
              failed={loadFailed({
                isError: connectionsQ.isError,
                data: connections,
              })}
              retrying={connectionsQ.isRefetching}
              onRetry={() => void connectionsQ.refetch()}
              tokenCount={tokensQ.data?.length}
              tokenLoading={tokensQ.isLoading}
              onOpenRow={(key) => {
                lastRow.current = key;
              }}
            />
          ) : kind === "broker" && brokerStep ? (
            <BrokerStep connection={brokerStep} flow={flow} />
          ) : (
            <ApiTokenStep flow={flow} />
          )}
        </ResponsiveDialogContent>
      </ResponsiveDialog>
      {backAsk.node}

      {/* 연결 해제 — 확인창 한 번. 실패는 critical 스낵바 + [다시 시도] */}
      <AlertDialog
        open={flow.disconnectAsk != null}
        onOpenChange={(open) => {
          if (!open) flow.setDisconnectAsk(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>
            {t("broker.disconnectAsk", {
              broker: flow.disconnectAsk?.displayName ?? "",
            })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("broker.disconnectDesc")}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="criticalSolid"
              onClick={() => {
                const target = flow.disconnectAsk;
                if (target) void flow.runDisconnect(target);
              }}
            >
              {t("broker.disconnect")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 발급 직후 원문을 복사하지 않고 나간다 — 한 번이라도 복사했으면 묻지 않는다 */}
      <AlertDialog
        open={flow.copyAsk != null}
        onOpenChange={(open) => {
          if (!open) flow.setCopyAsk(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>{t("apiToken.copyAskTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("apiToken.copyAskDesc")}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="criticalSolid"
              onClick={() => {
                const how = flow.copyAsk;
                if (how === "close") onClose();
                else if (how === "back") flow.backToList();
                else flow.setIssued(null);
              }}
            >
              {t("apiToken.copyAskClose")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 토큰 폐기 — 확인창 한 번 */}
      <AlertDialog
        open={flow.revokeAsk != null}
        onOpenChange={(open) => {
          if (!open) flow.setRevokeAsk(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>
            {t("apiToken.revokeAsk", { name: flow.revokeAsk?.name ?? "" })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("apiToken.revokeDesc")}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="criticalSolid"
              onClick={() => {
                const target = flow.revokeAsk;
                if (target) void flow.runRevoke(target);
              }}
            >
              {t("apiToken.revoke")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** 첫 단계 — 안내 글 + 증권사 줄 + (웹만) 내 프로그램에서 쓰기 › API 토큰 */
function ListStep({
  flow,
  loading,
  failed,
  retrying,
  onRetry,
  tokenCount,
  tokenLoading,
  onOpenRow,
}: {
  flow: SecuritiesLinkFlow;
  loading: boolean;
  failed: boolean;
  retrying: boolean;
  onRetry: () => void;
  tokenCount: number | undefined;
  tokenLoading: boolean;
  onOpenRow: (key: string) => void;
}) {
  const { t } = useTranslation("subscription");
  const { t: tDs } = useTranslation("ds");
  const connections = flow.connections;

  return (
    <ResponsiveDialogBody scrollFog>
      <p className="m-0 mb-x4 text-t4 text-fg-neutral-muted break-keep [overflow-wrap:break-word]">
        {t("broker.pageDesc")}
      </p>

      {loading && (
        <div className="flex flex-col gap-x3">
          <Skeleton radius="12" className="h-[64px] w-full" />
          <Skeleton radius="12" className="h-[64px] w-full" />
        </div>
      )}

      {failed && (
        <ResultSection
          kind="failure"
          size="medium"
          title={t("broker.loadFailed")}
          primaryAction={{
            label: tDs("common.retry"),
            onClick: onRetry,
            loading: retrying,
          }}
        />
      )}

      {connections && (
        <>
          <List aria-label={t("broker.title")}>
            {connections.map((c) => {
              const date = verifiedDate(c.verifiedAt);
              return (
                <ListButtonItem
                  key={c.broker}
                  prefix={<LogoTile name={c.displayName} />}
                  title={
                    <BrokerTitle name={c.displayName} primary={c.primary} />
                  }
                  detail={
                    c.connected
                      ? date
                        ? t("broker.rowConnected", { date })
                        : t("broker.rowConnectedNoDate")
                      : t("broker.rowDisconnected")
                  }
                  suffix={<ChevronRight aria-hidden />}
                  data-sec-row={c.broker}
                  onClick={() => {
                    onOpenRow(c.broker);
                    flow.go({ kind: "broker", broker: c.broker });
                  }}
                />
              );
            })}
          </List>
          {/* 토큰은 증권사 하나에 묶이지 않는 "내 프로그램 열쇠" — 연결이 하나도 없어도 감추지 않는다(끊은 뒤에도 폐기할 수 있어야 한다) */}
          <ListHeader as="h3" id="sec-program-group" className="mt-x4">
            {t("broker.programGroup")}
          </ListHeader>
          <List aria-labelledby="sec-program-group">
            <ListButtonItem
              prefix={
                <ListTile>
                  <KeyRound aria-hidden />
                </ListTile>
              }
              title={t("apiToken.title")}
              suffix={
                <>
                  {tokenLoading
                    ? null
                    : tokenCount == null
                      ? null
                      : tokenCount === 0
                        ? t("apiToken.countNone")
                        : t("apiToken.count", { n: tokenCount })}
                  <ChevronRight aria-hidden />
                </>
              }
              data-sec-row="tokens"
              onClick={() => {
                onOpenRow("tokens");
                flow.go({ kind: "tokens" });
              }}
            />
          </List>
        </>
      )}
    </ResponsiveDialogBody>
  );
}
