// 카드 월 실적 줄의 % 는 반올림이다(예전에는 내림 — 33.6% 가 "33%"). 100 경계는 진행률 규칙을 따른다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let rate = 0.336;
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "ko" } }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/features/card-performance", () => ({
  useCardPerformance: () => ({
    isLoading: false,
    isError: false,
    data: {
      isRequired: true,
      requiredAmount: 300000,
      currentAmount: 100800,
      isAchieved: false,
      achievementRate: rate,
    },
  }),
}));
vi.mock("../../lib/asset-groups", () => ({
  useAssetMask: () => (s: string) => s,
}));

const { CardPerfBadge } = await import("./CardPerfBadge");

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

function pctText(r: number) {
  rate = r;
  act(() => root.render(<CardPerfBadge assetRowId={1} />));
  return /· (\d+%)/.exec(container.textContent ?? "")?.[1];
}

describe("CardPerfBadge 퍼센트", () => {
  it("33.6% 는 34% (내림 아님)", () => {
    expect(pctText(0.336)).toBe("34%");
  });
  it("99.6% 는 99%, 100.3% 는 101%", () => {
    expect(pctText(0.996)).toBe("99%");
    expect(pctText(1.003)).toBe("101%");
  });
  it("150% 에서 멈춘다", () => {
    expect(pctText(3)).toBe("150%");
  });
});
