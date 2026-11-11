import { useMutation, useQuery } from "@tanstack/react-query";
import { userApi } from "../api/userApi";
import type { ReauthPurpose, WithdrawalCheck } from "../api/userApi";

/**
 * 해지 전 점검.
 *
 * <p>`enabled` 로 여는 이유 — 설정 화면을 열 때마다 물으면 안 된다. 해지 흐름에
 * 들어선 사람만 묻는다.
 *
 * <p>캐시하지 않는다(`staleTime: 0`). 구독을 방금 해지하고 돌아온 사람에게 낡은
 * "구독이 남아 있어요" 를 보여 주면, 되는 일을 안 된다고 말하는 셈이다.
 */
export const useWithdrawalCheck = (enabled: boolean) =>
  useQuery<WithdrawalCheck>({
    queryKey: ["user", "withdrawal-check"],
    queryFn: () => userApi.withdrawalCheck(),
    enabled,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

/*
 * 아래 재인증 셋은 해지와 소셜 연동이 함께 쓴다(`useReauth`). 파일 이름이 해지인 것은 먼저
 * 생긴 쪽이라서다 — 옮기면 이 파일을 통째로 바꿔 끼우는 해지 다이얼로그 테스트가 끊긴다.
 */

/** 본인 메일로 재인증 코드 발송. 코드에는 쓰임새가 없다 — 확인할 때 정한다. */
export const useSendReauthEmailCodeMutation = () =>
  useMutation<void, Error, void>({
    mutationFn: () => userApi.sendReauthEmailCode(),
  });

/** 코드 확인 → `purpose` 용 재인증 티켓. */
export const useVerifyReauthEmailCodeMutation = (purpose: ReauthPurpose) =>
  useMutation<string, Error, string>({
    mutationFn: (code: string) => userApi.verifyReauthEmailCode(code, purpose),
  });

/** 비밀번호 확인 → `purpose` 용 재인증 티켓. */
export const useVerifyReauthPasswordMutation = (purpose: ReauthPurpose) =>
  useMutation<string, Error, string>({
    mutationFn: (password: string) =>
      userApi.verifyReauthPassword(password, purpose),
  });

/**
 * 그루 담다 이용 해지.
 *
 * <p>성공하면 이 세션은 곧 끝난다 — 호출한 쪽이 로그아웃까지 책임진다.
 * 여기서 쿼리 캐시를 무효화하지 않는 것도 그래서다. 되살릴 화면이 없다.
 */
export const useWithdrawMutation = () =>
  useMutation<void, Error, { reauthToken: string; reason?: string }>({
    mutationFn: ({ reauthToken, reason }) =>
      userApi.withdraw(reauthToken, reason),
  });
