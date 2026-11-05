/**
 * 증권사 코드 ↔ 화면 표시명 ↔ URL 조각.
 *
 * 증권사 선택이 페이지 안 탭에서 **사이드바 하위 메뉴 + 경로**로 옮겨오면서, 같은 판단을
 * 사이드바·증권 화면 두 곳이 하게 됐다. 라벨과 경로 규칙이 두 벌이 되면 사이드바는
 * "나무증권" 이라 쓰고 화면은 "NAMU" 를 띄우는 식으로 갈리므로 여기 한 벌만 둔다.
 */
import { useTranslation } from "react-i18next";
import type { BrokerConnection } from "@/features/subscription/api/subscriptionApi";
import { useBrokerConnections } from "@/features/subscription/model/useSubscription";

/** URL 조각 → 증권사 코드. 경로는 소문자(`/desk/stocks/toss`), 서버 코드는 대문자(`TOSS`). */
export const brokerFromSlug = (slug: string | undefined): string | null =>
  slug ? slug.toUpperCase() : null;

/** 증권사 코드 → 경로. 증권사가 늘어도 코드를 그대로 내리므로 매핑표가 필요 없다. */
export const brokerPath = (broker: string): string =>
  `/desk/stocks/${broker.toLowerCase()}`;

/**
 * 어느 증권사를 기본으로 열지 — 기본 소스 → 첫 연결 순.
 * 연결이 하나도 없으면 `null` (부를 곳이 없다는 뜻이지 에러가 아니다).
 */
export const defaultBroker = (
  connected: string[],
  primary: string | null | undefined,
): string | null => {
  if (connected.length === 0) return null;
  if (primary && connected.includes(primary)) return primary;
  return connected[0] ?? null;
};

/**
 * 표시명 — **서버 `displayName` 이 1순위**다(`/v1/users/me/broker-connections`).
 * 서버가 증권사를 늘리면 프론트 배포 없이 이름이 따라온다.
 * 그 응답이 아직/영영 없을 때만 번역 키로, 그것도 없으면 코드를 그대로 — 라벨이 비지 않는다.
 */
export const brokerLabel = (
  t: (k: string) => string,
  broker: string,
  connections?: BrokerConnection[],
): string => {
  const fromServer = connections?.find((c) => c.broker === broker)?.displayName;
  if (fromServer) return fromServer;
  if (broker === "TOSS") return t("broker.toss");
  if (broker === "NAMU") return t("broker.namu");
  return broker;
};

/**
 * `brokerLabel` 훅 판. `enabled=false` 면 조회를 안 걸어 번역 키만 쓴다 —
 * 증권 구독이 없는 사용자에게 증권사 목록을 부르지 않으려는 것.
 */
export const useBrokerLabel = (
  enabled = true,
): ((broker: string) => string) => {
  const { t } = useTranslation("stocks");
  const { data: connections } = useBrokerConnections(enabled, {
    reference: true,
  });
  return (broker: string) => brokerLabel(t, broker, connections);
};
