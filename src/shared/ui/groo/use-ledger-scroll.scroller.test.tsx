// 원장 스크롤 훅 — 스크롤 상자가 요소일 때와 문서일 때 같은 자리로 가고 같은 scroll 을 듣는다(폰 문서 스크롤 전환의 안전망).
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LEDGER_COLLAPSE_SCROLL } from "./use-ledger-scroll";

let scroller: HTMLElement | null = null;
vi.mock("@/shared/lib/groo/shell-scroller", () => ({
  closestScroller: () => scroller,
}));
const { useLedgerScroll } = await import("./use-ledger-scroll");

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let host: HTMLDivElement;
let root: Root;
let api: ReturnType<typeof useLedgerScroll>;
let top = 0;
let scrollTo: ReturnType<typeof vi.fn>;
let collapsed: number;

function Harness({ expanded }: { expanded: boolean }) {
  const { rootRef, ...rest } = useLedgerScroll({
    expanded,
    onCollapse: () => {
      collapsed += 1;
    },
  });
  useEffect(() => {
    api = { rootRef, ...rest };
  });
  return (
    <div ref={rootRef}>
      <section data-ledger-day="2026-05-02" id="g" />
    </div>
  );
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  top = 0;
  collapsed = 0;
  scrollTo = vi.fn();
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  delete (document.documentElement as unknown as Record<string, unknown>)
    .getBoundingClientRect;
  for (const k of ["scrollTop", "scrollTo"])
    delete (document.documentElement as unknown as Record<string, unknown>)[k];
});

function prepare(kind: "element" | "document") {
  const box = document.createElement("div");
  document.body.appendChild(box);
  scroller = kind === "element" ? box : document.documentElement;
  Object.defineProperties(scroller, {
    scrollTop: {
      configurable: true,
      get: () => top,
      set: (v: number) => {
        top = v;
      },
    },
    scrollTo: { configurable: true, value: scrollTo },
  });
  // 머리 아래 56 에 있는 요소 상자 / 윗변이 -scrollY 인 문서
  scroller.getBoundingClientRect = () =>
    ({ top: kind === "element" ? 56 : -top }) as DOMRect;
  return {
    source: (kind === "element" ? box : document) as EventTarget,
    group: () => host.querySelector<HTMLElement>("#g")!,
    cleanup: () => box.remove(),
  };
}

describe.each(["element", "document"] as const)(
  "useLedgerScroll — 스크롤 상자가 %s",
  (kind) => {
    it("날 누름 이동: 목표는 문서 좌표 — 스크롤 위치 + 묶음의 화면 위치 − 상자 윗변(문서는 0)", () => {
      const p = prepare(kind);
      act(() => root.render(<Harness expanded={false} />));
      top = 100;
      // 묶음이 화면 300 에 있다 — 요소 상자 안 기준으로는 244, 문서 기준으로는 300 이 아니라 상자(56)만큼 아래라 같은 논리 위치(344)를 만든다
      p.group().getBoundingClientRect = () =>
        ({ top: kind === "element" ? 300 : 244 }) as DOMRect;
      act(() => api.scrollToDay("2026-05-02"));
      expect(scrollTo).toHaveBeenCalledTimes(1);
      expect(scrollTo.mock.calls[0]![0]).toMatchObject({
        top: 344,
        behavior: "smooth",
      });
      p.cleanup();
    });

    it("맨 위로: scrollTo({top: 0, smooth})", () => {
      const p = prepare(kind);
      act(() => root.render(<Harness expanded={false} />));
      act(() => api.scrollToTop());
      expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
      p.cleanup();
    });

    it("펼친 달력은 이 상자의 scroll 로 20 이상 내리면 접는다", () => {
      const p = prepare(kind);
      act(() => root.render(<Harness expanded />));
      top = LEDGER_COLLAPSE_SCROLL + 5;
      act(() => void p.source.dispatchEvent(new Event("scroll")));
      expect(collapsed).toBe(1);
      p.cleanup();
    });
  },
);
