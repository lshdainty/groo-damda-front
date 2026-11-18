// 영어 돈 — groo-design #250(chart.md "축 · 격자" · International Design "돈"). 요일은 date-picker-weekday.test.tsx.
//   축: 영어는 천 단위 — 가장 큰 절댓값이 1B 이상 B, 1M 이상 M, 1K 이상 K, 아니면 쉼표 정수. 한 축 한 단위(1,000M 이 아니라 1B).
//       예전엔 값마다 compact 로 줄여 한 축에 "500 · 1K" 가 섞였다
//   줄이지 않는 돈(툴팁 · 지표 타일): 영어 "₩1,240,000", 한국어 "1,240,000원"
import { act } from "react";
import { createRoot } from "react-dom/client";
import i18next from "i18next";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import enDs from "@/locales/en/ds.json";
import koDs from "@/locales/ko/ds.json";
import { won } from "@/shared/lib/groo/money-text";

import { ChartTooltipContent } from "./chart";
import { formatAxisWon, formatWon } from "./chart-variants";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

beforeAll(async () => {
  await i18next.init({
    lng: "en",
    fallbackLng: "ko",
    ns: ["ds"],
    defaultNS: "ds",
    keySeparator: false,
    interpolation: { escapeValue: false },
    resources: { en: { ds: enDs }, ko: { ds: koDs } },
  });
});
afterAll(async () => {
  await i18next.changeLanguage("ko");
});

/** 한 축의 눈금 글자 — 눈금 목록을 함께 넘긴다 */
const axis = (ticks: number[]) => ticks.map((v) => formatAxisWon(v, ticks));

describe("영어 축 — 천 단위 K · M · B, 한 축 한 단위", () => {
  it("단위 경계 — 999 · 1K · 999K · 1M · 1B", () => {
    expect(formatAxisWon(999, [0, 999])).toBe("999");
    expect(formatAxisWon(1_000, [0, 1_000])).toBe("1K");
    expect(formatAxisWon(999_000, [0, 999_000])).toBe("999K");
    expect(formatAxisWon(1_000_000, [0, 1_000_000])).toBe("1M");
    // 1,000M 이 아니라 1B
    expect(formatAxisWon(1_000_000_000, [0, 1_000_000_000])).toBe("1B");
  });

  it("가장 큰 절댓값으로 단위를 하나 고른다 — 0.5K · 1K · 500K · 1M · 1.5B, 아래는 쉼표 정수", () => {
    expect(axis([0, 500, 1_000, 1_500])).toEqual(["0", "0.5K", "1K", "1.5K"]);
    expect(axis([0, 500_000, 1_000_000])).toEqual(["0", "0.5M", "1M"]);
    expect(axis([0, 200_000, 400_000, 600_000])).toEqual([
      "0",
      "200K",
      "400K",
      "600K",
    ]);
    expect(axis([0, 500_000_000, 1_000_000_000, 1_500_000_000])).toEqual([
      "0",
      "0.5B",
      "1B",
      "1.5B",
    ]);
    expect(axis([0, 200, 400, 600, 800])).toEqual([
      "0",
      "200",
      "400",
      "600",
      "800",
    ]);
  });

  it("음수 쪽도 본다 · 빼기는 U+2212", () => {
    expect(axis([-2_000_000, -1_000_000, 0, 1_000_000])).toEqual([
      "−2M",
      "−1M",
      "0",
      "1M",
    ]);
  });
});

describe("줄이지 않는 돈 — 영어 ₩1,240,000", () => {
  it("formatWon · won(지표 타일 합계)", () => {
    expect(formatWon(1_240_000)).toBe("₩1,240,000");
    expect(formatWon(-1_240_000)).toBe("−₩1,240,000");
    expect(won(1_240_000)).toBe("₩1,240,000");
  });

  it("툴팁 줄의 값 — 기본 글이 ₩ 를 앞에 쓴다", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    act(() =>
      root.render(
        <ChartTooltipContent
          active
          label="Nov 8"
          payload={[
            {
              dataKey: "expense",
              name: "Expense",
              value: 1_240_000,
              color: "red",
              payload: {},
            },
          ]}
        />,
      ),
    );
    expect(container.textContent).toContain("₩1,240,000");
    expect(container.textContent).not.toContain("원");
    act(() => root.unmount());
    container.remove();
  });
});
