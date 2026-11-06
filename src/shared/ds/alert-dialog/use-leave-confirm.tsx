import * as React from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "./alert-dialog";
import { useDsText } from "@/shared/ds/i18n";

/*
 * 작성 중 나가기 — 바뀐 값이 있으면 닫기 전에 "작성한 내용이 사라져요" 를 묻는다(Field 의 이탈 시 안내). Dialog · Bottom Sheet 가 쓴다.
 * groo-design recipes/shadcn/components/ui/alert-dialog.tsx 의 useLeaveConfirm 을 옮겼다.
 * 이 파일은 훅만 내보낸다(컴포넌트 파일이 아니다) — 확인창은 alert-dialog.tsx 를 부른다.
 */

export interface LeaveConfirmOptions {
  /** 바뀐 값이 있다 — 있으면 묻고, 없으면 바로 닫는다 */
  dirty: boolean;
  /** 닫는다(표면의 onOpenChange(false)) */
  leave: () => void;
  /** 묻기 전 초점 자리가 사라졌을 때 돌아갈 표면 */
  contentRef: React.RefObject<HTMLElement | null>;
  /** 확인창을 띄울 자리 — 기본 document.body. 표면과 같은 곳(카탈로그의 다크 판)에 둔다 */
  container?: HTMLElement | null;
  /** false 면 모달 부작용을 끈다 — 카탈로그 · 문서 전용(AlertDialog 의 modal) */
  modal?: boolean;
  /**
   * 저장하는 중이다 — 닫기를 받지 않는다(묻지도 않는다). 저장 중에 닫히면 실패를 알릴 폼 맨 위 Callout 자리가 사라진다
   * (skeleton.md:136). request() 가 false 를 돌려주므로 뒤로 가기는 칸을 다시 쌓고 끌던 시트는 제자리로 돌아간다
   */
  busy?: boolean;
}

/**
 * request() 는 닫기를 청한다 — 바로 닫았으면 true, 물었거나 저장 중이라 받지 않았으면 false. node 를 표면 곁에 그린다
 * (확인창은 L5 라 시트 · 대화상자 위에 뜬다).
 */
export function useLeaveConfirm({
  dirty,
  leave,
  contentRef,
  container,
  modal,
  busy = false,
}: LeaveConfirmOptions) {
  const dsT = useDsText();
  const [asking, setAsking] = React.useState(false);
  const dirtyRef = React.useRef(dirty);
  const leaveRef = React.useRef(leave);
  const busyRef = React.useRef(busy);
  React.useEffect(() => {
    dirtyRef.current = dirty;
    leaveRef.current = leave;
    busyRef.current = busy;
  });
  const returnRef = React.useRef<HTMLElement | null>(null);
  const leavingRef = React.useRef(false);
  const request = () => {
    // 저장 중 — 닫지도 묻지도 않는다(X 는 모양 그대로, 누르면 아무 일 없음 — 저장 단추의 로딩이 "기다려라" 를 말한다)
    if (busyRef.current) return false;
    if (!dirtyRef.current) {
      leaveRef.current();
      return true;
    }
    const active = document.activeElement;
    returnRef.current =
      active instanceof HTMLElement && active !== document.body ? active : null;
    setAsking(true);
    return false;
  };
  const node = (
    <AlertDialog
      open={asking}
      onOpenChange={setAsking}
      container={container}
      modal={modal}
    >
      <AlertDialogContent
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          // [나가기] — 표면도 닫히므로 초점은 표면이 연 자리로 돌려놓는다
          if (leavingRef.current) {
            leavingRef.current = false;
            return;
          }
          // [계속 작성] · Esc · 뒤로 가기 — 묻기 전 초점 자리(없으면 표면)로
          const back = returnRef.current?.isConnected
            ? returnRef.current
            : contentRef.current;
          back?.focus({ preventScroll: true });
        }}
      >
        <AlertDialogTitle>{dsT("leaveConfirm.title")}</AlertDialogTitle>
        <AlertDialogDescription>
          {dsT("leaveConfirm.description")}
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>{dsT("leaveConfirm.stay")}</AlertDialogCancel>
          <AlertDialogAction
            variant="criticalSolid"
            onClick={() => {
              leavingRef.current = true;
              leaveRef.current();
            }}
          >
            {dsT("leaveConfirm.leave")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
  return { request, asking, node };
}
