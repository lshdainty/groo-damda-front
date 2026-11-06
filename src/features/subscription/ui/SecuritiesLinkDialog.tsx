import { loadFailed } from "@/shared/api";
import { useTranslation } from "react-i18next";
import { Unplug } from "lucide-react";
import { ModalShell } from "@/shared/ui/groo/dialogs";
import { Skeleton } from "@/shared/ui/skeleton";
import { ApiTokenCard } from "@/features/subscription/ui/ApiTokenCard";
import { BrokerConnectCard } from "@/features/subscription/ui/BrokerConnectCard";
import { useBrokerConnections } from "@/features/subscription/model/useSubscription";

/**
 * 증권사 연동 다이얼로그.
 *
 * 예전에는 토스 키 입력이 계정 설정 안에 인라인 카드로 덩그러니 있었다. 증권사가 둘 이상이
 * 되면 그 자리에 카드를 쌓을 수 없어 분리했다(앱은 같은 이유로 `/settings/securities` 화면).
 *
 * **목록은 서버가 준다.** 미연결 증권사까지 내려오므로 증권사가 늘어도 프론트 배포 없이 나타난다.
 */
export function SecuritiesLinkDialog({
  onClose,
  mobile,
}: {
  onClose: () => void;
  mobile: boolean;
}) {
  const { t } = useTranslation("subscription");
  const { data: connections, isLoading, isError } = useBrokerConnections();

  // 연결이 하나뿐이면 기본 소스를 고를 게 없다 — 버튼을 감춘다.
  const connectedCount = connections?.filter((c) => c.connected).length ?? 0;

  return (
    <ModalShell
      title={t("broker.title")}
      onClose={onClose}
      size="md"
      mobile={mobile}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div
          style={{
            fontSize: 12,
            color: "var(--fg-secondary)",
            lineHeight: 1.6,
          }}
        >
          {t("broker.pageDesc")}
        </div>

        {isLoading && (
          <>
            <Skeleton
              style={{ height: 180, borderRadius: "var(--radius-lg)" }}
            />
            <Skeleton
              style={{ height: 180, borderRadius: "var(--radius-lg)" }}
            />
          </>
        )}

        {loadFailed({ isError, data: connections }) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "16px 14px",
              color: "var(--fg-secondary)",
              fontSize: 13,
            }}
          >
            <Unplug size={18} />
            {t("broker.loadFailed")}
          </div>
        )}

        {connections?.map((c) => (
          <BrokerConnectCard
            key={c.broker}
            connection={c}
            showPrimaryAction={connectedCount > 1}
          />
        ))}

        {/*
          증권사 카드 아래에 둔다 — 토큰은 위에서 연결한 키로 가는 길이라 읽는 순서가 그렇다.
          연결이 하나도 없어도 감추지 않는다. 연결을 끊은 뒤에도 남은 토큰을 보고 폐기할 수 있어야 한다.
        */}
        {connections && <ApiTokenCard />}
      </div>
    </ModalShell>
  );
}
