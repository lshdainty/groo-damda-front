// Dialog · Responsive Dialog 의 동작 — 모양 · 색은 scripts/check-ds-spec.mjs 가 크로미움에서 스펙 값과 맞춘다.
import * as React from "react";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Button } from "@/shared/ds/button";

import {
  Dialog,
  DialogBody,
  DialogCancel,
  DialogContent,
  DialogFooter,
  DialogTrigger,
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogCancel,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogTrigger,
} from "./dialog";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;
let wide = true;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  window.history.replaceState(null, "");
  wide = true;
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
  await new Promise((r) => setTimeout(r, 100));
});

const render = (node: ReactNode) => act(() => root.render(node));
const tick = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

const dialog = () =>
  document.querySelector<HTMLElement>("[data-slot=dialog-content]");
const overlay = () =>
  document.querySelector<HTMLElement>("[data-slot=dialog-overlay]");
const closeButton = () =>
  document.querySelector<HTMLButtonElement>("[data-slot=dialog-close]");
const body = () =>
  document.querySelector<HTMLElement>("[data-slot=dialog-body]");
const byText = (text: string) =>
  Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
    (b) => b.textContent === text,
  )!;

function key(el: Element, k: string) {
  act(() => {
    el.dispatchEvent(
      new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }),
    );
  });
}
const pointerDown = (el: Element) =>
  act(() => {
    el.dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true, cancelable: true }),
    );
  });

function Form({
  form,
  dirty,
  description = "승인되면 알려드려요.",
  size,
  onOpenChange,
}: {
  form?: boolean;
  dirty?: boolean;
  description?: string;
  size?: "medium" | "large";
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <>
      <Dialog form={form} dirty={dirty} onOpenChange={onOpenChange}>
        <DialogTrigger>열기</DialogTrigger>
        <DialogContent title="휴가 신청" description={description} size={size}>
          <DialogBody>
            <input aria-label="사유" />
          </DialogBody>
          <DialogFooter>
            <DialogCancel>취소</DialogCancel>
            <Button>신청</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <p data-testid="behind">뒤 화면</p>
    </>
  );
}

function open() {
  const trigger = byText("열기");
  act(() => {
    trigger.focus();
    trigger.click();
  });
}

describe("역할 · 이름 · 설명", () => {
  it("role=dialog + aria-modal, 제목 aria-labelledby · 설명 aria-describedby", async () => {
    render(<Form />);
    open();
    await tick();
    const d = dialog()!;
    expect(d.getAttribute("role")).toBe("dialog");
    expect(d.getAttribute("aria-modal")).toBe("true");
    expect(
      document.getElementById(d.getAttribute("aria-labelledby")!)?.textContent,
    ).toBe("휴가 신청");
    expect(
      document.getElementById(d.getAttribute("aria-describedby")!)?.textContent,
    ).toBe("승인되면 알려드려요.");
  });

  it("설명이 없으면 aria-describedby 를 걷는다", async () => {
    render(
      <Dialog defaultOpen>
        <DialogContent title="거래 상세">
          <DialogBody>본문</DialogBody>
        </DialogContent>
      </Dialog>,
    );
    await tick();
    expect(dialog()!.hasAttribute("aria-describedby")).toBe(false);
  });

  it("보이는 제목이 없으면 aria-label 이 숨은 제목이 된다", async () => {
    render(
      <Dialog defaultOpen>
        <DialogContent aria-label="명령어 검색">
          <DialogBody>본문</DialogBody>
        </DialogContent>
      </Dialog>,
    );
    await tick();
    const name = document.getElementById(
      dialog()!.getAttribute("aria-labelledby")!,
    );
    expect(name?.textContent).toBe("명령어 검색");
    expect(name?.className).toContain("sr-only");
    // 머리가 없으면 본문이 맨 앞 자식이다(위 24 여백이 걸린다)
    expect(body()!.matches(":first-child")).toBe(true);
  });

  it("크기 — medium 480(기본) · large 800", async () => {
    render(<Form />);
    open();
    await tick();
    expect(dialog()!.className).toContain("w-[480px]");
    act(() => byText("취소").click());
    await tick();
    act(() => root.unmount());
    root = createRoot(container);
    render(<Form size="large" />);
    open();
    await tick();
    expect(dialog()!.className).toContain("w-[800px]");
  });

  it("높이 상한은 화면의 80% 이고 좌우 20 을 남긴다", async () => {
    render(<Form />);
    open();
    await tick();
    expect(dialog()!.className).toContain("max-h-[80dvh]");
    expect(dialog()!.className).toContain(
      "max-w-[calc(100%-var(--spacing-x5)*2)]",
    );
  });
});

describe("닫기 버튼 · 취소는 하나만", () => {
  it("조회 · 안내(form 이 아니면)는 머리 닫기 버튼이 있고 이름은 '닫기'", async () => {
    render(
      <Dialog defaultOpen>
        <DialogContent title="거래 상세">
          <DialogBody>본문</DialogBody>
        </DialogContent>
      </Dialog>,
    );
    await tick();
    expect(closeButton()!.getAttribute("aria-label")).toBe("닫기");
    expect(
      document.querySelector("[data-slot=dialog-header]")!.className,
    ).toContain("pr-x13");
  });

  it("입력 폼(form)은 머리 닫기 버튼이 없고 바닥 [취소] 가 닫는다", async () => {
    const onOpenChange = vi.fn();
    render(<Form form onOpenChange={onOpenChange} />);
    open();
    await tick();
    expect(closeButton()).toBeNull();
    act(() => byText("취소").click());
    await tick();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });
});

describe("닫는 길", () => {
  it("Esc 는 닫는다", async () => {
    const onOpenChange = vi.fn();
    render(<Form onOpenChange={onOpenChange} />);
    open();
    await tick();
    key(dialog()!, "Escape");
    await tick();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("조회 · 안내는 바깥(딤)을 누르면 닫는다", async () => {
    const onOpenChange = vi.fn();
    render(<Form onOpenChange={onOpenChange} />);
    open();
    await tick();
    onOpenChange.mockClear();
    pointerDown(overlay()!);
    await tick();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("입력 폼은 바깥(딤)을 눌러도 닫지 않는다", async () => {
    const onOpenChange = vi.fn();
    render(<Form form onOpenChange={onOpenChange} />);
    open();
    await tick();
    onOpenChange.mockClear();
    pointerDown(overlay()!);
    await tick();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(dialog()).not.toBeNull();
  });

  it("1280 이상에서 뒤로 가기는 닫지 않는다 — 이전 페이지다", async () => {
    render(<Form />);
    open();
    await tick();
    expect(window.history.state?.grooOverlayBack).toBeUndefined();
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await tick();
    expect(dialog()).not.toBeNull();
  });
});

describe("바뀐 값이 있으면 닫기 전에 묻는다", () => {
  it("dirty 에서 [취소] — 확인창이 뜨고 대화상자는 그대로, [계속 작성] 은 묻기 전 자리로", async () => {
    const onOpenChange = vi.fn();
    render(<Form form dirty onOpenChange={onOpenChange} />);
    open();
    await tick();
    onOpenChange.mockClear();
    const input = document.querySelector<HTMLInputElement>("input")!;
    act(() => input.focus());
    act(() => byText("취소").click());
    await tick();
    expect(onOpenChange).not.toHaveBeenCalled();
    const alert = document.querySelector("[role=alertdialog]")!;
    expect(alert.textContent).toContain("작성한 내용이 사라져요");
    act(() => byText("계속 작성").click());
    await tick();
    expect(dialog()).not.toBeNull();
    expect(document.activeElement).toBe(input);
  });

  it("[나가기] 는 대화상자를 닫는다", async () => {
    const onOpenChange = vi.fn();
    render(<Form form dirty onOpenChange={onOpenChange} />);
    open();
    await tick();
    act(() => byText("취소").click());
    await tick();
    act(() => byText("나가기").click());
    await tick();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("Esc 도 묻는다", async () => {
    const onOpenChange = vi.fn();
    render(<Form form dirty onOpenChange={onOpenChange} />);
    open();
    await tick();
    onOpenChange.mockClear();
    key(dialog()!, "Escape");
    await tick();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(document.querySelector("[role=alertdialog]")).not.toBeNull();
  });
});

describe("초점 · 모달", () => {
  it("열면 초점이 대화상자로, 닫으면 연 자리(트리거)로", async () => {
    render(<Form />);
    open();
    await tick();
    expect(document.activeElement).toBe(dialog());
    act(() => byText("취소").click());
    await tick();
    expect(document.activeElement).toBe(byText("열기"));
  });

  it("부모가 open 을 둔 채 대화상자를 통째로 지워 닫아도 연 줄로 초점이 돌아온다(I-wrap-b5 1-b)", async () => {
    const Host = () => {
      const [shown, setShown] = React.useState(false);
      return (
        <>
          <button
            type="button"
            data-testid="row"
            onClick={() => setShown(true)}
          >
            줄
          </button>
          {shown && (
            <Dialog open onOpenChange={(o) => !o && setShown(false)}>
              <DialogContent title="상세">
                <DialogBody>본문</DialogBody>
              </DialogContent>
            </Dialog>
          )}
        </>
      );
    };
    render(<Host />);
    const row = document.querySelector<HTMLElement>("[data-testid=row]")!;
    act(() => row.focus());
    act(() => row.click());
    await tick();
    expect(document.activeElement).toBe(dialog());
    act(() => {
      dialog()!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    await tick();
    await tick();
    expect(document.activeElement).toBe(row);
  });

  it("뒤 화면을 보조 기술에서 숨기고 스크롤을 잠근다", async () => {
    render(<Form />);
    open();
    await tick();
    expect(
      document.querySelector("[data-testid=behind]")!.closest("[aria-hidden]"),
    ).not.toBeNull();
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(true);
  });

  it("열린 동안 Tab 이 대화상자 안을 돈다", async () => {
    render(<Form />);
    open();
    await tick();
    const last = byText("신청");
    act(() => last.focus());
    key(last, "Tab");
    expect(dialog()!.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(last);
  });
});

describe("본문 · 바닥", () => {
  it("본문은 이 안에서만 스크롤한다 — 위로 스크롤되면 data-scrolled(머리 아래 선)", async () => {
    render(<Form />);
    open();
    await tick();
    const b = body()!;
    expect(b.className).toContain("overflow-y-auto");
    expect(b.hasAttribute("data-scrolled")).toBe(false);
    b.scrollTop = 30;
    act(() => {
      b.dispatchEvent(new Event("scroll"));
    });
    expect(b.hasAttribute("data-scrolled")).toBe(true);
    b.scrollTop = 0;
    act(() => {
      b.dispatchEvent(new Event("scroll"));
    });
    expect(b.hasAttribute("data-scrolled")).toBe(false);
  });

  it("넘쳐 스크롤할 수 있는 본문은 Tab 이 선다(키보드 스크롤)", async () => {
    render(
      <Dialog defaultOpen>
        <DialogContent title="긴 목록">
          <DialogBody>긴 내용</DialogBody>
        </DialogContent>
      </Dialog>,
    );
    await tick();
    const b = body()!;
    // jsdom 은 크기를 재지 못한다 — 넘친 것처럼 보이게 하고 다시 재게 한다
    Object.defineProperty(b, "scrollHeight", {
      value: 900,
      configurable: true,
    });
    Object.defineProperty(b, "clientHeight", {
      value: 300,
      configurable: true,
    });
    act(() => {
      b.dispatchEvent(new Event("scroll"));
    });
    expect(b.tabIndex).toBe(0);
  });

  it("scrollFog 면 위 20 · 아래 80 여백, 아니면 맨 끝일 때만 아래 24", async () => {
    render(
      <Dialog defaultOpen>
        <DialogContent title="거래 상세">
          <DialogBody scrollFog>목록</DialogBody>
        </DialogContent>
      </Dialog>,
    );
    await tick();
    expect(body()!.getAttribute("data-scroll-fog")).toBe("overlayBody");
    expect(body()!.className).toContain("pb-[80px]");
    expect(body()!.className).toContain("pt-[20px]");

    act(() => root.unmount());
    root = createRoot(container);
    render(
      <Dialog defaultOpen>
        <DialogContent title="거래 상세">
          <DialogBody>목록</DialogBody>
        </DialogContent>
      </Dialog>,
    );
    await tick();
    expect(body()!.className).toContain("last:pb-x6");
    expect(body()!.hasAttribute("data-scroll-fog")).toBe(false);
  });

  it("바닥은 오른쪽 정렬, 버튼은 small 36 · [취소] 는 neutralWeak", async () => {
    render(<Form />);
    open();
    await tick();
    expect(
      document.querySelector("[data-slot=dialog-footer]")!.className,
    ).toContain("justify-end");
    expect(byText("신청").className).toContain("h-[36px]");
    expect(byText("취소").className).toContain("bg-bg-neutral-weak");
  });
});

describe("Responsive Dialog — 1280 에서 표면이 바뀐다", () => {
  function Resp({ form }: { form?: boolean }) {
    return (
      <ResponsiveDialog form={form} defaultOpen>
        <ResponsiveDialogTrigger>열기</ResponsiveDialogTrigger>
        <ResponsiveDialogContent title="휴가 신청">
          <ResponsiveDialogBody>
            <input aria-label="사유" />
          </ResponsiveDialogBody>
          <ResponsiveDialogFooter>
            <ResponsiveDialogCancel>취소</ResponsiveDialogCancel>
            <Button>신청</Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    );
  }
  const sheet = () =>
    document.querySelector("[data-slot=bottom-sheet-content]");

  it("1280 이상은 대화상자 — form 이면 바닥 [취소] 가 있고 머리 닫기는 없다", async () => {
    render(<Resp form />);
    await tick();
    expect(dialog()).not.toBeNull();
    expect(sheet()).toBeNull();
    expect(byText("취소")).toBeTruthy();
    expect(closeButton()).toBeNull();
  });

  it("1280 미만은 시트 — [취소] 는 그리지 않고 위 닫기 버튼이 맡는다", async () => {
    wide = false;
    render(<Resp form />);
    await tick();
    expect(sheet()).not.toBeNull();
    expect(dialog()).toBeNull();
    expect(
      Array.from(document.querySelectorAll("button")).some(
        (b) => b.textContent === "취소",
      ),
    ).toBe(false);
    expect(
      document.querySelector("[data-slot=bottom-sheet-close]"),
    ).not.toBeNull();
    // 바닥 버튼은 시트의 large 48
    expect(byText("신청").className).toContain("h-[48px]");
  });

  it("조회(form 이 아니면)는 두 표면 모두 머리 닫기 버튼 · 바닥 [취소] 를 두지 않는다", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<Resp />);
    await tick();
    expect(closeButton()).not.toBeNull();
    expect(
      Array.from(document.querySelectorAll("button")).some(
        (b) => b.textContent === "취소",
      ),
    ).toBe(false);
    // 조회에 취소를 두면 개발 중에 알린다
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("열린 채 창 폭이 바뀌면 표면이 바뀌고 열림은 이어진다", async () => {
    const listeners = new Set<() => void>();
    window.matchMedia = ((query: string) => ({
      get matches() {
        return wide && query.includes("1280px");
      },
      media: query,
      addEventListener(_: string, fn: () => void) {
        listeners.add(fn);
      },
      removeEventListener(_: string, fn: () => void) {
        listeners.delete(fn);
      },
    })) as unknown as typeof window.matchMedia;
    render(<Resp form />);
    await tick();
    expect(dialog()).not.toBeNull();
    wide = false;
    act(() => listeners.forEach((fn) => fn()));
    await tick();
    expect(sheet()).not.toBeNull();
    expect(dialog()).toBeNull();
  });
});

describe("띄울 자리 · 모달 끄기", () => {
  it("container 를 주고 modal={false} 면 그 안에 열리고 뒤 화면을 숨기지 않는다", async () => {
    const place = document.createElement("div");
    document.body.appendChild(place);
    render(
      <>
        <Dialog open modal={false} container={place}>
          <DialogContent title="거래 상세">
            <DialogBody>본문</DialogBody>
          </DialogContent>
        </Dialog>
        <p data-testid="behind">뒤 화면</p>
      </>,
    );
    await tick();
    expect(place.contains(dialog())).toBe(true);
    expect(place.contains(overlay())).toBe(true);
    expect(
      document.querySelector("[data-testid=behind]")!.closest("[aria-hidden]"),
    ).toBeNull();
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(false);
    place.remove();
  });
});
