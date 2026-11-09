// 스크롤 기억(탭 · 화면)이 스크롤 상자가 요소일 때와 문서(documentElement)일 때 같게 동작한다 — 폰 문서 스크롤 전환의 안전망.
// 셸 스크롤 주체(getShellScroller)를 시험이 바꿔 끼운다: 지금 제품은 늘 main 이고, 문서는 PR ② 가 켠다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { scrollHostOf, type ScrollHost } from "@/shared/lib/groo/scroll-host";

let current: ScrollHost | null = null;
vi.mock("@/shared/lib/groo/shell-scroller", () => ({
  getShellScroller: () => current,
}));

const { enterScreen, resetScreenMemory, restoreScreen, watchScreen } =
  await import("../lib/screen-memory");
const { expectRestore, recall, restoreScroll } =
  await import("../lib/tab-memory");
const { TabMemory } = await import("../ui/TabMemory");

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let main: HTMLElement;
let top = 0;
let max = 700;

function setup(kind: "element" | "document") {
  const el = kind === "element" ? main : document.documentElement;
  top = 0;
  Object.defineProperties(el, {
    scrollTop: {
      configurable: true,
      get: () => top,
      set: (v: number) => {
        top = v;
      },
    },
    scrollHeight: { configurable: true, get: () => max + 300 },
    clientHeight: { configurable: true, value: 300 },
  });
  vi.stubGlobal("innerHeight", 300); // 문서 상자의 보이는 높이는 innerHeight 다
  current = scrollHostOf(el);
  // 스크롤 이벤트는 요소는 요소에, 문서는 document 로 온다
  return {
    el,
    scrollTo(y: number) {
      top = y;
      (kind === "element" ? el : document).dispatchEvent(
        new Event("scroll", { bubbles: kind === "document" }),
      );
    },
  };
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  resetScreenMemory();
  main = document.createElement("main");
  main.id = "main";
  main.tabIndex = -1;
  document.body.appendChild(main);
  max = 700;
});
afterEach(() => {
  main.remove();
  for (const k of ["scrollTop", "scrollHeight", "clientHeight"])
    delete (document.documentElement as unknown as Record<string, unknown>)[k];
  current = null;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe.each(["element", "document"] as const)(
  "스크롤 기억 — 스크롤 상자가 %s",
  (kind) => {
    it("restoreScroll: 높이가 y 에 닿으면 바로 그 y 로 간다", () => {
      vi.useFakeTimers();
      const s = setup(kind);
      void s;
      restoreScroll(current!, 400);
      vi.advanceTimersByTime(40);
      expect(top).toBe(400);
    });

    it("restoreScroll: 높이가 모자라면 기다리다 닿는 데까지만 간다(1.5초)", () => {
      vi.useFakeTimers();
      setup(kind);
      max = 100;
      restoreScroll(current!, 400);
      vi.advanceTimersByTime(1700);
      expect(top).toBe(100);
    });

    it("restoreScroll: 손가락이 닿으면(touchstart) 복원을 멈춘다 — 듣는 자리가 상자의 이벤트 자리다", () => {
      vi.useFakeTimers();
      setup(kind);
      max = 0;
      restoreScroll(current!, 400);
      (kind === "element" ? main : document).dispatchEvent(
        new Event("touchstart"),
      );
      max = 700;
      vi.advanceTimersByTime(100);
      expect(top).toBe(0);
    });

    it("restoreScroll: 문서 상자면 시트(셸 밖)를 만져도 복원을 멈추지 않고, 머리 · 본문(셸 안)을 만지면 멈춘다 (F3)", () => {
      if (kind !== "document") return;
      vi.useFakeTimers();
      setup(kind);
      const app = document.createElement("div");
      app.className = "m-app";
      const header = document.createElement("header");
      app.append(header);
      document.body.appendChild(app);
      const sheet = document.createElement("div");
      document.body.appendChild(sheet);
      const touch = (target: Element) =>
        target.dispatchEvent(new Event("touchstart", { bubbles: true }));
      const tryRestore = (target: Element) => {
        top = 0;
        max = 0;
        restoreScroll(current!, 400);
        touch(target);
        max = 700;
        vi.advanceTimersByTime(100);
        return top;
      };
      expect(tryRestore(sheet)).toBe(400); // 시트를 건드렸다 — 본문이 아니다
      expect(tryRestore(header)).toBe(0); // 머리에서 끌어도 문서가 스크롤한다 — 멈춘다
      app.remove();
      sheet.remove();
    });

    it("watchScreen: 이 상자의 scroll 을 화면 키에 적고 POP 에서 그 값으로 돌려놓는다", () => {
      vi.useFakeTimers();
      const s = setup(kind);
      const unwatch = watchScreen();
      enterScreen("k1");
      s.scrollTo(320);
      s.scrollTo(321);
      top = 0; // 상세에서 돌아오니 상자가 맨 위에 있다
      const stop = restoreScreen("k1");
      expect(stop).not.toBe(false);
      vi.advanceTimersByTime(40);
      expect(top).toBe(321);
      if (stop) stop();
      unwatch();
    });

    it("watchScreen: 안쪽 상자의 scroll 은 적지 않는다", () => {
      const s = setup(kind);
      void s;
      const unwatch = watchScreen();
      enterScreen("k2");
      const inner = document.createElement("div");
      main.appendChild(inner);
      top = 500;
      inner.dispatchEvent(new Event("scroll")); // capture 로 오지만 상자의 것이 아니다
      expect(restoreScreen("k2")).toBe(false);
      unwatch();
    });

    it("TabMemory: 스크롤을 탭에 적고, 탭 바가 옮겨 온 뒤 기억한 스크롤로 복원한다", () => {
      vi.useFakeTimers();
      const s = setup(kind);
      const host = document.createElement("div");
      document.body.appendChild(host);
      const root: Root = createRoot(host);
      act(() =>
        root.render(
          <MemoryRouter initialEntries={["/desk/expense"]}>
            <TabMemory />
          </MemoryRouter>,
        ),
      );
      act(() => s.scrollTo(260));
      expect(recall("expense")?.scroll).toBe(260);
      act(() => root.unmount());

      // 다른 탭에서 돌아와 도착 — 기억한 스크롤로 복원
      top = 0;
      expectRestore("expense", 260);
      const root2 = createRoot(host);
      act(() =>
        root2.render(
          <MemoryRouter initialEntries={["/desk/expense"]}>
            <TabMemory />
          </MemoryRouter>,
        ),
      );
      act(() => void vi.advanceTimersByTime(40));
      expect(top).toBe(260);
      act(() => root2.unmount());
      host.remove();
    });
  },
);
