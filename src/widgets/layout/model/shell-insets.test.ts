// --shell-top 은 상수가 아니라 머리 · 가계부 탭의 실제 높이다 — 큰 글자에서 탭이 44 를 넘어도 아래 줄이 가려지지 않는다(F-2)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MONEY_TABS_ATTR,
  SHELL_HEAD_ATTR,
  applyShellInsets,
  shellInsets,
  shellTop,
} from "./shell-insets";

const html = document.documentElement;
let observed: { cb: () => void; els: Element[] }[] = [];
let header: HTMLElement;
let decoy: HTMLElement;
let tabs: HTMLElement;
let h = 0;
let t = 0;

beforeEach(() => {
  observed = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      rec = { cb: () => {}, els: [] as Element[] };
      constructor(cb: () => void) {
        this.rec.cb = cb;
        observed.push(this.rec);
      }
      observe(el: Element) {
        this.rec.els.push(el);
      }
      disconnect() {
        this.rec.els = [];
      }
    },
  );
  const app = document.createElement("div");
  app.className = "m-app";
  // 셸 머리보다 앞에 다른 header 가 와도 data 속성으로 셸 머리를 잡는다
  decoy = document.createElement("header");
  decoy.getBoundingClientRect = () => ({ height: 999 }) as DOMRect;
  header = document.createElement("header");
  header.setAttribute(SHELL_HEAD_ATTR, "");
  tabs = document.createElement("div");
  tabs.setAttribute(MONEY_TABS_ATTR, "");
  app.append(decoy, header, tabs);
  document.body.appendChild(app);
  header.getBoundingClientRect = () => ({ height: h }) as DOMRect;
  tabs.getBoundingClientRect = () => ({ height: t }) as DOMRect;
});
afterEach(() => {
  document.querySelector(".m-app")?.remove();
  vi.unstubAllGlobals();
});

const apply = (money = true) =>
  applyShellInsets(html, shellInsets({ money, tabBar: true }));
// jsdom 은 calc 를 계산해 `calc(103.5px)` 로 돌려줄 때도 `calc(56px + 47.5px)` 그대로 줄 때도 있다 — 두 꼴 다 받는다
const sums = (v: string, a: number, b: number) =>
  v.includes(`${a + b}px`) || (v.includes(`${a}px`) && v.includes(`${b}px`));
const top = () => html.style.getPropertyValue("--shell-top");

describe("shell-insets 측정", () => {
  it("재지기 전(높이 0)에는 상수 값을 쓴다", () => {
    h = 0;
    t = 0;
    const stop = apply();
    expect(top()).toBe(shellTop(true));
    stop();
  });

  it("재진 높이로 바꾼다 — 가계부 탭이 글자 확대로 47.5 면 --shell-top 은 머리 + 47.5", () => {
    h = 56;
    t = 47.5;
    const stop = apply();
    expect(sums(top(), 56, 47.5)).toBe(true);
    expect(html.style.getPropertyValue("--shell-head")).toBe("56px");
    expect(sums(html.style.scrollPaddingTop, 56, 47.5)).toBe(true);
    stop();
  });

  it("글자 크기가 바뀌어 크기가 달라지면 다시 잰다(ResizeObserver)", () => {
    h = 56;
    t = 44;
    const stop = apply();
    expect(sums(top(), 56, 44)).toBe(true);
    t = 63; // 200%
    observed[0]!.cb();
    expect(sums(top(), 56, 63)).toBe(true);
    expect(observed[0]!.els).toEqual([header, tabs]);
    stop();
  });

  it("가계부 묶음이 아니면(탭 없음) 머리 높이만이다", () => {
    h = 56;
    t = 0;
    tabs.remove();
    const stop = apply(false);
    expect(top()).toBe("56px");
    stop();
  });

  it("떠나면 걷고 관찰도 멈춘다", () => {
    h = 56;
    t = 44;
    const stop = apply();
    stop();
    expect(top()).toBe("");
    expect(html.style.scrollPaddingTop).toBe("");
    expect(observed[0]!.els).toEqual([]);
  });
});
