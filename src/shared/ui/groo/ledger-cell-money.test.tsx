// 주 띠 칸 금액 — 들어가면 금액, 안 들어가면 점 "•"(B3 2A). 폭은 실제로 재므로 jsdom 에서는 레이아웃을 흉내 낸다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LedgerCellMoney } from "./ledger";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const layout = { text: 40, cell: 51 };
const observers: (() => void)[] = [];
const originalRO = globalThis.ResizeObserver;
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  observers.length = 0;
  globalThis.ResizeObserver = class {
    cb: () => void;
    constructor(cb: () => void) {
      this.cb = cb;
    }
    observe() {
      observers.push(this.cb);
    }
    unobserve() {}
    disconnect() {}
  } as never;
  // 글 span(= 금액 래퍼의 첫 자식)의 폭은 글 폭, 그 밖의 요소(칸)는 칸 폭
  Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
    configurable: true,
    value() {
      const isText =
        this.parentElement?.getAttribute("data-slot") === "ledger-cell-money";
      const width = isText ? layout.text : layout.cell;
      return { width, height: 15, top: 0, left: 0, right: width, bottom: 15 };
    },
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  globalThis.ResizeObserver = originalRO;
  // @ts-expect-error jsdom 기본값으로 되돌린다(Element 쪽 원본이 다시 보인다)
  delete HTMLElement.prototype.getBoundingClientRect;
});

const render = (tone: "expense" | "income", text: string) =>
  act(() =>
    root.render(
      <div>
        <LedgerCellMoney tone={tone}>{text}</LedgerCellMoney>
      </div>,
    ),
  );
const wrap = () =>
  container.querySelector("[data-slot=ledger-cell-money]") as HTMLElement;
const relayout = () => act(() => observers.forEach((cb) => cb()));

describe("LedgerCellMoney", () => {
  it("칸에 들어가면 금액 그대로 — 점 없음", () => {
    layout.text = 38;
    render("expense", "−4,500");
    expect(wrap().textContent).toBe("−4,500");
    expect(wrap().querySelector("[aria-hidden]")).toBeNull();
    expect(wrap().dataset.dot).toBeUndefined();
  });

  it("안 들어가면 금액 대신 점 — 말줄임 없음, 점은 aria-hidden, 글 색 그대로", () => {
    layout.text = 77;
    render("income", "+400,000,000");
    const w = wrap();
    expect(w.dataset.dot).toBe("true");
    expect(w.textContent).not.toContain("…");
    const dot = Array.from(w.querySelectorAll("span")).find(
      (s) => s.textContent === "•",
    )!;
    expect(dot.getAttribute("aria-hidden")).toBe("true");
    expect(w.className).toContain("text-fg-brand");
    expect(w.className).toContain("text-t1");
    // 금액 글은 낭독에서 빠지고(칸 이름이 맡는다) 눈에는 안 보인다
    const text = w.firstElementChild as HTMLElement;
    expect(text.getAttribute("aria-hidden")).toBe("true");
    expect(text.className).toContain("invisible");
  });

  it("글자 크기가 바뀌어(칸은 그대로) 글이 커지면 여섯 자리도 점이 되고, 돌아오면 금액으로 돌아온다", () => {
    layout.text = 38;
    render("expense", "−98,765");
    expect(wrap().dataset.dot).toBeUndefined();
    layout.text = 76; // 글자 200%
    relayout();
    expect(wrap().dataset.dot).toBe("true");
    layout.text = 38;
    relayout();
    expect(wrap().dataset.dot).toBeUndefined();
  });

  it("칸이 넓어지면(430 → 큰 화면) 같은 글이 들어간다", () => {
    layout.text = 63;
    layout.cell = 51;
    render("expense", "−1,234,567");
    expect(wrap().dataset.dot).toBe("true");
    layout.cell = 66;
    relayout();
    expect(wrap().dataset.dot).toBeUndefined();
    layout.cell = 51;
  });
});
