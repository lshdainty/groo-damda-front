import { useTranslation } from "react-i18next";
import { useConfirmFail } from "@/shared/lib/confirm-fail";
import { AlertConfirm } from "@/shared/ui/groo/alert-confirm";

/** 할 일 삭제 확인 — 상세에서 지울 때와 밀어서 지울 때가 같은 글이다(제목 "할 일 삭제"). */
export function TodoDeleteConfirm({
  name,
  onConfirm,
  onClose,
}: {
  name: string;
  /** 지운다 — 끝날 때까지 확인창이 로딩을 문다. 실패하면 던진다 */
  onConfirm: () => Promise<unknown> | void;
  onClose: () => void;
}) {
  const { t } = useTranslation("todo");
  const confirmFail = useConfirmFail();
  return (
    <AlertConfirm
      title={t("deleteConfirm.title")}
      message={t("deleteConfirm.message", { name })}
      onConfirm={onConfirm}
      // 실패하면 확인창을 닫고 critical 스낵바 + [다시 시도](묻지 않고 같은 삭제)
      onError={(error) =>
        confirmFail({
          error,
          message: t("deleteFailed"),
          retry: async () => {
            await onConfirm();
          },
        })
      }
      onClose={onClose}
    />
  );
}
