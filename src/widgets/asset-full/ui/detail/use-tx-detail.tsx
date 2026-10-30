import { useState, type ReactNode } from "react";
import type { Expense } from "@/entities/expense";
import type { AssetTransfer } from "@/entities/asset";
import { AddTxSheet } from "@/widgets/add-tx";
import { TxDetailDialog } from "@/widgets/expense-detail/ui/TxDetailDialog";
import { TransferDetailDialog } from "@/widgets/expense-detail/ui/TransferDetailDialog";

/**
 * 거래 줄 · 이체 줄을 누르면 거래 상세를 연다(I-17 51 — 여는 자리만, 표면 · 글은 I-21 몫).
 * 상세 → [수정] → 수정 시트 길은 검색 화면(`SearchPage`) · 가계부와 같다. 한 번에 표면 하나만 뜬다.
 */
export function useTxDetail(mobile: boolean): {
  openExpense: (e: Expense) => void;
  openTransfer: (t: AssetTransfer) => void;
  node: ReactNode;
} {
  const [detail, setDetail] = useState<Expense | null>(null);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [transferDetail, setTransferDetail] = useState<AssetTransfer | null>(
    null,
  );
  const [editingTransfer, setEditingTransfer] = useState<AssetTransfer | null>(
    null,
  );
  const node = (
    <>
      {detail && !editing && (
        <TxDetailDialog
          expense={detail}
          mobile={mobile}
          onClose={() => setDetail(null)}
          onEdit={(e) => {
            setDetail(null);
            setEditing(e);
          }}
        />
      )}
      {editing && (
        <AddTxSheet
          expense={editing}
          mobile={mobile}
          onClose={() => setEditing(null)}
        />
      )}
      {transferDetail && !editingTransfer && (
        <TransferDetailDialog
          transfer={transferDetail}
          mobile={mobile}
          onClose={() => setTransferDetail(null)}
          onEdit={(tr) => {
            setTransferDetail(null);
            setEditingTransfer(tr);
          }}
        />
      )}
      {editingTransfer && (
        <AddTxSheet
          editTransfer={editingTransfer}
          mobile={mobile}
          onClose={() => setEditingTransfer(null)}
        />
      )}
    </>
  );
  return { openExpense: setDetail, openTransfer: setTransferDetail, node };
}
