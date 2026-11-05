import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { expenseSplitKeys, invalidateFor } from "@/shared/config";
import { expenseSplitApi } from "../api/expenseSplitApi";
import type { ExpenseSplitFormValue } from "@/entities/expense-split";

export const useExpenseSplits = (expenseId: number | null | undefined) => {
  return useQuery({
    queryKey: expenseSplitKeys.list(expenseId ?? 0),
    queryFn: async () => {
      if (!expenseId) return [];
      const response = await expenseSplitApi.getSplits(expenseId);
      return response.splits;
    },
    enabled: !!expenseId,
  });
};

/**
 * 분할 저장·삭제는 **거래 변경과 파급이 같다**(`"ledger"`).
 *
 * 분할은 거래 하나를 쪼개는 것이므로 움직이는 금액이 거래를 고칠 때와 다르지 않다.
 * 예전엔 분할 목록·가계부·자산만 손으로 비웠는데, 그러면 카드 실적과 홈 합계가
 * 옛 값으로 남는다 — 비우는 자리를 호출처마다 손으로 나열하다 빠뜨린, #141 과
 * 같은 종류의 누락이다. 어느 도메인이 딸려 늙는지는 `INVALIDATION_MAP` 이 안다.
 */
export const useReplaceExpenseSplits = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      expenseId,
      splits,
      silent,
    }: {
      expenseId: number;
      splits: ExpenseSplitFormValue[];
      /** 실패를 호출처(나누기 단계 맨 위 Callout)가 알리면 true */
      silent?: boolean;
    }) => expenseSplitApi.replaceSplits(expenseId, splits, { silent }),
    onSuccess: () => invalidateFor(queryClient, "ledger"),
  });
};

export const useDeleteAllExpenseSplits = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      expenseId,
      silent,
    }: {
      expenseId: number;
      /** 실패를 호출처(스낵바 + [다시 시도])가 알리면 true */
      silent?: boolean;
    }) => expenseSplitApi.deleteAllSplits(expenseId, { silent }),
    onSuccess: () => invalidateFor(queryClient, "ledger"),
  });
};
