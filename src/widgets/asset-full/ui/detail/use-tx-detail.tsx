import { useState, type ReactNode } from "react";
import type { Expense } from "@/entities/expense";
import type { AssetTransfer } from "@/entities/asset";
import { TxDetailDialog } from "@/widgets/expense-detail/ui/TxDetailDialog";
import { TransferDetailDialog } from "@/widgets/expense-detail/ui/TransferDetailDialog";

/**
 * 거래 줄 · 이체 줄을 누르면 거래 상세를 연다(I-17 51 — 여는 자리만, 표면 · 글은 I-21 몫).
 * 수정은 상세 표면 안의 단계로 이뤄진다(I-21) — 여기서 수정 시트를 따로 열지 않는다. 한 번에 표면 하나만 뜬다.
 */
export function useTxDetail(mobile: boolean): {
  openExpense: (e: Expense) => void;
  openTransfer: (t: AssetTransfer) => void;
  node: ReactNode;
} {
  const [detail, setDetail] = useState<Expense | null>(null);
  const [transferDetail, setTransferDetail] = useState<AssetTransfer | null>(
    null,
  );
  const node = (
    <>
      {detail && (
        <TxDetailDialog
          expense={detail}
          mobile={mobile}
          onClose={() => setDetail(null)}
        />
      )}
      {transferDetail && (
        <TransferDetailDialog
          transfer={transferDetail}
          mobile={mobile}
          onClose={() => setTransferDetail(null)}
        />
      )}
    </>
  );
  return { openExpense: setDetail, openTransfer: setTransferDetail, node };
}
