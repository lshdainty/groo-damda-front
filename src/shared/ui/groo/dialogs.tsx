import { type ReactNode } from "react";
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

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger,
  loading,
  singleAction,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 지우기 · 잃기 — 확정이 criticalSolid. 아니면 neutralSolid */
  danger?: boolean;
  loading?: boolean;
  /**
   * 확인 하나만 그린다 — 고를 것이 없는 차단 통지
   * (spec alert-dialog.md Variants · single). 취소를 나란히 두면 두 버튼이
   * 같은 일(닫기)을 한다. 제목은 결과 명사구(`삭제 불가`)로 쓴다.
   *
   * [onCancel] 은 그대로 필수다 — 확인 · Esc · 뒤로 가기(1280 미만)로 닫는 경로가 그걸 쓴다
   * (바깥 누르기로는 닫히지 않는다 — 파괴적 확정은 버튼으로만 닫는다).
   */
  singleAction?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation("common");
  // ds Alert Dialog(spec alert-dialog.md) 한 벌이다 — 크기 · 배치 · 초점 · Esc · 뒤로 가기(1280 미만, 시트 위에 겹쳐도 맨 위 하나만)는
  // ds 가 맡는다. 여기는 호출처가 창의 열림을 쥐는 계약(열려 있는 동안 마운트, 닫으면 호출처가 내린다)만 잇는다.
  return (
    <AlertDialog
      open={true}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        {/* 줄바꿈을 살린다 — 환불 경고처럼 문단이 둘인 문구가 있다. */}
        <AlertDialogDescription className="whitespace-pre-line">
          {message}
        </AlertDialogDescription>
        <AlertDialogFooter>
          {!singleAction && (
            <AlertDialogCancel>{cancelLabel ?? t("cancel")}</AlertDialogCancel>
          )}
          {/* 누르면 ds 가 닫는데, 확정이 끝날 때까지 스피너를 띄우고 호출처가 닫는 흐름(loading)이 있어 닫지 않는다(preventDefault).
              loading 을 안 넘긴 호출처도 확정은 비동기 작업이다 — false 라도 넘겨 Button 의 "누른 동작이 끝날 때까지 한 번" 잠금을 켠다. */}
          <AlertDialogAction
            variant={danger && !singleAction ? "criticalSolid" : "neutralSolid"}
            loading={loading ?? false}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {confirmLabel ?? t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
