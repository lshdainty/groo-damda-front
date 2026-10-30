import { describe, expect, it } from "vitest";
import type { TFunction } from "i18next";
import type { CardCatalogSummary } from "@/entities/card";
import {
  BENEFIT_FILTER_KEYS,
  DESKTOP_PAGE_SIZE,
  annualFeeRowText,
  commaDigits,
  performanceRowText,
} from "./card-format";

const t = ((k: string, o?: Record<string, unknown>) =>
  o ? `${k}:${JSON.stringify(o)}` : k) as unknown as TFunction;

const card = (over: Partial<CardCatalogSummary>) =>
  ({
    annualFee: null,
    performance: { isRequired: "N", requiredAmount: 0, requiredText: null },
    ...over,
  }) as CardCatalogSummary;

describe("card-format (I-20 E 31 · 32 · 34)", () => {
  it("네 자리 이상 숫자에만 쉼표를 붙인다", () => {
    expect(commaDigits("국내 5000원")).toBe("국내 5,000원");
    expect(commaDigits("해외 12000원 · 100원")).toBe("해외 12,000원 · 100원");
  });

  it("연회비 글 — 모름 · 금액 · 라벨 · 없음 네 갈래", () => {
    expect(annualFeeRowText(card({ annualFee: null }), t)).toBe(
      "benefit.annualFeeUnknown",
    );
    expect(
      annualFeeRowText(card({ annualFee: { amount: 15000, label: null } }), t),
    ).toContain('"15,000"');
    expect(
      annualFeeRowText(card({ annualFee: { amount: 0, label: "5000원" } }), t),
    ).toContain('"5,000원"');
    expect(
      annualFeeRowText(card({ annualFee: { amount: 0, label: null } }), t),
    ).toBe("benefit.annualFeeNone");
  });

  it("실적 글 — 금액 · 없음", () => {
    expect(
      performanceRowText(
        card({
          performance: {
            isRequired: "Y",
            requiredAmount: 300000,
            requiredText: null,
          },
        }),
        t,
      ),
    ).toContain('"300,000"');
    expect(performanceRowText(card({}), t)).toBe("benefit.performanceNone");
  });

  it("혜택 거르기 값은 서버 셋뿐이고 POINT 는 한 번이다(캐시백 칩 없음)", () => {
    expect(BENEFIT_FILTER_KEYS).toEqual([
      "all",
      "DISCOUNT",
      "POINT",
      "MILEAGE",
    ]);
  });

  it("데스크톱 쪽당 20장", () => {
    expect(DESKTOP_PAGE_SIZE).toBe(20);
  });
});
