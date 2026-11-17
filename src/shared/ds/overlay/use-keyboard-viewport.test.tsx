// 키보드가 뜨면 시트 · 대화상자가 보이는 영역 밖으로 밀리는 문제(2026-11-16 QA — iPhone Safari 에서 거래 추가 시트의
// 머리 · 종류 칩 · 금액 칸이 화면 위로 나가 끌어도 돌아오지 않음, 가로 화면도 같음).
//
// iOS Safari 는 키보드가 떠도 레이아웃 뷰포트(clientHeight · dvh · fixed 의 기준)를 줄이지 않고 보이는 영역
// (visualViewport)만 줄이고, 초점 칸을 보이려고 그 영역을 아래로 민다(offsetTop). jsdom 에는 visualViewport 가
// 없어 이벤트를 받는 최소한을 심고, 그 값이 바뀔 때 표면의 bottom · top · max-height 가 따라가는지 잠근다.
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetFooter,
} from "@/shared/ds/bottom-sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/shared/ds/alert-dialog";
import { Dialog, DialogBody, DialogContent } from "@/shared/ds/dialog";
import {
  MenuSheet,
  MenuSheetContent,
  MenuSheetGroup,
  MenuSheetItem,
} from "@/shared/ds/menu-sheet";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

type FakeViewport = EventTarget & {
  height: number;
  offsetTop: number;
  scale: number;
};

let container: HTMLDivElement;
let root: Root;
let vv: FakeViewport;

/**
 * 레이아웃 뷰포트 높이(layout — documentElement.clientHeight) · 보이는 영역 높이(visual) · 밀린 만큼(top) ·
 * 손가락 확대 배율(scale) · innerHeight(inner — 주지 않으면 layout 과 같다. iOS Safari 는 키보드가 뜬 채 페이지가
 * 스크롤되면 이것만 줄인다)
 */
function setViewport({
  layout = 844,
  inner = layout,
  visual,
  top = 0,
  scale = 1,
}: {
  layout?: number;
  inner?: number;
  visual: number;
  top?: number;
  scale?: number;
}) {
  Object.defineProperty(document.documentElement, "clientHeight", {
    value: layout,
    configurable: true,
  });
  Object.defineProperty(window, "innerHeight", {
    value: inner,
    configurable: true,
  });
  vv.height = visual;
  vv.offsetTop = top;
  vv.scale = scale;
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  vv = Object.assign(new EventTarget(), {
    height: 844,
    offsetTop: 0,
    scale: 1,
  });
  Object.defineProperty(window, "visualViewport", {
    value: vv,
    configurable: true,
  });
  setViewport({ visual: 844 });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  document.body.removeAttribute("style");
  // 심은 clientHeight 를 걷어 다른 파일의 jsdom 기본값(0)으로 돌린다
  delete (document.documentElement as { clientHeight?: number }).clientHeight;
  vi.restoreAllMocks();
  await new Promise((r) => setTimeout(r, 100));
});

const render = (node: ReactNode) => act(() => root.render(node));
const sheet = () =>
  document.querySelector<HTMLElement>("[data-slot=bottom-sheet-content]")!;

async function fire(target: EventTarget, type: string) {
  await act(async () => {
    target.dispatchEvent(new Event(type, { bubbles: true }));
  });
}

function Sheet({ title = "거래 추가" }: { title?: string }) {
  return (
    <BottomSheet open form>
      <BottomSheetContent title={title}>
        <BottomSheetBody>
          <input aria-label="금액" inputMode="decimal" />
        </BottomSheetBody>
        <BottomSheetFooter>
          <button type="button">다음</button>
        </BottomSheetFooter>
      </BottomSheetContent>
    </BottomSheet>
  );
}

/** 시트의 위 변 · 아래 변(레이아웃 뷰포트 기준). 내용이 상한까지 찼다고 보고 상한을 높이로 쓴다 — 가장 나쁜 값 */
function sheetEdges(el: HTMLElement) {
  const bottom =
    document.documentElement.clientHeight - parseFloat(el.style.bottom);
  return { top: bottom - parseFloat(el.style.maxHeight), bottom };
}

describe("시트 — 키보드가 뜨면 보이는 영역 안에", () => {
  it("키보드가 없으면 아무 값도 박지 않는다(클래스의 bottom-0 · 90dvh 그대로)", async () => {
    render(<Sheet />);
    await fire(vv, "resize");
    const el = sheet();
    expect(el.style.bottom).toBe("");
    expect(el.style.maxHeight).toBe("");
    expect(el.hasAttribute("data-keyboard")).toBe(false);
  });

  it("숫자 키패드(350) — 아래 변을 키보드 윗변에 붙이고 높이 상한을 보이는 높이의 90% 로", async () => {
    render(<Sheet />);
    setViewport({ visual: 494 });
    await fire(vv, "resize");
    const el = sheet();
    expect(el.style.bottom).toBe("350px");
    expect(el.style.maxHeight).toBe(`${Math.floor(494 * 0.9)}px`);
    expect(el.getAttribute("data-keyboard")).toBe("fit");
    // 머리(위 변)가 보이는 영역 안
    const edges = sheetEdges(el);
    expect(edges.top).toBeGreaterThanOrEqual(vv.offsetTop);
    expect(edges.bottom).toBeLessThanOrEqual(vv.offsetTop + vv.height);
  });

  it("iOS 가 초점 칸을 보이려고 보이는 영역을 밀어도(offsetTop) 머리가 화면 위로 나가지 않는다", async () => {
    render(<Sheet />);
    // 키보드 350 이 뜨고 Safari 가 보이는 영역을 200 밀었다 — 예전엔 bottom 350 에 더해 200 만큼 위로 나갔다
    setViewport({ visual: 494, top: 200 });
    await fire(vv, "resize");
    const el = sheet();
    expect(el.style.bottom).toBe("150px");
    const edges = sheetEdges(el);
    expect(edges.top).toBeGreaterThanOrEqual(200);
    expect(edges.bottom).toBe(200 + 494);

    // 끝까지 밀린 상태(offsetTop = 키보드 높이) — 시트는 제자리(bottom 0)
    setViewport({ visual: 494, top: 350 });
    await fire(vv, "scroll");
    expect(el.style.bottom).toBe("0px");
    expect(sheetEdges(el).top).toBeGreaterThanOrEqual(350);
  });

  it("resize 없이 밀기만 해도(visualViewport scroll) 따라간다 — 끌어 밀어도 돌아온다", async () => {
    render(<Sheet />);
    setViewport({ visual: 494 });
    await fire(vv, "resize");
    setViewport({ visual: 494, top: 120 });
    await fire(vv, "scroll");
    expect(sheet().style.bottom).toBe("230px");
    setViewport({ visual: 494, top: 0 });
    await fire(vv, "scroll");
    expect(sheet().style.bottom).toBe("350px");
  });

  it("숫자 키패드 → 글자 키보드 → 내림 — 매번 지금 값으로 맞추고, 내리면 다 걷는다", async () => {
    render(<Sheet />);
    const el = sheet();
    setViewport({ visual: 594 });
    await fire(vv, "resize");
    expect(el.style.bottom).toBe("250px");

    setViewport({ visual: 514 });
    await fire(vv, "resize");
    expect(el.style.bottom).toBe("330px");
    expect(el.style.maxHeight).toBe(`${Math.floor(514 * 0.9)}px`);

    // 초점을 빼서 내림 — resize 가 늦게 오는 iOS 를 흉내 내 focusout 만 보낸다
    setViewport({ visual: 844 });
    await fire(document, "focusout");
    expect(el.style.bottom).toBe("");
    expect(el.style.maxHeight).toBe("");
    expect(el.hasAttribute("data-keyboard")).toBe(false);
  });

  it("vaul 의 키보드 처리는 꺼져 있다 — 초점 칸이 있어도 height 를 박지 않는다", async () => {
    render(<Sheet />);
    const input = document.querySelector<HTMLInputElement>("input")!;
    await act(async () => input.focus());
    setViewport({ visual: 494 });
    await fire(vv, "resize");
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });
    expect(sheet().style.height).toBe("");
    expect(sheet().style.bottom).toBe("350px");
  });

  it("키보드가 뜬 채 페이지가 스크롤돼 innerHeight 가 줄어도(iOS Safari 714 → 625) 키보드 높이 · 시트 위치는 그대로", async () => {
    // 그루 계정 웹 GA-02 와 같은 함정 — innerHeight 로 재면 키보드 높이가 스크롤만큼(89) 모자라 시트 아래 변이 키보드
    // · 입력 도구줄 밑으로 들어간다. 레이아웃 뷰포트(clientHeight)는 그대로다.
    render(<Sheet />);
    const el = sheet();
    setViewport({ layout: 714, visual: 364 });
    await fire(vv, "resize");
    expect(el.style.bottom).toBe("350px");
    const before = el.style.maxHeight;
    expect(before).toBe(`${Math.floor(364 * 0.9)}px`);

    setViewport({ layout: 714, inner: 625, visual: 364 });
    await fire(vv, "scroll");
    expect(el.style.bottom).toBe("350px");
    expect(el.style.maxHeight).toBe(before);
    expect(el.getAttribute("data-keyboard")).toBe("fit");
    // 아래 변이 키보드 윗변(보이는 영역 아래)에 그대로 붙어 있다
    expect(sheetEdges(el).bottom).toBe(vv.offsetTop + vv.height);
  });

  it("주소창이 접히는 정도(60 이하)는 키보드가 아니다", async () => {
    render(<Sheet />);
    setViewport({ visual: 790 });
    await fire(vv, "resize");
    expect(sheet().style.bottom).toBe("");
  });

  it("손가락 확대(scale 2)로 보이는 높이가 준 것은 키보드가 아니다", async () => {
    render(<Sheet />);
    setViewport({ visual: 422, top: 300, scale: 2 });
    await fire(vv, "resize");
    expect(sheet().style.bottom).toBe("");
    expect(sheet().style.maxHeight).toBe("");
  });

  it("삼성 인터넷 — 레이아웃 뷰포트도 같이 줄면(clientHeight == visual) 손대지 않는다(dvh 가 이미 줄었다)", async () => {
    render(<Sheet />);
    setViewport({ layout: 422, visual: 422 });
    await fire(vv, "resize");
    expect(sheet().style.bottom).toBe("");
  });

  it("겹친 시트도 각자 맞춘다", async () => {
    render(
      <>
        <Sheet />
        <Sheet title="고르기" />
      </>,
    );
    setViewport({ visual: 494, top: 100 });
    await fire(vv, "resize");
    const els = document.querySelectorAll<HTMLElement>(
      "[data-slot=bottom-sheet-content]",
    );
    expect(els.length).toBe(2);
    els.forEach((e) => expect(e.style.bottom).toBe("250px"));
  });

  it("키보드가 떠 있는 채 열린 시트는 열리자마자 맞는다", async () => {
    setViewport({ visual: 494 });
    render(<Sheet />);
    await fire(document, "focusin");
    expect(sheet().style.bottom).toBe("350px");
  });

  it("visualViewport 가 없어도 죽지 않는다", async () => {
    Object.defineProperty(window, "visualViewport", {
      value: undefined,
      configurable: true,
    });
    render(<Sheet />);
    await fire(window, "resize");
    expect(sheet().style.bottom).toBe("");
  });
});

describe("가로 화면 — 머리 · 바닥만으로 보이는 영역이 차면 표면 전체가 스크롤", () => {
  /** 머리 78 · 바닥 76 · 입력 칸 56 으로 잰 것처럼 만든다(jsdom 은 레이아웃이 없다) */
  function fakeHeights() {
    const heights: Record<string, number> = {
      "bottom-sheet-header": 78,
      "bottom-sheet-footer": 76,
    };
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        const slot = this.getAttribute("data-slot") ?? "";
        // 표면(스크롤 상자가 되면) 0 ~ 135, 금액 칸은 그 아래 200 ~ 256 에 밀려 있다
        if (slot === "bottom-sheet-content") {
          return { top: 0, bottom: 135, height: 135 } as DOMRect;
        }
        if (this.getAttribute("aria-label") === "금액") {
          return { top: 200, bottom: 256, height: 56 } as DOMRect;
        }
        const h = heights[slot] ?? 0;
        return { height: h, top: 0, bottom: h } as DOMRect;
      },
    );
  }

  it("보이는 높이 150 — 본문 몫(135 − 154)에 금액 칸이 안 들어가 표면이 스크롤 상자가 된다", async () => {
    fakeHeights();
    render(<Sheet />);
    const input = document.querySelector<HTMLInputElement>("input")!;
    await act(async () => input.focus());
    Object.defineProperty(window, "innerWidth", {
      value: 874,
      configurable: true,
    });
    setViewport({ layout: 402, visual: 150 });
    await fire(vv, "resize");

    const el = sheet();
    const body = el.querySelector<HTMLElement>(
      "[data-slot=bottom-sheet-body]",
    )!;
    expect(el.getAttribute("data-keyboard")).toBe("cramped");
    expect(el.style.overflowY).toBe("auto");
    // flex: none — 본문이 줄지 않고 내용 높이로 편다
    expect(body.style.flexShrink).toBe("0");
    expect(body.style.flexGrow).toBe("0");
    expect(body.style.overflowY).toBe("visible");
    // 막 좁아졌을 때 입력 중인 칸을 표면 스크롤 안에서 보이게 한다(칸 아래 256 − 상자 아래 135)
    expect(el.scrollTop).toBe(256 - 135);

    // 키보드를 내리면 원래대로 — 본문만 스크롤
    setViewport({ layout: 402, visual: 402 });
    await fire(vv, "resize");
    expect(el.style.overflowY).toBe("");
    expect(body.style.flex).toBe("");
    expect(el.hasAttribute("data-keyboard")).toBe(false);
  });

  it("세로 화면(보이는 높이 494)은 본문 몫이 넉넉해 본문만 스크롤한다", async () => {
    fakeHeights();
    render(<Sheet />);
    const input = document.querySelector<HTMLInputElement>("input")!;
    await act(async () => input.focus());
    setViewport({ visual: 494 });
    await fire(vv, "resize");
    expect(sheet().getAttribute("data-keyboard")).toBe("fit");
    expect(sheet().style.overflowY).toBe("");
  });
});

describe("대화상자 — 키보드가 뜨면 보이는 영역 가운데", () => {
  function Box() {
    return (
      <Dialog open form>
        <DialogContent title="거래 추가">
          <DialogBody>
            <input aria-label="금액" />
          </DialogBody>
        </DialogContent>
      </Dialog>
    );
  }
  const box = () =>
    document.querySelector<HTMLElement>("[data-slot=dialog-content]")!;

  it("가운데(top)를 보이는 영역 가운데로, 높이 상한을 보이는 높이의 80% 로 — 내리면 걷는다", async () => {
    render(<Box />);
    expect(box().style.top).toBe("");

    // 가로 태블릿 — 레이아웃 1024 중 키보드가 400 을 가리고 보이는 영역이 100 밀림
    setViewport({ layout: 1024, visual: 624, top: 100 });
    await fire(vv, "resize");
    expect(box().style.top).toBe(`${100 + 624 / 2}px`);
    expect(box().style.maxHeight).toBe(`${Math.floor(624 * 0.8)}px`);
    // 위 변 = 가운데 − 상한/2 가 보이는 영역 안
    const top = 100 + 624 / 2 - Math.floor(624 * 0.8) / 2;
    expect(top).toBeGreaterThanOrEqual(100);

    setViewport({ layout: 1024, visual: 1024 });
    await fire(vv, "resize");
    expect(box().style.top).toBe("");
    expect(box().style.maxHeight).toBe("");
  });
});

describe("초점 칸 — 키보드 · 바닥 버튼 위에 칸 전체가 보이게 본문을 스크롤", () => {
  /** 본문 100 ~ 400(아래 scroll-padding 80 → 보이는 칸 320 까지) · 초점 칸 380 ~ 436 으로 잰 것처럼 */
  function fakeLayout(field: { top: number; bottom: number }) {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        if (this.getAttribute("data-slot") === "bottom-sheet-body") {
          return { top: 100, bottom: 400, height: 300 } as DOMRect;
        }
        if (this.getAttribute("aria-label") === "금액") {
          return {
            ...field,
            height: field.bottom - field.top,
          } as DOMRect;
        }
        return { top: 0, bottom: 0, height: 0 } as DOMRect;
      },
    );
  }
  function FogSheet() {
    return (
      <BottomSheet open form>
        <BottomSheetContent title="거래 추가">
          <BottomSheetBody
            scrollFog
            style={{ scrollPaddingTop: 20, scrollPaddingBottom: 80 }}
          >
            <input aria-label="금액" />
          </BottomSheetBody>
          <BottomSheetFooter>
            <button type="button">추가</button>
          </BottomSheetFooter>
        </BottomSheetContent>
      </BottomSheet>
    );
  }
  const body = () =>
    document.querySelector<HTMLElement>("[data-slot=bottom-sheet-body]")!;

  it("키보드가 떠 본문이 줄면 칸 아래 변이 보이는 칸(흐림 위) 안에 오게 내린다", async () => {
    fakeLayout({ top: 380, bottom: 436 });
    render(<FogSheet />);
    await act(async () => document.querySelector("input")!.focus());
    expect(body().scrollTop).toBe(0); // 키보드가 없을 때는 손대지 않는다(브라우저 몫)
    setViewport({ visual: 494 });
    await fire(vv, "resize");
    expect(body().scrollTop).toBe(436 - (400 - 80));
  });

  it("칸이 위로 벗어나 있으면 칸의 위를 맞춘다", async () => {
    fakeLayout({ top: 60, bottom: 116 });
    render(<FogSheet />);
    body().scrollTop = 200;
    await act(async () => document.querySelector("input")!.focus());
    setViewport({ visual: 494 });
    await fire(vv, "resize");
    expect(body().scrollTop).toBe(200 - (100 + 20 - 60));
  });

  it("키보드를 내리면 넣은 스크롤을 되돌린다 — 칸 위 라벨이 머리 밑에 가린 채 남지 않는다", async () => {
    fakeLayout({ top: 380, bottom: 436 });
    render(<FogSheet />);
    body().scrollTop = 30;
    await act(async () => document.querySelector("input")!.focus());
    setViewport({ visual: 494 });
    await fire(vv, "resize");
    expect(body().scrollTop).toBe(30 + 436 - (400 - 80));

    setViewport({ visual: 844 });
    await fire(vv, "resize");
    expect(body().scrollTop).toBe(30);
  });

  it("키보드가 바뀌며 여러 번 넣었어도 처음 자리로 — 숫자 키패드 → 글자 키보드 → 내림", async () => {
    fakeLayout({ top: 380, bottom: 436 });
    render(<FogSheet />);
    await act(async () => document.querySelector("input")!.focus());
    setViewport({ visual: 594 });
    await fire(vv, "resize");
    setViewport({ visual: 514 });
    await fire(vv, "resize");
    expect(body().scrollTop).toBe(2 * (436 - (400 - 80)));

    // resize 가 늦게 오는 iOS — focusout 으로 내려가도 같다
    setViewport({ visual: 844 });
    await fire(document, "focusout");
    expect(body().scrollTop).toBe(0);
  });

  it("넣은 뒤 사용자가 직접 민 스크롤은 키보드를 내려도 그대로 둔다", async () => {
    fakeLayout({ top: 380, bottom: 436 });
    render(<FogSheet />);
    await act(async () => document.querySelector("input")!.focus());
    setViewport({ visual: 494 });
    await fire(vv, "resize");
    body().scrollTop = 50;
    setViewport({ visual: 844 });
    await fire(vv, "resize");
    expect(body().scrollTop).toBe(50);
  });

  it("보이는 영역을 밀기만 할 때(scroll)는 끌어당기지 않는다 — 손으로 본문을 보는 중", async () => {
    fakeLayout({ top: 380, bottom: 436 });
    render(<FogSheet />);
    await act(async () => document.querySelector("input")!.focus());
    setViewport({ visual: 494 });
    await fire(vv, "resize");
    body().scrollTop = 0;
    setViewport({ visual: 494, top: 40 });
    await fire(vv, "scroll");
    expect(body().scrollTop).toBe(0);
  });
});

describe("iPhone Safari 26 — 떠 있는 주소 알약 · 입력 도구줄은 보이는 영역이 이미 뺐다", () => {
  // 2026-11-17 QA 실측(iPhone 17 Pro · Safari 26 · pt) — 웹 콘텐츠 위끝이 화면 62.
  //   숫자 키패드: 보이는 영역 410 · 밀림 304 → 아래 끝 62 + 410 = 472 = 알약 윗변(알약 473 · 도구줄 515 · 키보드 570)
  //   한글 키보드: 보이는 영역 384 · 밀림 274 → 아래 끝 62 + 384 = 446 = 알약 윗변(알약 446 · 도구줄 489 · 키보드 545)
  // 둘 다 알약 · 도구줄 · 키보드를 이미 빼고 준다 — 시트 아래 변 = 보이는 영역 아래 변. 도구줄 몫을 한 번 더 빼면
  // 그만큼(56) 시트 아래가 비어 뒤 페이지가 흐림 없이 비쳤다.
  const IOS26 =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";

  it.each([
    { keyboard: "숫자 키패드", visual: 410, top: 304, bottom: 0 },
    { keyboard: "한글 키보드", visual: 384, top: 274, bottom: 56 },
  ])(
    "$keyboard — 시트 bottom 은 714 − (밀림 + 보이는 높이), 높이 상한은 보이는 높이의 90%",
    async ({ visual, top, bottom }) => {
      vi.spyOn(navigator, "userAgent", "get").mockReturnValue(IOS26);
      render(<Sheet />);
      setViewport({ layout: 714, visual, top });
      await fire(vv, "resize");
      const el = sheet();
      expect(el.style.bottom).toBe(`${714 - (top + visual)}px`);
      expect(el.style.bottom).toBe(`${bottom}px`);
      expect(el.style.maxHeight).toBe(`${Math.floor(visual * 0.9)}px`);
      // 아래 변이 보이는 영역 아래 변(= 알약 윗변)에 딱 붙는다 — 사이가 비지 않는다
      expect(sheetEdges(el).bottom).toBe(top + visual);
    },
  );
});

describe("딤 — 늘 화면 위아래로 넘쳐 키보드 아래 띠까지 덮는다(dim-bounds.ts)", () => {
  // 2026-11-17 QA(iPhone 17 Pro · Safari 26) — 키보드가 뜨면 레이아웃 뷰포트 아래 띠(주소 알약 · 입력 도구줄 둘레 ~ 키보드 윗변)에
  // 뒤 페이지가 비쳤다. 딤 ::after(#616)도 body 끝 absolute 거울(#620)도 못 칠했고, fixed 인 상자 자체를 화면 위아래로 넉넉히
  // 넘치게 둔 층만 띠 · 도구줄 뒤 · 키보드 윗변 둥근 부분까지 칠했다. 실제 그림은 실기기로만 — 여기서는 클래스 · 거울 없음 ·
  // 표면 동작(#612 · #613)이 그대로인지를 잠근다.
  const BOUNDS = ["fixed", "inset-x-0", "-top-[100lvh]", "-bottom-[100lvh]"];

  function expectDim(overlay: HTMLElement | null, surface?: HTMLElement) {
    expect(overlay).not.toBeNull();
    if (surface) expect(overlay!.nextElementSibling).toBe(surface);
    const classes = overlay!.className.split(/\s+/);
    expect(classes).toEqual(expect.arrayContaining(BOUNDS));
    // 레이아웃 뷰포트만 덮던 inset-0 · 걷어 낸 ::after 덮개(#616)는 남지 않는다
    expect(classes).not.toContain("inset-0");
    expect(overlay!.className).not.toMatch(/:after:/);
    // 범위는 클래스 몫 — 키보드 훅 · vaul 이 자리를 인라인으로 덮어쓰지 않는다
    for (const prop of ["top", "bottom", "height", "max-height", "inset"]) {
      expect(overlay!.style.getPropertyValue(prop)).toBe("");
    }
  }

  const band = () => document.querySelector("[data-slot=keyboard-band]");

  it("시트 · 대화상자 · 확인창 · Menu Sheet 의 딤이 모두 넘침 범위를 쓴다", async () => {
    render(<Sheet />);
    expectDim(
      document.querySelector<HTMLElement>("[data-slot=bottom-sheet-overlay]"),
      sheet(),
    );
    render(
      <Dialog open>
        <DialogContent title="거래 상세">
          <DialogBody>내용</DialogBody>
        </DialogContent>
      </Dialog>,
    );
    expectDim(
      document.querySelector<HTMLElement>("[data-slot=dialog-overlay]"),
    );
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>거래를 삭제할까요?</AlertDialogTitle>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>,
    );
    expectDim(
      document.querySelector<HTMLElement>("[data-slot=alert-dialog-overlay]"),
    );
    render(
      <MenuSheet open>
        <MenuSheetContent title="제어">
          <MenuSheetGroup>
            <MenuSheetItem label="수정" />
          </MenuSheetGroup>
        </MenuSheetContent>
      </MenuSheet>,
    );
    expectDim(
      document.querySelector<HTMLElement>("[data-slot=bottom-sheet-overlay]"),
    );
  });

  it("시트 — 키보드가 떠도 딤은 그대로(거울 덮개를 만들지 않는다), 시트만 보이는 영역에 · 내리면 시트 값만 걷는다", async () => {
    render(<Sheet />);
    const overlay = document.querySelector<HTMLElement>(
      "[data-slot=bottom-sheet-overlay]",
    )!;
    const before = overlay.className;
    const bodyChildren = document.body.childElementCount;

    // 숫자 키패드(714 · 410 · 밀림 304) — 시트 아래 변은 보이는 영역 아래 끝(#613), 높이 상한은 보이는 높이의 90%(#612)
    setViewport({ layout: 714, visual: 410, top: 304 });
    await fire(vv, "resize");
    expect(sheet().getAttribute("data-keyboard")).toBe("fit");
    expect(sheet().style.bottom).toBe("0px");
    expect(sheet().style.maxHeight).toBe(`${Math.floor(410 * 0.9)}px`);
    expectDim(overlay, sheet());
    expect(overlay.className).toBe(before);
    expect(band()).toBeNull();
    expect(document.body.childElementCount).toBe(bodyChildren);

    // 한글 키보드(384 · 274) · 밀기만(scroll)도 같다
    setViewport({ layout: 714, visual: 384, top: 274 });
    await fire(vv, "resize");
    await fire(vv, "scroll");
    expect(sheet().style.maxHeight).toBe(`${Math.floor(384 * 0.9)}px`);
    expectDim(overlay, sheet());
    expect(band()).toBeNull();

    setViewport({ layout: 714, visual: 714 });
    await fire(vv, "resize");
    expect(sheet().hasAttribute("data-keyboard")).toBe(false);
    expect(sheet().style.bottom).toBe("");
    expect(sheet().style.maxHeight).toBe("");
    expectDim(overlay, sheet());
    expect(overlay.className).toBe(before);
    expect(document.body.childElementCount).toBe(bodyChildren);
  });

  it("대화상자 — 키보드가 뜨면 가운데만 옮기고 딤은 그대로, 거울 덮개 없음", async () => {
    render(
      <Dialog open form>
        <DialogContent title="거래 추가">
          <DialogBody>
            <input aria-label="금액" />
          </DialogBody>
        </DialogContent>
      </Dialog>,
    );
    const overlay = document.querySelector<HTMLElement>(
      "[data-slot=dialog-overlay]",
    )!;
    const box = document.querySelector<HTMLElement>(
      "[data-slot=dialog-content]",
    )!;
    setViewport({ layout: 1024, visual: 624, top: 100 });
    await fire(vv, "resize");
    expect(box.style.top).toBe(`${100 + 624 / 2}px`);
    expectDim(overlay, box);
    expect(band()).toBeNull();
  });
});
