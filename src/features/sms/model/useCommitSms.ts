import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateFor } from "@/shared/config";
import { isWriteUnconfirmed } from "@/shared/api";
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
    // 응답을 못 읽었다(PARSE) — 서버는 처리했을 수 있다. 성공 때와 같은 범위를 다시 받아 목록이 진실을 보이게 한다
    onError: (error) => {
      if (isWriteUnconfirmed(error)) invalidateFor(queryClient, "ledger");
    },
  });
};
