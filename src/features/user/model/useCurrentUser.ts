import { useQuery } from "@tanstack/react-query";
import { authApi } from "@/features/auth/api/authApi";
import { REFERENCE_META } from "@/shared/api";
import type { LoginCheckResponse } from "@/entities/session";

/** 현재 사용자 — 이름 · 이메일 · 역할 판정에 쓰는 참조 데이터. 실패는 앱 공용 스낵바 한 자리가 알린다(reference) */
export const useCurrentUser = () => {
  return useQuery<LoginCheckResponse>({
    queryKey: ["currentUser"],
    queryFn: () => authApi.loginCheck({ silent: true }),
    staleTime: 5 * 60 * 1000,
    meta: REFERENCE_META,
  });
};
