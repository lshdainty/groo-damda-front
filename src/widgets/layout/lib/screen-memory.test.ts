import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  MAX_SPOTS,
  enterScreen,
  resetScreenMemory,
  restoreScreen,
  watchScreen,
} from "./screen-memory";

let main: HTMLElement;
let unwatch: () => void;

beforeEach(() => {
  resetScreenMemory();
  main = document.createElement("main");
  main.id = "main";
  document.body.appendChild(main);
  unwatch = watchScreen();
});
afterEach(() => {
  unwatch();
  main.remove();
});

const scrollTo = (y: number) => {
  main.scrollTop = y;
  main.dispatchEvent(new Event("scroll"));
};

describe("화면 기억", () => {
  it("스크롤하거나 누르기 전에는 기억이 없다 — 뒤로 와도 돌려줄 것이 없어 앞으로 갈 때와 같다", () => {
    enterScreen("k1");
    expect(restoreScreen("k1")).toBe(false);
  });

  it("스크롤하면 그 화면의 기억이 생긴다", () => {
    enterScreen("k1");
    scrollTo(120);
    const stop = restoreScreen("k1");
    expect(stop).not.toBe(false);
    if (stop) stop();
  });

  it(`최근 ${MAX_SPOTS} 화면만 기억한다 — 가장 오래된 것부터 버린다`, () => {
    for (let i = 0; i < MAX_SPOTS + 5; i++) {
      enterScreen(`k${i}`);
      scrollTo(i + 1);
    }
    expect(restoreScreen("k0")).toBe(false);
    expect(restoreScreen("k4")).toBe(false);
    const stop = restoreScreen(`k${MAX_SPOTS + 4}`);
    expect(stop).not.toBe(false);
    if (stop) stop();
  });
});
