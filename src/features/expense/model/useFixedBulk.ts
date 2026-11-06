import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnackbar } from "@/shared/ds/snackbar";
import { isWriteUnconfirmed } from "@/shared/api/base";
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
  const [target, setTargetState] = useState<FixedBulkTarget>("fixed");
  const [picked, setPickedState] = useState<ReadonlySet<number>>(new Set());
  const snackbar = useSnackbar();
  const q = useExpenses({ startDate, endDate });
  const mut = useBulkMarkFixed();
  const groups = groupForFixed(q.data ?? [], kind, t("fixed.bulk.untitled"));
  const toFixed = target === "fixed";
  // 적용 중에 화면을 떠났으면(기기 뒤로 가기 — 막을 수 없다) 응답이 와도 닫지 않고, 결과는 스낵바 한 문장으로 알린다
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  // 적용 중에는 고른 것을 바꾸지 않는다(본문은 inert — 이 가드는 입력이 새는 길을 막는다). 실패 뒤 고른 것을 바꾸면
  // 실패 표시를 걷어 바닥 단추가 다시 "N건 적용" 이 된다
  const edit = () => {
    if (mut.isPending) return false;
    if (mut.isError) mut.reset();
    return true;
  };
  const setKind = (next: ExpenseType) => {
    if (!edit()) return;
    setKindState(next);
    setPickedState(new Set());
  };
  const setTarget = (next: FixedBulkTarget) => {
    if (edit()) setTargetState(next);
  };
  const setPicked = (next: ReadonlySet<number>) => {
    if (edit()) setPickedState(next);
  };
  /** 처음과 다르게 골랐다 — 닫기 전에 "작성한 내용이 사라져요" 를 묻는다 */
  const dirty = picked.size > 0 || kind !== "EXPENSE" || target !== "fixed";
  const apply = () => {
    if (picked.size === 0 || mut.isPending) return;
    // 화면이 있으면 실패는 스낵바가 아니라 폼 맨 위 Callout(`mut.isError`) — 폼은 열린 채 · 고른 것 그대로, 다시 시도는 [다시 시도].
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
        (error: unknown) => {
          if (alive.current) return; // 그 자리 Callout 이 보여 준다
          // 떠난 뒤의 실패 — 그 자리에 둘 곳이 없다. 확인 못 한 쓰기는 실패라 말하지 않는다(B2b)
          snackbar.show({
            tone: "critical",
            message: t(
              isWriteUnconfirmed(error)
                ? "fixed.bulk.unconfirmed"
                : "fixed.bulk.failed",
            ),
          });
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
    dirty,
    apply,
  };
}
