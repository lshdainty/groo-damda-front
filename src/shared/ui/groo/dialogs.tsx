import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useBackClose } from "@/shared/ds/overlay";
import { isEnterSave } from "@/shared/lib/groo/enter-save";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/shared/ui/drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/shared/ds/alert-dialog";

export type ModalSize = "sm" | "md" | "lg";

/**
 * Groo 디자인 시스템 모달 래퍼.
 * - 모바일: vaul Drawer (스와이프 닫힘)
 * - 데스크탑: shadcn Dialog (Radix 기반, .modal 디자인)
 *
 * Unmount 패턴: 부모가 조건부 마운트하면 열림. onClose 호출 시 부모가 unmount.
 */
export function ModalShell({
  title,
  onClose,
  size = "md",
  footer,
  children,
  mobile,
  mobileMinHeight,
  onEnterSave,
}: {
  title: ReactNode;
  onClose: () => void;
  size?: ModalSize;
  footer?: ReactNode;
  children?: ReactNode;
  mobile: boolean;
  /** 모바일 drawer 최소 높이 (예: '85dvh') — 앱 showPSheet initialChildSize 0.85 정합.
   *  미지정 시 기존처럼 content 높이. */
  mobileMinHeight?: string;
  /**
   * 본문 입력칸에서 Enter 를 누르면 부를 저장 함수(QA #132).
   *
   * 넘기는 쪽은 **연타 가드를 자기 안에 들고 있어야 한다** — Enter 는 눌린 채로
   * 반복 발화하므로, 저장이 나가 있는 동안 또 불려도 아무 일이 없어야 한다.
   * 저장 버튼 하나로 끝나지 않는 화면(고를 것이 남은 상태)은 넘기지 않는다.
   */
  onEnterSave?: () => void;
}) {
  const { t } = useTranslation("common");
  // 모바일 뒤로가기 = 닫기(QA #129). ds 의 뒤로 가기 훅을 쓴다 — ds 시트가 닫히며 되감는 history.go(-1) 의 popstate 를 옛 훅은 "뒤로 가기" 로 읽어,
  // 폼 시트에서 [삭제] 로 확인창을 열면 확인창이 뜨자마자 닫혔다(폰 — `confirm-back-close.test.tsx`). 여기 한 곳에 거는 이유는 desk 의 대화상자·시트가
  // 전부 이 껍데기를 지나기 때문이다 — 화면마다 붙이면 새로 만드는 시트가 조용히 빠진다.
  useBackClose(mobile, () => onClose());
  // 본문 어디서든 Enter 로 저장 — `<form>` 의 암묵적 제출을 대신한다. 무엇을 거르는지는
  // `isEnterSave` 에 적혀 있다(한글 조합 중 Enter · 여러 줄 칸 · 포털 안의 칸).
  const onBodyKeyDown = onEnterSave
    ? (e: ReactKeyboardEvent<HTMLDivElement>) => {
        if (!isEnterSave(e)) return;
        e.preventDefault();
        onEnterSave();
      }
    : undefined;
  if (mobile) {
    return (
      <Drawer
        open={true}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DrawerContent
          className="max-h-[88%]"
          style={mobileMinHeight ? { minHeight: mobileMinHeight } : undefined}
        >
          <DrawerHeader>
            <DrawerTitle className="flex-1">{title}</DrawerTitle>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("close")}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-0 bg-transparent text-[var(--fg-secondary)] cursor-pointer hover:bg-[var(--bg-muted)] hover:text-[var(--fg-primary)] transition-colors"
            >
              <X size={18} />
            </button>
          </DrawerHeader>
          <DrawerBody onKeyDown={onBodyKeyDown}>{children}</DrawerBody>
          {footer && (
            // 모바일 footer 는 버튼을 가로 균등 분배한다(spec drawer.md:35 — 한 손 조작 폭).
            // 우측 정렬 compact 로 두면 화면 구석의 작은 알약이 되어 누르기 어렵다.
            // 삭제처럼 marginRight:auto 로 좌측에 붙는 보조 액션은 균등분배에서 빠진다.
            <div className="flex items-center gap-2 px-x6 py-3 [&>button]:flex-1">
              {footer}
            </div>
          )}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent size={size}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogClose
            aria-label={t("close")}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-0 bg-transparent text-[var(--fg-secondary)] cursor-pointer hover:bg-[var(--bg-muted)] hover:text-[var(--fg-primary)] transition-colors"
          >
            <X size={18} />
          </DialogClose>
        </DialogHeader>
        <DialogBody onKeyDown={onBodyKeyDown}>{children}</DialogBody>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}

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
              loading 을 안 넘긴 호출처도 확정은 비동기 작업이다 — false 라도 넘겨 Button 의 더블클릭 방어를 켠다. */}
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
