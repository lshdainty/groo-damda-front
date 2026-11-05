// 모달을 저장으로 닫으면 그 즉시 뒤 화면이 포인터를 다시 받았다 — 따닥 누른 두 번째
// 클릭이 달력 셀을 눌러 일자 상세가 열리고(QA #14 #36), 삭제 확인창 뒤에선 그 자리로
// 올라온 다른 행의 상세가 열렸다(#57). 여기선 "DialogContent 가 사라지면 차단이
// 걸린다" 는 배선을 잠근다 — 차단 규칙 자체는 pointer-block.test.ts 가 본다.
import { StrictMode, act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  POINTER_BLOCK_MS,
  __resetPointerBlockForTest,
  isPointerBlocked,
} from "@/shared/lib/groo/pointer-block";
import { AlertDialog, AlertDialogContent } from "@/shared/ui/alert-dialog";
import { Dialog, DialogContent } from "@/shared/ui/dialog";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;
/** 뒤 화면 — 달력 셀·목록 행 자리. */
let back: HTMLButtonElement;
let hit: (e: Event) => void;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-03T00:00:00Z"));
  __resetPointerBlockForTest();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  hit = vi.fn<(e: Event) => void>();
  back = document.createElement("button");
  back.addEventListener("click", hit);
  document.body.appendChild(back);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  back.remove();
  __resetPointerBlockForTest();
  vi.useRealTimers();
});

const render = (node: ReactNode) => act(() => root.render(node));
const clickBack = () =>
  act(() => {
    back.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  });

/** 저장하면 부모가 언마운트해서 닫는 실제 패턴(groo/dialogs.tsx ModalShell). */
function SaveThenClose({ children }: { children?: ReactNode }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <Dialog open={true}>
      <DialogContent>
        <button type="button" data-testid="save" onClick={() => setOpen(false)}>
          저장
        </button>
        {children}
      </DialogContent>
    </Dialog>
  );
}

describe("DialogContent 가 닫힌 직후", () => {
  it("뒤 화면이 두 번째 클릭을 받지 않는다", () => {
    render(<SaveThenClose />);
    const save = document.querySelector<HTMLButtonElement>(
      '[data-testid="save"]',
    )!;
    act(() => save.click());
    expect(document.querySelector('[data-testid="save"]')).toBeNull(); // 닫혔다

    clickBack();
    expect(hit).not.toHaveBeenCalled();
  });

  it("차단은 잠깐이다 — 창이 지나면 뒤 화면이 다시 눌린다", () => {
    render(<SaveThenClose />);
    act(() =>
      document
        .querySelector<HTMLButtonElement>('[data-testid="save"]')!
        .click(),
    );
    act(() => {
      vi.advanceTimersByTime(POINTER_BLOCK_MS + 50);
    });
    clickBack();
    expect(hit).toHaveBeenCalledTimes(1);
  });

  it("떠 있는 동안엔 차단하지 않는다", () => {
    render(<SaveThenClose />);
    expect(isPointerBlocked()).toBe(false);
  });

  it("StrictMode 이중 마운트로는 차단이 걸리지 않는다", () => {
    render(
      <StrictMode>
        <SaveThenClose />
      </StrictMode>,
    );
    expect(isPointerBlocked()).toBe(false);
    clickBack();
    expect(hit).toHaveBeenCalledTimes(1);
  });

  it("닫으면서 다른 모달을 여는 흐름(상세→편집)은 안 막힌다", () => {
    function Swap() {
      const [step, setStep] = useState<"view" | "edit">("view");
      return (
        <Dialog open={true}>
          <DialogContent key={step}>
            <button
              type="button"
              data-testid="swap"
              onClick={() => setStep("edit")}
            >
              {step}
            </button>
          </DialogContent>
        </Dialog>
      );
    }
    render(<Swap />);
    act(() =>
      document
        .querySelector<HTMLButtonElement>('[data-testid="swap"]')!
        .click(),
    );
    expect(isPointerBlocked()).toBe(false);
  });

  // 여기부터 두 개는 "등록을 어디에 다느냐" 를 잠근다. 처음 구현은 `DialogContent`
  // 래퍼에 달았는데, 그 래퍼는 `open={false}` 여도 계속 마운트돼 있다 — 확인창·시트를
  // controlled 로 쓰는 CalendarContainer·(예전 구독 대화상자 · 금액 보기 인증 대화상자)가 전부 그 패턴이다. 그러면 '떠 있는 오버레이 수' 가 0 으로
  // 안 떨어져 차단이 한 번도 안 걸린다. 정작 #36 이 난 캘린더 화면이 그 상태였다.
  // 등록은 Portal 안(overlay)에 있어야 `open` 과 생애가 같아진다.
  it("controlled 로 닫아도 차단이 걸린다 — 래퍼는 닫힌 뒤에도 살아 있다", () => {
    function Controlled() {
      const [open, setOpen] = useState(true);
      return (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <button
              type="button"
              data-testid="save"
              onClick={() => setOpen(false)}
            >
              저장
            </button>
          </DialogContent>
        </Dialog>
      );
    }
    render(<Controlled />);
    act(() =>
      document
        .querySelector<HTMLButtonElement>('[data-testid="save"]')!
        .click(),
    );
    expect(document.querySelector('[data-testid="save"]')).toBeNull();

    clickBack();
    expect(hit).not.toHaveBeenCalled();
  });

  it("같은 화면에 닫혀 있는 다른 모달·확인창이 있어도 차단이 걸린다", () => {
    render(
      <>
        {/* 캘린더·자산 목록의 삭제 확인창처럼 항상 렌더되지만 닫혀 있는 것들 */}
        <Dialog open={false}>
          <DialogContent>
            <span />
          </DialogContent>
        </Dialog>
        <AlertDialog open={false}>
          <AlertDialogContent>
            <span />
          </AlertDialogContent>
        </AlertDialog>
        <SaveThenClose />
      </>,
    );
    act(() =>
      document
        .querySelector<HTMLButtonElement>('[data-testid="save"]')!
        .click(),
    );
    clickBack();
    expect(hit).not.toHaveBeenCalled();
  });

  it("AlertDialogContent 도 같은 장치를 지난다 — 확인창 뒤 목록이 열리면 안 된다(#57)", () => {
    function Confirm() {
      const [open, setOpen] = useState(true);
      if (!open) return null;
      return (
        <AlertDialog open={true}>
          <AlertDialogContent>
            <button
              type="button"
              data-testid="del"
              onClick={() => setOpen(false)}
            >
              삭제
            </button>
          </AlertDialogContent>
        </AlertDialog>
      );
    }
    render(<Confirm />);
    act(() =>
      document.querySelector<HTMLButtonElement>('[data-testid="del"]')!.click(),
    );
    clickBack();
    expect(hit).not.toHaveBeenCalled();
  });
});
