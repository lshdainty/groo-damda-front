// Alert Dialog 의 동작 — 모양 · 색은 scripts/check-ds-spec.mjs 가 크로미움에서 스펙 값과 맞춘다.
import { act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./alert-dialog";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;
let wide = false;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  // jsdom 에는 matchMedia 가 없다 — 1280 이상(wide)이냐를 바꿔 가며 본다
  wide = false;
  // 앞 테스트가 합성 popstate 로 닫으면 쌓은 칸이 실제로는 남는다 — 표시를 지운다
  window.history.replaceState(null, "");
  window.matchMedia = ((query: string) => ({
    matches: wide && query.includes("1280px"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  document.body.removeAttribute("style");
  // 닫으며 되돌린 히스토리 칸의 popstate 는 jsdom 이 나중에 보낸다 — 다음 테스트에 넘어가지 않게 기다린다
  await new Promise((r) => setTimeout(r, 30));
});

function render(node: ReactNode) {
  act(() => root.render(node));
}

// Radix 는 바깥 누르기 듣기 · 초점 되돌리기를 다음 틱에 한다
const tick = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

const content = () =>
  document.querySelector<HTMLElement>("[data-slot=alert-dialog-content]");
const overlay = () =>
  document.querySelector<HTMLElement>("[data-slot=alert-dialog-overlay]");
const byText = (text: string) =>
  Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
    (b) => b.textContent === text,
  )!;

function key(el: Element, k: string, init: KeyboardEventInit = {}) {
  act(() => {
    el.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: k,
        bubbles: true,
        cancelable: true,
        ...init,
      }),
    );
  });
}

function pointerDown(el: Element) {
  act(() => {
    el.dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true, cancelable: true }),
    );
  });
}

function Ask({
  onOpenChange,
  onAction,
  loading,
  actionPrevents,
  open,
}: {
  onOpenChange?: (open: boolean) => void;
  onAction?: () => void;
  loading?: boolean;
  actionPrevents?: boolean;
  open?: boolean;
}) {
  return (
    <>
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogTrigger>삭제하기</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>거래를 삭제할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            삭제한 거래는 되돌릴 수 없어요.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              variant="criticalSolid"
              loading={loading}
              onClick={(e) => {
                onAction?.();
                if (actionPrevents) e.preventDefault();
              }}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <p data-testid="behind">뒤 화면</p>
    </>
  );
}

function open() {
  const trigger = byText("삭제하기");
  act(() => {
    trigger.focus();
    trigger.click();
  });
}

describe("역할 · 이름 · 설명", () => {
  it("role=alertdialog + aria-modal, 제목이 이름이고 설명이 설명이다", async () => {
    render(<Ask />);
    open();
    await tick();
    const dialog = content()!;
    expect(dialog.getAttribute("role")).toBe("alertdialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const title = document.getElementById(
      dialog.getAttribute("aria-labelledby")!,
    );
    const description = document.getElementById(
      dialog.getAttribute("aria-describedby")!,
    );
    expect(title?.textContent).toBe("거래를 삭제할까요?");
    expect(description?.textContent).toBe("삭제한 거래는 되돌릴 수 없어요.");
  });

  it("화면보다 커지면 높이는 화면까지, 넘치면 확인창 전체가 스크롤한다(03-F 1A)", async () => {
    render(<Ask />);
    open();
    await tick();
    const cls = content()!.className;
    expect(cls).toContain("max-h-full");
    expect(cls).toContain("overflow-y-auto");
  });

  it("제목이 없으면 aria-label 이 숨은 제목이 되어 이름을 단다", async () => {
    render(
      <AlertDialog defaultOpen>
        <AlertDialogContent aria-label="거래를 삭제할까요?">
          <AlertDialogDescription>되돌릴 수 없어요.</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogAction>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>,
    );
    await tick();
    const dialog = content()!;
    const name = document.getElementById(
      dialog.getAttribute("aria-labelledby")!,
    );
    expect(name?.textContent).toBe("거래를 삭제할까요?");
    expect(name?.className).toContain("sr-only");
  });

  it("닫기 버튼이 없다", async () => {
    render(<Ask />);
    open();
    await tick();
    expect(content()!.querySelector("[aria-label=닫기]")).toBeNull();
    expect(content()!.querySelectorAll("button")).toHaveLength(2);
  });
});

describe("닫는 길", () => {
  it("Esc 는 취소와 같다 — 닫는다", async () => {
    const onOpenChange = vi.fn();
    render(<Ask onOpenChange={onOpenChange} />);
    open();
    await tick();
    key(content()!, "Escape");
    await tick();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(content()).toBeNull();
  });

  it("바깥(딤)을 눌러도 닫히지 않는다", async () => {
    const onOpenChange = vi.fn();
    render(<Ask onOpenChange={onOpenChange} />);
    open();
    await tick();
    onOpenChange.mockClear();
    pointerDown(overlay()!);
    await tick();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(content()).not.toBeNull();
  });

  it("[취소] 를 누르면 닫는다", async () => {
    render(<Ask />);
    open();
    await tick();
    act(() => byText("취소").click());
    await tick();
    expect(content()).toBeNull();
  });

  it("확정을 누르면 onClick 을 부르고 닫는다", async () => {
    const onAction = vi.fn();
    render(<Ask onAction={onAction} />);
    open();
    await tick();
    act(() => byText("삭제").click());
    await tick();
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(content()).toBeNull();
  });

  it("onClick 에서 preventDefault 하면 닫지 않는다(서버 응답을 기다릴 때)", async () => {
    const onAction = vi.fn();
    render(<Ask onAction={onAction} actionPrevents />);
    open();
    await tick();
    act(() => byText("삭제").click());
    await tick();
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(content()).not.toBeNull();
  });

  it("loading 이면 확정 누르기를 삼켜 닫지도 부르지도 않는다", async () => {
    const onAction = vi.fn();
    render(<Ask onAction={onAction} loading />);
    open();
    await tick();
    const action = byText("삭제");
    expect(action.getAttribute("aria-busy")).toBe("true");
    act(() => action.click());
    await tick();
    expect(onAction).not.toHaveBeenCalled();
    expect(content()).not.toBeNull();
  });
});

describe("초점", () => {
  it("열면 초점이 확인창으로 가고(버튼이 아니다), 닫으면 연 자리(트리거)로 돌아온다", async () => {
    render(<Ask />);
    open();
    await tick();
    expect(document.activeElement).toBe(content());
    act(() => byText("취소").click());
    await tick();
    expect(document.activeElement).toBe(byText("삭제하기"));
  });

  it("열린 동안 Tab 이 확인창 안을 돈다", async () => {
    render(<Ask />);
    open();
    await tick();
    const cancel = byText("취소");
    const action = byText("삭제");
    act(() => action.focus());
    key(action, "Tab");
    expect(document.activeElement).toBe(cancel);
    key(cancel, "Tab", { shiftKey: true });
    expect(document.activeElement).toBe(action);
  });

  it("뒤 화면을 보조 기술에서 숨기고 스크롤을 잠근다", async () => {
    render(<Ask />);
    open();
    await tick();
    expect(
      document.querySelector("[data-testid=behind]")!.closest("[aria-hidden]"),
    ).not.toBeNull();
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(true);
  });
});

describe("바닥", () => {
  it("버튼은 1280 미만 medium 40, 이상 small 36", async () => {
    wide = false;
    render(<Ask />);
    open();
    await tick();
    expect(byText("삭제").className).toContain("h-[40px]");
    act(() => byText("취소").click());
    await tick();
    act(() => root.unmount());
    root = createRoot(container);
    wide = true;
    render(<Ask />);
    open();
    await tick();
    expect(byText("삭제").className).toContain("h-[36px]");
  });

  it("취소는 neutralWeak · 확정은 criticalSolid(취소를 Critical 로 칠하지 않는다)", async () => {
    render(<Ask />);
    open();
    await tick();
    expect(byText("취소").className).toContain("bg-bg-neutral-weak");
    expect(byText("삭제").className).toContain("bg-bg-critical-solid");
  });

  it("버튼 하나(알리기)도 그린다", async () => {
    render(
      <AlertDialog defaultOpen>
        <AlertDialogContent>
          <AlertDialogTitle>이미 정산된 거래예요</AlertDialogTitle>
          <AlertDialogDescription>수정할 수 없어요.</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogAction>거래 보기</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>,
    );
    await tick();
    expect(content()!.querySelectorAll("button")).toHaveLength(1);
  });
});

describe("뒤로 가기(1280 미만)", () => {
  it("열면 히스토리에 한 칸을 쌓고, 뒤로 가기가 오면 닫는다", async () => {
    expect(window.history.state?.grooOverlayBack).toBeUndefined();
    const onOpenChange = vi.fn();
    render(<Ask onOpenChange={onOpenChange} />);
    open();
    await tick();
    expect(window.history.state?.grooOverlayBack).toBe(true);
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await tick();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(content()).toBeNull();
  });

  it("1280 이상에서는 걸지 않는다 — 뒤로 가기는 이전 페이지다", async () => {
    wide = true;
    render(<Ask />);
    open();
    await tick();
    expect(window.history.state?.grooOverlayBack).toBeUndefined();
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await tick();
    expect(content()).not.toBeNull();
  });
});

describe("요청 중(busy) — 어느 길도 받지 않는다", () => {
  const popState = () =>
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

  it("확정 버튼이 loading 이면 뒤로 가기가 와도 닫지 않고 칸을 다시 쌓는다 — 다음 뒤로 가기도 확인창으로 온다", async () => {
    const onOpenChange = vi.fn();
    const push = vi.spyOn(window.history, "pushState");
    render(<Ask loading onOpenChange={onOpenChange} />);
    open();
    await tick();
    expect(push).toHaveBeenCalledTimes(1);
    expect(content()!.getAttribute("aria-busy")).toBe("true");
    popState();
    await tick();
    // 닫히지 않고, 먹은 칸 자리에 한 칸을 다시 쌓았다(그대로 두면 다음 뒤로 가기가 요청 중인 화면을 떠난다)
    expect(content()).not.toBeNull();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(push).toHaveBeenCalledTimes(2);
    expect(window.history.state?.grooOverlayBack).toBe(true);
    // 두 번째 뒤로 가기도 같다
    popState();
    await tick();
    expect(content()).not.toBeNull();
    expect(push).toHaveBeenCalledTimes(3);
    push.mockRestore();
  });

  it("요청이 끝나면(loading 꺼짐) 뒤로 가기가 다시 닫는다", async () => {
    const onOpenChange = vi.fn();
    render(<Ask loading onOpenChange={onOpenChange} />);
    open();
    await tick();
    popState();
    await tick();
    expect(content()).not.toBeNull();
    render(<Ask loading={false} onOpenChange={onOpenChange} />);
    await tick();
    expect(content()!.getAttribute("aria-busy")).toBeNull();
    popState();
    await tick();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(content()).toBeNull();
  });

  it("Esc · [취소] 도 요청 중에는 받지 않는다", async () => {
    const onOpenChange = vi.fn();
    render(<Ask loading onOpenChange={onOpenChange} />);
    open();
    await tick();
    key(content()!, "Escape");
    await tick();
    expect(content()).not.toBeNull();
    act(() => byText("취소").click());
    await tick();
    expect(content()).not.toBeNull();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    // 바깥(딤)은 늘 무시
    pointerDown(overlay()!);
    await tick();
    expect(content()).not.toBeNull();
  });

  it("busy prop 으로 직접 켜도 같다(확정 말고 다른 일을 기다릴 때)", async () => {
    const onOpenChange = vi.fn();
    render(
      <AlertDialog defaultOpen busy onOpenChange={onOpenChange}>
        <AlertDialogContent aria-label="묻는 말">
          <AlertDialogDescription>설명</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>,
    );
    await tick();
    popState();
    key(content()!, "Escape");
    await tick();
    expect(content()).not.toBeNull();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});

describe("닫힌 뒤 초점 — 연 줄이 지워졌으면", () => {
  function Rows() {
    const [rows, setRows] = useState(["점심", "커피"]);
    const [target, setTarget] = useState<string | null>(null);
    return (
      <main>
        <h2>자주 쓰는 거래</h2>
        <ul>
          {rows.map((r) => (
            <li key={r}>
              <button type="button" onClick={() => setTarget(r)}>
                {r} 지우기
              </button>
            </li>
          ))}
        </ul>
        <AlertDialog
          open={target != null}
          onOpenChange={(o) => !o && setTarget(null)}
        >
          <AlertDialogContent aria-label="지울까요?">
            <AlertDialogDescription>지워요.</AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => setRows((a) => a.filter((x) => x !== target))}
              >
                지우기
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    );
  }

  it("지운 줄의 ⋮ 가 사라지면 초점은 문서 맨 앞(body)이 아니라 목록 머리로 간다", async () => {
    render(<Rows />);
    const row = byText("점심 지우기");
    act(() => {
      row.focus();
      row.click();
    });
    await tick();
    expect(content()).not.toBeNull();
    act(() => byText("지우기").click());
    await tick();
    await tick();
    expect(document.body.textContent).not.toContain("점심 지우기");
    expect(document.activeElement).toBe(document.querySelector("h2"));
  });
});

describe("띄울 자리", () => {
  it("container 를 주면 그 안에 뜬다(다크 판의 색을 받는다)", async () => {
    const place = document.createElement("div");
    document.body.appendChild(place);
    render(
      <AlertDialog defaultOpen container={place}>
        <AlertDialogContent aria-label="묻는 말">
          <AlertDialogDescription>설명</AlertDialogDescription>
        </AlertDialogContent>
      </AlertDialog>,
    );
    await tick();
    expect(place.contains(content())).toBe(true);
    place.remove();
  });
});
