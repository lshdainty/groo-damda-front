import type { ReactNode } from "react";
import { Link, Navigate, useOutletContext } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { MobileBackHeader } from "@/shared/ui/groo/mobile-back-header";
import { useMyFeatures } from "../model/useSubscription";

/**
 * 증권 라우트 가드 — 구독(SECURITIES) 미보유 시 왜 못 들어오는지 알려 준다.
 *
 * 종전엔 말없이 `/desk` 로 튕겼다(QA #5). 메뉴에서 이미 숨겨 둔 화면이라 여기 닿는
 * 사람은 옛 북마크·직접 URL 로 들어온 미구독자뿐인데, 홈으로 돌아가 버리면 주소를
 * 잘못 친 건지 기능이 없어진 건지 구분할 방법이 없다.
 *
 * 서버 차단(403)은 그대로다 — 이건 화면 안내일 뿐이다.
 */
export function SecuritiesGate({ children }: { children: ReactNode }) {
  const { data, isLoading, isError } = useMyFeatures();
  if (isLoading) {
    return null;
  }
  // 조회 자체가 실패한 건 '구독이 없다'가 아니다 — 팔 게 아닌데 파는 화면을 띄우느니
  // 종전처럼 홈으로 보낸다.
  if (isError) {
    return <Navigate to="/desk" replace />;
  }
  if (!data?.features?.includes("SECURITIES")) {
    return <SecuritiesUpsell />;
  }
  return <>{children}</>;
}

/**
 * 미구독 안내 — StocksPage 의 `ConnectGate`(증권사 미연결)와 같은 모양이다.
 * 같은 자리에 뜨는 두 안내가 서로 다르게 생기면 사용자는 다른 문제로 읽는다.
 */
function SecuritiesUpsell() {
  const { t } = useTranslation("subscription");
  // `/desk/stocks` 는 AppLayout FULLSCREEN_PATHS 라 모바일에 전역 헤더·탭바가 없다.
  // 자체 뒤로 헤더를 안 붙이면 나갈 길이 없는 화면이 된다.
  const { mobile } = useOutletContext<{ mobile: boolean }>();
  const body = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 8,
      }}
    >
      <div
        style={{
          fontSize: "var(--text-body-md)",
          fontWeight: 700,
          color: "var(--fg-primary)",
        }}
      >
        {t("gate.title")}
      </div>
      <div
        style={{
          fontSize: "var(--text-body-sm)",
          color: "var(--fg-tertiary)",
          lineHeight: 1.5,
        }}
      >
        {t("gate.desc")}
      </div>
      <Button variant="outline" size="sm" style={{ marginTop: 8 }} asChild>
        <Link to="/desk/settings?section=subscription">{t("gate.action")}</Link>
      </Button>
    </div>
  );
  // 모바일 카드 다이어트 — 안내도 배경 위 플랫(StocksPage ConnectGate 정합).
  const gate = mobile ? (
    <div style={{ padding: "40px 24px" }}>{body}</div>
  ) : (
    <Card style={{ padding: "40px 24px", maxWidth: 430, margin: "0 auto" }}>
      {body}
    </Card>
  );
  return mobile ? (
    <>
      <MobileBackHeader title={t("gate.title")} />
      <div style={{ padding: "16px 24px 24px" }}>{gate}</div>
    </>
  ) : (
    <div style={{ padding: 24 }}>{gate}</div>
  );
}
