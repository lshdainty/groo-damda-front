// 홈 "이번 달" 안내 — 조각 이어 붙이기가 아니라 문장 둘(하루 평균 · 전월 대비), 전월 대비는 세 갈래(줄었음 · 늘었음 · 같음).
// QA 2026-11-19(앱 3032 · 웹 같은 짜임): 영어 "Daily average ₩2,106 spent., vs last month 0.00% the same." —
// 마침표 뒤 쉼표 · 어순 · 같음에 0.00% 가 붙었다. 번역 mock 이 아니라 실제 문구(CSV → generate)로 읽는다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { i18n } from "@/shared/i18n/config";
import { setHiddenCardsLocal } from "@/shared/lib/groo/hide-amounts-core";
import { MonthNote } from "./home-parts";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  act(() => setHiddenCardsLocal([]));
});
afterAll(async () => {
  await i18n.changeLanguage("ko");
});

const render = (prevExpense: number, savingsPct: number) =>
  act(() =>
    root.render(
      <MonthNote
        dailyAvg={2106}
        prevExpense={prevExpense}
        savingsPct={savingsPct}
      />,
    ),
  );
const text = () => container.querySelector("p")!.textContent;
/** 굵게(700 · fg-neutral) 그린 글 — 금액 · % 만 */
const bold = () =>
  Array.from(container.querySelectorAll("p b")).map((b) => {
    expect(b.className).toContain("font-bold");
    expect(b.className).toContain("text-fg-neutral");
    return b.textContent;
  });

const CASES = [
  {
    lng: "ko",
    name: "줄었음",
    pct: 12.3,
    text: "하루 평균 2,106원 썼어요. 전월 대비 12.30% 절약 중이에요.",
    bold: ["2,106원", "12.30%"],
  },
  {
    lng: "ko",
    name: "늘었음",
    pct: -12.3,
    text: "하루 평균 2,106원 썼어요. 전월 대비 12.30% 더 썼어요.",
    bold: ["2,106원", "12.30%"],
  },
  {
    lng: "ko",
    name: "같음 — % 없음",
    pct: 0,
    text: "하루 평균 2,106원 썼어요. 전월과 같아요.",
    bold: ["2,106원"],
  },
  {
    lng: "en",
    name: "줄었음",
    pct: 12.3,
    text: "You spent ₩2,106 a day on average. You spent 12.30% less than last month.",
    bold: ["₩2,106", "12.30%"],
  },
  {
    lng: "en",
    name: "늘었음",
    pct: -12.3,
    text: "You spent ₩2,106 a day on average. You spent 12.30% more than last month.",
    bold: ["₩2,106", "12.30%"],
  },
  {
    lng: "en",
    name: "같음 — % 없음",
    pct: 0,
    text: "You spent ₩2,106 a day on average. You spent the same as last month.",
    bold: ["₩2,106"],
  },
];

describe("홈 하루 평균 · 전월 대비 — 문장 둘 · 세 갈래", () => {
  for (const c of CASES) {
    it(`${c.lng} ${c.name} — "${c.text}"`, async () => {
      await i18n.changeLanguage(c.lng);
      render(1_000_000, c.pct);
      expect(text()).toBe(c.text);
      expect(bold()).toEqual(c.bold);
    });
  }

  it("둘째 자리까지 반올림해 0 이면 같음 — '0.00% 더 썼어요' 가 아니다", async () => {
    await i18n.changeLanguage("en");
    render(1_000_000, -0.004);
    expect(text()).toBe(
      "You spent ₩2,106 a day on average. You spent the same as last month.",
    );
  });

  it("지난달 지출이 0 이면 전월 대비 문장이 없다", async () => {
    await i18n.changeLanguage("ko");
    render(0, 0);
    expect(text()).toBe("하루 평균 2,106원 썼어요.");
  });

  it("금액을 가리면 금액만 점으로 — 문장 · % 는 그대로", async () => {
    await i18n.changeLanguage("ko");
    act(() => setHiddenCardsLocal(["home.monthExpense"]));
    render(1_000_000, 12.3);
    expect(text()).toBe(
      "하루 평균 •••• 썼어요. 전월 대비 12.30% 절약 중이에요.",
    );
    expect(bold()).toEqual(["••••", "12.30%"]);
  });
});
