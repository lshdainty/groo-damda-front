import type { ReactNode } from "react";
import { useOutletContext } from "react-router-dom";
import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ResultSection } from "@/shared/ds/result-section";
import {
  TopNavigation,
  TopNavigationBackButton,
  TopNavigationTitle,
} from "@/shared/ds/top-navigation";
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
  const { data, isLoading, isError, refetch, isRefetching } = useMyFeatures();
  if (isLoading) {
    return null;
  }
  // 조회 자체가 실패한 건 '구독이 없다'가 아니다 — 팔 게 아닌데 파는 화면을 띄우지도, 말없이 홈으로 튕기지도 않는다.
  // 그 자리에서 실패를 말하고 다시 시도하게 한다. 이미 받아 둔 값이 있으면(재조회만 실패) 그 값으로 간다 —
  // Pro 사용자가 창 초점 재조회 하나 실패했다고 내쫓기지 않는다.
  if (isError && data === undefined) {
    return (
      <GateLoadFailed onRetry={() => void refetch()} loading={isRefetching} />
    );
  }
  if (!data?.features?.includes("SECURITIES")) {
    return <SecuritiesUpsell />;
  }
  return <>{children}</>;
}

/**
 * 폰 본문 면 — ConnectGate 와 같은 흰 면(bg-layer-default) · 상단 바(56) 아래 화면 끝까지 · 세로 가운데.
 * 셸 바닥(basement) 위에 안내 · 단추를 두면 neutralWeak 단추의 채움이 사라진다(button.md "놓는 바탕", I-wrap-b1 ε M1)
 */
const MOBILE_FACE =
  "flex min-h-[calc(100dvh-3.5rem)] flex-col justify-center bg-bg-layer-default";

/** 기능 조회 실패 — 그 자리 Result Section + [다시 시도](서버 글을 내지 않는다) */
function GateLoadFailed({
  onRetry,
  loading,
}: {
  onRetry: () => void;
  loading: boolean;
}) {
  const { t } = useTranslation("subscription");
  const { t: tDs } = useTranslation("ds");
  const { mobile } = useOutletContext<{ mobile: boolean }>();
  const result = (
    <ResultSection
      kind="failure"
      size="medium"
      title={t("gate.loadError")}
      description={t("loadErrorHint")}
      primaryAction={{
        label: tDs("common.retry"),
        onClick: onRetry,
        loading,
      }}
    />
  );
  // 전체 화면 라우트라 폰에는 전역 헤더가 없다 — 나갈 길(뒤로)을 붙인다(미구독 안내와 같다)
  return mobile ? (
    <>
      {/* 실패 화면이라 "구독이 필요해요" 제목은 달지 않는다 — 뒤로 길만. ds 상단 바(56 · 뒤로 44 — top-navigation.md) */}
      <TopNavigation type="standard">
        <TopNavigationBackButton fallbackHref="/desk/more" />
      </TopNavigation>
      <div className={MOBILE_FACE}>{result}</div>
    </>
  ) : (
    <div style={{ padding: 24 }}>{result}</div>
  );
}

/**
 * 미구독 안내 — StocksPage 의 `ConnectGate`(증권사 미연결)와 같은 모양이다(Result Section empty).
 * 같은 자리에 뜨는 두 안내가 서로 다르게 생기면 사용자는 다른 문제로 읽는다.
 */
function SecuritiesUpsell() {
  const { t } = useTranslation("subscription");
  // `/desk/stocks` 는 AppLayout FULLSCREEN_PATHS 라 모바일에 전역 헤더·탭바가 없다.
  // 자체 뒤로 헤더를 안 붙이면 나갈 길이 없는 화면이 된다.
  const { mobile } = useOutletContext<{ mobile: boolean }>();
  const gate = (
    <ResultSection
      kind="empty"
      icon={<Lock aria-hidden />}
      title={t("gate.title")}
      description={t("gate.desc")}
      primaryAction={{
        label: t("gate.action"),
        href: "/desk/settings?section=subscription",
      }}
      className="px-x6 py-x6"
    />
  );
  return mobile ? (
    <>
      {/* ds 상단 바(56 · 뒤로 44 — top-navigation.md), StocksPage ConnectGate 와 같은 머리 */}
      <TopNavigation type="standard">
        <TopNavigationBackButton fallbackHref="/desk/more" />
        <TopNavigationTitle>{t("gate.title")}</TopNavigationTitle>
      </TopNavigation>
      <div className={MOBILE_FACE}>{gate}</div>
    </>
  ) : (
    <div
      data-slot="securities-gate"
      className="flex min-h-[70dvh] flex-col justify-center rounded-[16px] bg-bg-layer-default"
    >
      {gate}
    </div>
  );
}
