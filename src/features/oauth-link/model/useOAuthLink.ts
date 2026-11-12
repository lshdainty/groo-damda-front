import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateFor, oauthKeys } from "@/shared/config";
import { oauthLinkApi } from "../api/oauthLinkApi";

/** 연동 가능한 provider 목록 + 각 provider 의 연동 여부 조회 */
export const useOAuthProviders = () =>
  useQuery({
    queryKey: oauthKeys.providers(),
    queryFn: () => oauthLinkApi.getProviders(),
  });

/** 소셜 계정 연동 해제(재인증 티켓 필요 — S-2 잔여). 성공 시 provider 목록 재조회로 상태 갱신 */
export const useUnlinkOAuth = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      provider,
      reauthToken,
    }: {
      provider: string;
      reauthToken: string;
    }) => oauthLinkApi.unlink(provider, reauthToken),
    onSuccess: () => invalidateFor(queryClient, "oauth-link"),
  });
};
