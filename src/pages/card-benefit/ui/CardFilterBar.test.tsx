// 카드 거르기 칩 줄 (I-20 E 31) — 칩 둘 · 걸린 조건은 값으로 · 걸리면 맨 앞 지우기 · "캐시백" 칩 없음.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "ko" } }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const { CardFilterBar } = await import("./CardFilterBar");

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
});

const chips = () => [...container.querySelectorAll("button")];

describe("CardFilterBar", () => {
  it("아무 조건도 없으면 칩 둘뿐이고 지우기는 없다", () => {
    act(() =>
      root.render(
        <CardFilterBar
          type="all"
          benefit="all"
          onType={() => {}}
          onBenefit={() => {}}
          wide={false}
        />,
      ),
    );
    expect(chips().map((b) => b.textContent)).toEqual([
      "benefit.typeChip",
      "benefit.benefitChip",
    ]);
  });

  it("조건이 걸리면 칩이 값으로 바뀌고 맨 앞 ↺ 가 두 조건을 모두 지운다", () => {
    const onType = vi.fn();
    const onBenefit = vi.fn();
    act(() =>
      root.render(
        <CardFilterBar
          type="CREDIT"
          benefit="POINT"
          onType={onType}
          onBenefit={onBenefit}
          wide
        />,
      ),
    );
    const all = chips();
    expect(all[0]!.getAttribute("aria-label")).toBe("benefit.filterClear");
    expect(all.slice(1).map((b) => b.textContent)).toEqual([
      "cardTypeShort.credit",
      "benefitType.point",
    ]);
    act(() => all[0]!.click());
    expect(onType).toHaveBeenCalledWith("all");
    expect(onBenefit).toHaveBeenCalledWith("all");
  });
});
