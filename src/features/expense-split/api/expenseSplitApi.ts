import { apiClient, isHttpStatus } from "@/shared/api";
import type { QuietRequestConfig } from "@/shared/api";
import type { ApiResponse } from "@/shared/types";
import type {
  ExpenseSplit,
  ExpenseSplitFormValue,
} from "@/entities/expense-split";

export const expenseSplitApi = {
  /**
   * 거래에 딸린 분할 목록 — **부모가 없으면 오류가 아니라 빈 목록이다.**
   *
   * 서버는 지워진 거래의 하위 자원을 404 로 답한다. 그걸 그대로 전역 토스트로
   * 올리면 **거래를 지운 사람에게** "가계부 내역을 찾을 수 없어요" 가 뜬다 —
   * 삭제는 성공했는데도(QA #153). 지운 순간 그 아이디를 들고 떠 있는 화면이
   * 셋(거래 상세·편집 시트·분할 대화상자)이고, 무효화(`"ledger"` — 분할 키가
   * 들어 있다)가 그 조회를 다시 깨우기 때문이다.
   *
   * 고치는 자리를 **조회하는 여기 하나**로 잡는다. 지우는 쪽에서 캐시를 미리
   * 걷어내거나 대화상자를 먼저 닫는 식은 **지우는 경로가 늘 때마다 다시 샌다** —
   * 거래 삭제만이 아니라 자산 삭제·카드 결제 취소도 거래를 지우고, 다른 기기가
   * 지울 수도 있다. "부모가 없으면 분할도 없다" 는 판단은 순서를 안 탄다.
   *
   * 404 만 삼킨다(`silentStatuses`) — 5xx 는 그대로 토스트로 뜬다.
   */
  getSplits: async (expenseId: number): Promise<{ splits: ExpenseSplit[] }> => {
    const config: QuietRequestConfig = { silentStatuses: [404] };
    try {
      const resp: ApiResponse<{ splits: ExpenseSplit[] }> = await apiClient.get(
        `/v1/expense/${expenseId}/splits`,
        config,
      );
      return resp.data;
    } catch (e) {
      if (isHttpStatus(e, 404)) return { splits: [] };
      throw e;
    }
  },

  replaceSplits: async (
    expenseId: number,
    splits: ExpenseSplitFormValue[],
    opts?: { silent?: boolean },
  ): Promise<{ splits: ExpenseSplit[] }> => {
    const config: QuietRequestConfig = { silent: opts?.silent };
    const resp: ApiResponse<{ splits: ExpenseSplit[] }> = await apiClient.put(
      `/v1/expense/${expenseId}/splits`,
      { splits },
      config,
    );
    return resp.data;
  },

  deleteAllSplits: async (
    expenseId: number,
    opts?: { silent?: boolean },
  ): Promise<void> => {
    const config: QuietRequestConfig = { silent: opts?.silent };
    const resp: ApiResponse<void> = await apiClient.delete(
      `/v1/expense/${expenseId}/splits`,
      config,
    );
    return resp.data;
  },
};
