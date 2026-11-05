import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/shared/ds/alert-dialog";

/**
 * 삭제 확인 — ds Alert Dialog 한 벌(제목 · 글 · [취소] · [삭제] criticalSolid). 밀기로 지울 때와 상세에서 지울 때가 같은 글이다.
 * 요청 중에는 열린 채 로딩, 실패하면 열린 채 둔다(전역 오류 알림이 말한다). 끝나면 `onClose` 로 닫는다.
 * 지우기 · 잃기가 아닌 확정(예: 지난달 예산 복사)은 `tone="neutralSolid"` 와 동작 이름 `confirmLabel` 을 준다(spec alert-dialog.md "확정 버튼").
 */
export function AlertConfirm({
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = "criticalSolid",
  onConfirm,
  onError,
  onClose,
}: {
  title: ReactNode;
  message: ReactNode;
  confirmLabel?: string;
  /** 취소 단추 글 — 기본 "취소". 해지처럼 "유지하기" 가 더 정확한 자리에 준다 */
  cancelLabel?: string;
  /** 확정의 무게 — 지우기 · 잃기는 criticalSolid(기본), 그 밖은 neutralSolid */
  tone?: "criticalSolid" | "neutralSolid";
  /** 지운다 — 끝날 때까지 로딩. 실패하면 던진다 */
  onConfirm: () => Promise<unknown> | void;
  /**
   * 확정이 실패했을 때 — **필수**. 확인창을 닫은 뒤 부른다(호출처가 Snackbar critical + "다시 시도" 를 띄운다. 창 위에는
   * 겹치지 않는다 — snackbar.md 오류 · alert-dialog.md). 전역 서버 원문 알림이 없으므로 이걸 빠뜨린 새 호출처는 실패가
   * 아무 말 없이 지나간다 — 던지지 않는 확인(요청이 아닌 것)도 다 이 자리를 채운다
   */
  onError: () => void;
  onClose: () => void;
}) {
  const { t: tc } = useTranslation("common");
  const [running, setRunning] = useState(false);
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !running) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{message}</AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel ?? tc("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            variant={tone}
            loading={running}
            onClick={async (e) => {
              e.preventDefault();
              setRunning(true);
              try {
                await onConfirm();
                onClose();
              } catch {
                onClose();
                onError();
              } finally {
                setRunning(false);
              }
            }}
          >
            {confirmLabel ?? tc("delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
