import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  referenceMeta,
  referenceSilent,
  type ReferenceOpts,
} from "@/shared/api";
import { invalidateFor, subscriptionKeys } from "@/shared/config";
import { subscriptionApi } from "../api/subscriptionApi";

const SECURITIES = "SECURITIES";

/** 내 기능권한 + 증권사 연결상태. 메뉴 게이트·설정의 단일 소스. */
export const useMyFeatures = (opts?: { reference?: boolean }) =>
  useQuery({
    queryKey: subscriptionKeys.myFeatures(),
    queryFn: () => subscriptionApi.getMyFeatures(),
    staleTime: 60_000,
    ...referenceMeta(opts),
  });

/** 증권 기능권한 보유 여부 (로딩 중엔 false → 게이트 기본 닫힘). */
export const useHasSecurities = (): boolean => {
  const { data } = useMyFeatures({ reference: true });
  return data?.features?.includes(SECURITIES) ?? false;
};

export const useSubscriptionPlans = (opts?: { reference?: boolean }) =>
  useQuery({
    queryKey: [...subscriptionKeys.all, "plans"],
    queryFn: () => subscriptionApi.getPlans(),
    staleTime: 5 * 60_000,
    ...referenceMeta(opts),
  });

export const useMySubscription = (opts?: { reference?: boolean }) =>
  useQuery({
    queryKey: subscriptionKeys.mySubscription(),
    queryFn: () => subscriptionApi.getMySubscription(),
    staleTime: 60_000,
    ...referenceMeta(opts),
  });

export const useSubscribe = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (planCode: string) => subscriptionApi.subscribe(planCode),
    onSuccess: () => invalidateFor(queryClient, "subscription"),
  });
};

export const useCancelSubscription = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason?: string) => subscriptionApi.cancelSubscription(reason),
    onSuccess: () => invalidateFor(queryClient, "subscription"),
  });
};

/** 증권사를 하나라도 연결했는지 — 자산 연동·증권 화면 노출 판정. */
export const useHasBrokerConnection = (): boolean => {
  const { data } = useMyFeatures({ reference: true });
  return (data?.connectedBrokers?.length ?? 0) > 0;
};

/**
 * 전 증권사 연결 상태(미연결 포함). 설정 화면이 목록을 그리는 소스이자,
 * 사이드바·증권 화면이 표시명(`displayName`)을 가져오는 곳.
 *
 * `enabled` 는 사이드바 때문에 있다 — 사이드바는 모든 페이지에 떠 있으므로 증권 구독이
 * 없는 사용자에게까지 이 조회를 걸면 아무도 안 보는 요청이 매 세션 나간다.
 */
export const useBrokerConnections = (enabled = true, opts?: ReferenceOpts) =>
  useQuery({
    queryKey: subscriptionKeys.brokerConnections(),
    queryFn: () => subscriptionApi.getBrokerConnections(referenceSilent(opts)),
    ...referenceMeta(opts),
    staleTime: 60_000,
    enabled,
  });

export const useRegisterBrokerCredential = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      broker,
      apiKey,
      apiSecret,
    }: {
      broker: string;
      apiKey: string;
      apiSecret: string;
    }) => subscriptionApi.registerBrokerCredential(broker, apiKey, apiSecret),
    onSuccess: () => invalidateFor(queryClient, "broker-connection"),
  });
};

export const useDisconnectBrokerCredential = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (broker: string) =>
      subscriptionApi.disconnectBrokerCredential(broker),
    onSuccess: () => invalidateFor(queryClient, "broker-connection"),
  });
};

export const useSetPrimaryBroker = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (broker: string) => subscriptionApi.setPrimaryBroker(broker),
    onSuccess: () => invalidateFor(queryClient, "broker-connection"),
  });
};

/**
 * 프로그램용 API 토큰 목록. 증권사 연동 다이얼로그를 열 때만 읽는다.
 *
 * 목록에는 원문이 없다 — 원문은 발급 응답(`useIssueApiToken`)에서 한 번 보고 끝이다.
 */
export const useApiTokens = () =>
  useQuery({
    queryKey: subscriptionKeys.apiTokens(),
    queryFn: () => subscriptionApi.getApiTokens(),
    staleTime: 60_000,
  });

export const useIssueApiToken = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => subscriptionApi.issueApiToken(name),
    onSuccess: () => invalidateFor(queryClient, "api-token"),
  });
};

export const useRevokeApiToken = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rowId: number) => subscriptionApi.revokeApiToken(rowId),
    onSuccess: () => invalidateFor(queryClient, "api-token"),
  });
};
