import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnackbar } from "@/shared/ds/snackbar";
import type { ExpenseType } from "@/entities/expense";
import { groupForFixed } from "../lib/fixed-groups";
import { useBulkMarkFixed, useExpenses } from "./useExpenses";

export type FixedBulkTarget = "fixed" | "variable";

/**
 * 거래를 고정으로 정리하는 화면의 상태(1280 미만 페이지 · 이상 대화상자가 함께 쓴다) — 종류(지출 · 수입), 바꿀 방향, 고른 묶음, 적용.
 * 돈 · 잔액은 안 움직이고 통계의 분류만 바뀐다.
 */
export function useFixedBulk({
  startDate,
  endDate,
  onClose,
}: {
  startDate: string;
  endDate: string;
  onClose: () => void;
}) {
  const { t } = useTranslation("stats");
  const [kind, setKindState] = useState<ExpenseType>("EXPENSE");
  const [target, setTarget] = useState<FixedBulkTarget>("fixed");
  const [picked, setPicked] = useState<ReadonlySet<number>>(new Set());
  const snackbar = useSnackbar();
  const q = useExpenses({ startDate, endDate });
  const mut = useBulkMarkFixed();
  const groups = groupForFixed(q.data ?? [], kind, t("fixed.bulk.untitled"));
  const toFixed = target === "fixed";
  // 적용 중에 기기 뒤로 가기로 화면을 떠났으면 응답이 와도 닫지 않는다(이미 떠난 뒤 한 걸음 더 물러나면 안 된다)
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const setKind = (next: ExpenseType) => {
    setKindState(next);
    setPicked(new Set());
  };
  const apply = () => {
    if (picked.size === 0 || mut.isPending) return;
    // 실패는 스낵바가 아니라 폼 맨 위 Callout(`mut.isError`, 두 화면이 보여 준다) — 폼은 열린 채 · 고른 것 그대로, 다시 시도는 [다시 시도].
    // 성공은 닫은 뒤 스낵바(neutral). 스낵바는 Provider 소유라 이 훅이 사라져도 남는다.
    const dirToFixed = toFixed;
    mut
      .mutateAsync({ ids: [...picked], isFixed: dirToFixed, silent: true })
      .then(
        ({ updatedCount }) => {
          snackbar.show({
            message: t(
              dirToFixed ? "fixed.bulk.doneFixed" : "fixed.bulk.doneVariable",
              { count: updatedCount },
            ),
          });
          if (alive.current) onClose();
        },
        () => {
          // 실패는 mut.isError 로 그 자리에 그린다
        },
      );
  };
  return {
    kind,
    setKind,
    target,
    setTarget,
    picked,
    setPicked,
    q,
    mut,
    groups,
    toFixed,
    apply,
  };
}
