import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/shared/ui/groo/dialogs";
import type { Memo } from "@/entities/memo";

/**
 * 메모 삭제 확인(I-15 14) — 공용 ConfirmDialog(ds Alert Dialog). 상세에서 지울 때와 밀어서 지울 때가 같은 글이다.
 * 확정이 [삭제]라 criticalSolid · 글은 "삭제할까요? · 삭제한 …" 로 되돌릴 수 없다는 사실까지 적는다.
 * 지우는 동안 로딩을 물고, 실패하면 확인창을 닫는다 — 안내는 `remove` 가 스낵바 + [다시 시도] 로 한다.
 */
export function MemoDeleteConfirm({
  memo,
  remove,
  onClose,
  onDeleted,
}: {
  memo: Memo;
  /** 지운다 — 지웠으면 true. 실패 안내(스낵바)는 부르는 쪽이 이미 맡는다 */
  remove: (memo: Memo) => Promise<boolean>;
  onClose: () => void;
  /** 지운 뒤 — 상세를 닫는 자리 */
  onDeleted?: () => void;
}) {
  const { t } = useTranslation("memo");
  const { t: tc } = useTranslation("common");
  const [running, setRunning] = useState(false);
  const run = async () => {
    setRunning(true);
    const ok = await remove(memo);
    onClose();
    if (ok) onDeleted?.();
  };
  return (
    <ConfirmDialog
      title={t("deleteConfirm.title")}
      message={t("deleteConfirm.message", {
        name: memo.title || t("untitled"),
      })}
      confirmLabel={tc("delete")}
      danger
      loading={running}
      onCancel={() => {
        if (!running) onClose();
      }}
      onConfirm={() => void run()}
    />
  );
}
