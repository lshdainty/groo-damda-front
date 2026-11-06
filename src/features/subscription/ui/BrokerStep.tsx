import { useTranslation } from "react-i18next";
import { CircleCheck } from "lucide-react";
import { Badge } from "@/shared/ds/badge";
import { Button } from "@/shared/ds/button";
import { Callout } from "@/shared/ds/callout";
import { List, ListItem } from "@/shared/ds/list";
import { LogoTile } from "@/shared/ds/logo-tile";
import {
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
} from "@/shared/ds/dialog";
import { useWideSurface } from "@/shared/ds/overlay";
import { FormFooter } from "@/shared/ui/groo/form-footer";
import { SecretField } from "@/features/subscription/ui/SecretField";
import { verifiedDate } from "@/features/subscription/lib/verified-date";
import type { BrokerConnection } from "@/features/subscription/api/subscriptionApi";
import type { SecuritiesLinkFlow } from "@/features/subscription/model/useSecuritiesLinkFlow";

/**
 * 증권사 한 곳의 다음 단계 — 연결 전이면 키 입력 폼, 연결됐으면 상태 조회(연결 해제 · 기본으로 쓰기).
 *
 * **증권사 이름을 프론트에 박지 않는다.** 표시명·발급처·입력 라벨은 서버가 주는 `BrokerConnection` 에서 온다.
 * 시크릿은 서버에 암호화 저장되며 응답으로 반환되지 않는다(연결 여부만 표시).
 *
 * 쓰던 키 · 눈 · 요청 상태는 부르는 쪽(`useSecuritiesLinkFlow`, 표면 위)이 든다 — 표면이 바뀌어도 남는다.
 * 머리(제목 · ← · ✕)는 부르는 쪽 `ResponsiveDialogContent` 가 그린다. 이 부품은 본문 + 바닥이다.
 */
export function BrokerStep({
  connection,
  flow,
}: {
  connection: BrokerConnection;
  flow: SecuritiesLinkFlow;
}) {
  return connection.connected ? (
    <ConnectedView connection={connection} flow={flow} />
  ) : (
    <KeyForm connection={connection} flow={flow} />
  );
}

function KeyForm({
  connection,
  flow,
}: {
  connection: BrokerConnection;
  flow: SecuritiesLinkFlow;
}) {
  const { t } = useTranslation("subscription");
  const { t: tc } = useTranslation("common");
  const { broker, displayName, keyLabel, secretLabel } = connection;
  const d = flow.draftOf(broker);
  const canConnect = d.key.trim().length > 0 && d.secret.trim().length > 0;

  return (
    <>
      <ResponsiveDialogBody scrollFog>
        <div className="flex flex-col gap-x5">
          {/* 키를 고쳐 다시 넣는 폼이라 실패는 폼 위 Callout(고정 글) — 서버 글 없음, 쓴 값 그대로 */}
          {flow.register.isError && (
            <Callout tone="critical" role="alert">
              {flow.connectFailedText}
            </Callout>
          )}
          {/* 라벨은 서버가 준다 — 회사마다 같은 자리를 다르게 부른다. 키도 시크릿과 같은 자격증명의 반쪽이라 같은 칸을 쓴다 */}
          <SecretField
            label={keyLabel}
            value={d.key}
            onChange={(v) => flow.patchDraft(broker, { key: v })}
            revealed={d.showKey}
            onRevealedChange={(v) => flow.patchDraft(broker, { showKey: v })}
            toggleAriaLabel={t("broker.toggleReveal", { field: keyLabel })}
          />
          <SecretField
            label={secretLabel}
            value={d.secret}
            onChange={(v) => flow.patchDraft(broker, { secret: v })}
            revealed={d.showSecret}
            onRevealedChange={(v) => flow.patchDraft(broker, { showSecret: v })}
            toggleAriaLabel={t("broker.toggleReveal", { field: secretLabel })}
          />
          <p className="m-0 text-t3 text-fg-neutral-subtle break-keep [overflow-wrap:break-word]">
            {t("broker.keyHint", { broker: displayName })}
          </p>
        </div>
      </ResponsiveDialogBody>
      <FormFooter
        cancelLabel={tc("cancel")}
        submitLabel={t("broker.connect")}
        loading={flow.register.isPending}
        submitDisabled={!canConnect}
        onSubmit={() => flow.connect(connection)}
      />
    </>
  );
}

function ConnectedView({
  connection,
  flow,
}: {
  connection: BrokerConnection;
  flow: SecuritiesLinkFlow;
}) {
  const { t } = useTranslation("subscription");
  const wide = useWideSurface();
  const size = wide ? "small" : "large";
  const { displayName, primary, verifiedAt } = connection;
  const date = verifiedDate(verifiedAt);
  // 연결이 둘 이상일 때만 고를 의미가 있다 — 이미 기본이면 버튼 없이 이름 옆 배지가 말한다
  const connectedCount =
    flow.connections?.filter((c) => c.connected).length ?? 0;
  const showPrimaryButton = connectedCount > 1 && !primary;

  return (
    <>
      <ResponsiveDialogBody>
        <div className="flex flex-col gap-x4">
          <List>
            <ListItem
              prefix={<LogoTile name={displayName} />}
              title={
                <>
                  {t("broker.keyConnected", { broker: displayName })}
                  {primary && (
                    <Badge
                      variant="weak"
                      tone="brand"
                      className="ml-x1_5 align-middle"
                    >
                      {t("broker.primary")}
                    </Badge>
                  )}
                </>
              }
              detail={
                date
                  ? t("broker.verifiedOn", { date })
                  : t("broker.autoCollecting")
              }
              suffix={<CircleCheck aria-hidden className="text-fg-positive" />}
            />
          </List>
          {showPrimaryButton && (
            <p className="m-0 text-t3 text-fg-neutral-subtle break-keep [overflow-wrap:break-word]">
              {t("broker.primaryHint")}
            </p>
          )}
        </div>
      </ResponsiveDialogBody>
      <ResponsiveDialogFooter>
        <div className="flex w-full items-center gap-x2">
          <Button
            variant="ghost"
            ghostColor="critical"
            size={size}
            className="shrink-0"
            onClick={() => flow.setDisconnectAsk(connection)}
          >
            {t("broker.disconnect")}
          </Button>
          {showPrimaryButton && (
            <Button
              size={size}
              className={wide ? "ml-auto" : "flex-1"}
              loading={flow.setPrimary.isPending}
              onClick={() => flow.makePrimary(connection)}
            >
              {t("broker.useAsPrimary")}
            </Button>
          )}
        </div>
      </ResponsiveDialogFooter>
    </>
  );
}
