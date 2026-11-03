import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateFor } from "@/shared/config";
import { commitSms, type SmsCommitRequest } from "../api/smsApi";

/**
 * 결제 문자로 지출 만들기.
 *
 * 일반 생성 대신 이 경로를 쓰는 이유 — 서버가 원문을 다시 봐 취소 문자를 막고,
 * 체크했다면 (카드 힌트 → 자산) 을 기억한다. 만들어지는 지출 자체는 같으므로
 * 무효화 범위도 일반 생성과 같다.
 */
export const useCommitSms = (opts?: { silent?: boolean }) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: SmsCommitRequest) => commitSms(request, opts),
    onSuccess: () => invalidateFor(queryClient, "ledger"),
  });
};
