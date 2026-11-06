import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  useCreateDutchPay,
  useDeleteDutchPay,
  useDutchPays,
  useMarkParticipantPaid,
  useSettleAll,
} from "@/features/dutch-pay";
import type { DutchPay, DutchPayFormValues } from "@/entities/dutch-pay";
import {
  friendsOf,
  isActiveSession,
  monthStatsOf,
  receivableOf,
  sortByDateDesc,
  todayISO,
} from "../model/dutch-model";
import { DutchCreateDialog } from "./DutchCreateDialog";
import { DutchDesktop } from "./DutchDesktop";
import { DutchDetailDialog } from "./DutchDetailDialog";
import { DutchMobile } from "./DutchMobile";
import type { TabKey } from "./DutchLists";
import type { DutchView } from "./dutch-view";

type OutletCtx = { onAddTx: () => void; mobile: boolean };

/**
 * 더치페이 — 폭으로 폰(768 미만) · 넓은 화면 갈래를 고르고, 셈 · 요청 · 만들기 · 상세를 쥔다(I-15 25 ~ 40).
 * 요청은 모두 `silent` — 실패 안내는 서버 글이 아니라 화면의 고정 글이다(폼 Callout · 확인창 뒤 스낵바 + 다시 시도 · 목록 실패 Result Section).
 */
export const DutchPayPage = () => {
  const { mobile } = useOutletContext<OutletCtx>();
  const q = useDutchPays({ silent: true });
  const create = useCreateDutchPay({ silent: true });
  const markPaid = useMarkParticipantPaid({ silent: true });
  const settleAll = useSettleAll({ silent: true });
  const del = useDeleteDutchPay({ silent: true });

  const list: DutchPay[] = q.data ?? [];
  const today = todayISO();
  const active = sortByDateDesc(list.filter(isActiveSession));
  const past = sortByDateDesc(list.filter((d) => d.isSettled));

  const [tab, setTab] = useState<TabKey>("active");
  const [creating, setCreating] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [saveErrorSeq, setSaveErrorSeq] = useState(0);
  // 상세는 목록의 최신 값으로 그린다 — 지워졌으면 닫는다
  const detail =
    detailId != null ? (list.find((d) => d.rowId === detailId) ?? null) : null;

  const view: DutchView = {
    list,
    active,
    past,
    tab,
    setTab,
    receivable: receivableOf(active),
    month: monthStatsOf(list, today),
    loading: q.isLoading,
    failed: q.isError && !q.data,
    retry: () => void q.refetch(),
    open: (d) => setDetailId(d.rowId),
    create: () => {
      setSaveError(false);
      setCreating(true);
    },
  };

  const onCreate = async (values: DutchPayFormValues) => {
    setSaveError(false);
    try {
      await create.mutateAsync(values);
      setCreating(false);
    } catch {
      setSaveError(true);
      setSaveErrorSeq((n) => n + 1);
    }
  };

  return (
    <>
      {mobile ? <DutchMobile v={view} /> : <DutchDesktop v={view} />}
      {creating && (
        <DutchCreateDialog
          today={today}
          friendNames={friendsOf(list).map((f) => f.name)}
          saveError={saveError}
          saveErrorDetail={create.error}
          saveErrorSeq={saveErrorSeq}
          onClose={() => setCreating(false)}
          onCreate={onCreate}
        />
      )}
      {detail && (
        <DutchDetailDialog
          d={detail}
          onClose={() => setDetailId(null)}
          markPaid={(participantId) =>
            markPaid.mutateAsync({ dutchPayId: detail.rowId, participantId })
          }
          settleAll={() => settleAll.mutateAsync(detail.rowId)}
          remove={() => del.mutateAsync(detail.rowId)}
        />
      )}
    </>
  );
};
