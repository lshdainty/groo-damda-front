import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { useLeaveConfirm } from "@/shared/ds/alert-dialog";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetFooter,
} from "@/shared/ds/bottom-sheet";
import { Button } from "@/shared/ds/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
} from "@/shared/ds/dialog";
import { useBackClose, useWideSurface } from "@/shared/ds/overlay";

/** 바닥 버튼 — 거래 상세 · 이체 상세 · 상세 안 단계가 같은 모양을 쓴다 */
export interface DetailFooter {
  /** 왼쪽 [삭제] — ghost + critical, 내용 폭 */
  onDelete?: () => void;
  deleting?: boolean;
  /** 주 버튼 — 상세는 [수정], 환불 단계는 [환불 처리] */
  primary?: { label: string; onClick: () => void; loading?: boolean };
  /** 1280 이상 단계의 [취소] — ← 와 같다(한 단계 뒤). 시트에는 그리지 않는다(위 ← · 닫기가 맡는다) */
  cancelLabel?: string;
}

function assignRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) (ref as React.MutableRefObject<T | null>).current = value;
}

/** 바닥 노드 — 함수면 ← 와 같은 `requestBack`(바뀐 값이 있으면 먼저 묻는다)을 넘겨 그린다 */
function resolveFooterNode(
  node: ReactNode | ((requestBack: () => void) => ReactNode),
  requestBack: () => void,
): ReactNode {
  return typeof node === "function" ? node(requestBack) : node;
}

interface DetailSurfaceProps {
  title: ReactNode;
  /** 시트 · 대화상자를 모두 닫는다 */
  onClose: () => void;
  /**
   * 상세 안 한 단계(환불 …)에 있나 — 입력 폼 규칙으로 바뀐다(바깥 · 끌기로 안 닫힘). ← · Esc · 기기 뒤로 가기 = 상세 단계로.
   * 상세 단계(false)는 조회라 바깥 누름 · 끌어내림 · Esc 로 닫힌다.
   */
  subStep?: boolean;
  /** 단계에서 바뀐 값이 있다 — 상세로 돌아가기 · 닫기 전에 "작성한 내용이 사라져요" 를 묻는다 */
  dirty?: boolean;
  /**
   * 닫기 원 · 바깥 · 끌어내리기로 시트 전체를 닫을 때 물을 값 — 기본은 `dirty`. 끼운 수정 폼은 ← 는 단계 값(`dirty`)만, 닫기는 폼 전체 변경까지 묻는다(N7)
   */
  closeDirty?: boolean;
  /** 저장 중이라 닫지 못한다 — 닫으면 응답 뒤 콜백(상세 갱신 · 알림)이 사라진다(L1) */
  closeBlocked?: boolean;
  /** 한 단계 뒤(상세로) */
  onStepBack?: () => void;
  footer?: DetailFooter;
  /**
   * 바닥을 노드로 직접 준다 — 수정 폼처럼 자기 바닥을 가진 단계(I-21 7a). 시트는 폭을 나눈 large, 대화상자는 small 로 그려진 버튼들을 그대로 받는다.
   * 주면 `footer` 는 쓰지 않는다
   */
  footerNode?: ReactNode | ((requestBack: () => void) => ReactNode);
  /** 바닥 버튼 바로 위 한 줄(나누기 단계의 남은 금액) — 본문 스크롤 밖에 둔다 */
  footerAbove?: ReactNode;
  /** 본문 스크롤 상자 ref — 저장 실패 알림을 맨 위로 올릴 때 쓴다(끼운 수정 폼) */
  bodyRef?: React.Ref<HTMLDivElement>;
  /** 값 하나를 치는 단계의 머리 오른쪽 "완료"(시트) — 있으면 닫기 원 자리를 대신한다(I-09 29) */
  stepDone?: ReactNode;
  /** 본문 요소를 단계마다 새로 그리게 하는 키 */
  bodyKey: string;
  children: ReactNode;
}

/**
 * 거래 상세 · 이체 상세가 든 표면 (I-21 A 4 ~ 6 · B 7 · 13) — 1280 미만 ds Bottom Sheet(최대 480), 이상 Dialog 480.
 * 같은 표면 안에서 머리 · 본문 · 바닥이 상세 ↔ 단계로 바뀐다. 시트를 닫았다 다시 열지 않는다.
 *
 * 닫는 길이 단계마다 다르다: 상세 = 조회(바깥 · 끌어내리기 · Esc · 닫기), 단계 = 입력 폼(← · Esc · 기기 뒤로 가기 = 상세로,
 * 바뀐 값이 있으면 먼저 묻는다 / 닫기 원 = 모두 닫기).
 */
export function DetailSurface({
  title,
  onClose,
  subStep = false,
  dirty = false,
  closeDirty,
  closeBlocked = false,
  onStepBack,
  footer,
  footerNode,
  footerAbove,
  bodyRef,
  stepDone,
  bodyKey,
  children,
}: DetailSurfaceProps) {
  const wide = useWideSurface();
  const { t: tc } = useTranslation("common");
  const contentRef = useRef<HTMLDivElement | null>(null);
  // 단계가 바뀌어 본문이 새로 만들어져도 상세로 돌아오면 읽던 자리로 — 단계 본문(환불 · 수정)은 늘 맨 위에서 시작한다(M5)
  const detailScroll = useRef(0);
  const bodyEl = useRef<HTMLDivElement | null>(null);
  const setBody = (el: HTMLDivElement | null) => {
    bodyEl.current = el;
    assignRef(bodyRef, el);
  };
  const onBodyScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (bodyKey === "detail") detailScroll.current = e.currentTarget.scrollTop;
  };
  useLayoutEffect(() => {
    if (bodyKey === "detail" && bodyEl.current)
      bodyEl.current.scrollTop = detailScroll.current;
  }, [bodyKey]);
  const stepLeave = useLeaveConfirm({
    dirty,
    leave: () => onStepBack?.(),
    contentRef,
  });

  // 기기 뒤로 가기(1280 미만) — 단계에서는 시트가 아니라 이 단계만 닫는다. 물어서 안 닫았으면 칸을 다시 쌓는다
  useBackClose(!wide && subStep, (keep) => {
    if (!stepLeave.request()) keep();
  });

  const stepProps = {
    ref: contentRef,
    "aria-describedby": undefined,
    onBack: subStep ? () => void stepLeave.request() : undefined,
    // Esc 는 한 단계 뒤 — 시트 전체를 닫는 건 닫기 원 · 바깥(상세만) · 끌어내리기(상세만)
    onEscapeKeyDown: (e: KeyboardEvent) => {
      if (!subStep) return;
      e.preventDefault();
      void stepLeave.request();
    },
  } as const;

  // 값 하나를 치는 시트 단계처럼 바닥에 둘 것이 없으면 빈 바닥 틀을 그리지 않는다(L9)
  const customFooter =
    footerNode != null
      ? resolveFooterNode(footerNode, () => void stepLeave.request())
      : null;
  const del = footer?.onDelete ? (
    <Button
      variant="ghost"
      ghostColor="critical"
      size={wide ? undefined : "large"}
      className={wide ? "mr-auto" : "shrink-0"}
      loading={footer.deleting}
      onClick={footer.onDelete}
    >
      {tc("delete")}
    </Button>
  ) : null;

  if (wide) {
    return (
      <>
        <Dialog
          open
          form={subStep}
          dirty={subStep && (closeDirty ?? dirty)}
          onOpenChange={(next) => {
            if (!next && !closeBlocked) onClose();
          }}
        >
          <DialogContent title={title} {...stepProps}>
            <DialogBody
              ref={setBody}
              onScroll={onBodyScroll}
              key={bodyKey}
              scrollFog
            >
              <div className="-mx-x6">{children}</div>
            </DialogBody>
            {footerAbove}
            {customFooter ? (
              <DialogFooter>{customFooter}</DialogFooter>
            ) : footer && (del || footer.primary) ? (
              <DialogFooter>
                {del}
                {footer.cancelLabel && (
                  <Button
                    variant="neutralWeak"
                    onClick={() => void stepLeave.request()}
                  >
                    {footer.cancelLabel}
                  </Button>
                )}
                {footer.primary && (
                  <Button
                    variant="neutralSolid"
                    loading={footer.primary.loading}
                    onClick={footer.primary.onClick}
                  >
                    {footer.primary.label}
                  </Button>
                )}
              </DialogFooter>
            ) : null}
          </DialogContent>
        </Dialog>
        {stepLeave.node}
      </>
    );
  }

  return (
    <>
      <BottomSheet
        open
        form={subStep}
        dirty={subStep && (closeDirty ?? dirty)}
        onOpenChange={(next) => {
          if (!next && !closeBlocked) onClose();
        }}
      >
        <BottomSheetContent
          title={title}
          {...stepProps}
          className={
            stepDone ? "[&_[data-slot=bottom-sheet-close]]:hidden" : undefined
          }
        >
          {stepDone}
          <BottomSheetBody
            ref={setBody}
            onScroll={onBodyScroll}
            key={bodyKey}
            scrollFog
          >
            <div className="-mx-x6">{children}</div>
          </BottomSheetBody>
          {footerAbove}
          {customFooter ? (
            <BottomSheetFooter>{customFooter}</BottomSheetFooter>
          ) : footer && (del || footer.primary) ? (
            <BottomSheetFooter>
              <div className="flex w-full items-center gap-x2">
                {del}
                {footer.primary && (
                  <Button
                    variant="neutralSolid"
                    size="large"
                    className="flex-1"
                    loading={footer.primary.loading}
                    onClick={footer.primary.onClick}
                  >
                    {footer.primary.label}
                  </Button>
                )}
              </div>
            </BottomSheetFooter>
          ) : null}
        </BottomSheetContent>
      </BottomSheet>
      {stepLeave.node}
    </>
  );
}
