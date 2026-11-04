// 카드 상세 본문 (I-20 E 34) — 혜택 Accordion 의 펼침 상태 · 상세 없는 혜택은 그냥 줄 · 브랜드 줄 · 유의사항 Callout · 연회비 쉼표.
// 대화상자는 포털에 뜨므로 본문 부품을 직접 그린다.
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

const detail = {
  summary: {
    rowId: 1,
    externalCardId: 1,
    company: null,
    cardName: "예시 카드",
    cardType: "CREDIT",
    benefitType: "DISCOUNT",
    isDiscontinued: "N",
    onlyOnline: "N",
    launchDate: null,
    imgUrl: null,
    detailUrl: null,
    annualFee: { amount: 0, label: "국내 5000원" },
    performance: { isRequired: "N", requiredText: null },
  },
  brands: ["가나", "다라"],
  benefits: [
    {
      rowId: 11,
      category: "커피",
      categoryIcon: null,
      title: "커피 할인",
      summary: "10% 할인",
      detail: "전국 커피 전문점에서 10% 를 깎아 줘요",
      sortOrder: 1,
    },
    {
      rowId: 12,
      category: "교통",
      categoryIcon: null,
      title: "교통 적립",
      summary: "5% 적립",
      detail: null,
      sortOrder: 2,
    },
  ],
  cautions: [
    {
      rowId: 91,
      category: "유의",
      categoryIcon: null,
      title: null,
      summary: null,
      detail: "연회비는 첫해에 청구돼요",
      sortOrder: 1,
    },
  ],
  topBenefits: [],
  searchBenefits: [],
};
vi.mock("@/features/card-catalog", () => ({
  useCardCatalogDetail: () => ({
    data: detail,
    isLoading: false,
    isError: false,
    refetch: () => {},
  }),
}));

const { CardDetailContent } = await import("./CardDetailContent");

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

const benefitButtons = () => [
  ...container.querySelectorAll<HTMLButtonElement>("button[aria-expanded]"),
];

describe("CardDetailContent", () => {
  const render = () => act(() => root.render(<CardDetailContent rowId={1} />));

  it("상세가 있는 혜택만 단추다 — aria-expanded · aria-controls, 접힘 → 펼침 → 접힘", () => {
    render();
    const [coffee] = benefitButtons();
    // 둘째 혜택은 상세가 없어 단추가 아닌 그냥 줄이다
    expect(benefitButtons()).toHaveLength(1);
    expect(coffee!.getAttribute("aria-expanded")).toBe("false");
    const controls = coffee!.getAttribute("aria-controls")!;
    expect(controls).toBeTruthy();
    expect(
      (container.querySelector(`[id="${controls}"]`) as HTMLElement).hidden,
    ).toBe(true);

    act(() => coffee!.click());
    expect(coffee!.getAttribute("aria-expanded")).toBe("true");
    // 펼침 상태는 aria-expanded 로 읽는다 — 내용은 접혀도 DOM 에 있다(hidden)
    expect(
      (container.querySelector(`[id="${controls}"]`) as HTMLElement).hidden,
    ).toBe(false);

    act(() => coffee!.click());
    expect(coffee!.getAttribute("aria-expanded")).toBe("false");
    expect(
      (container.querySelector(`[id="${controls}"]`) as HTMLElement).hidden,
    ).toBe(true);
  });

  it("연회비 라벨의 네 자리 숫자에 쉼표를 붙이고, 브랜드 · 유의사항을 그린다", () => {
    render();
    const text = container.textContent ?? "";
    expect(text).toContain("국내 5,000원");
    expect(text).not.toContain("국내 5000원");
    expect(text).toContain("가나 · 다라");
    expect(text).toContain("benefit.cautions");
    expect(text).toContain("연회비는 첫해에 청구돼요");
  });

  it("대화상자 째 그려도 바닥 닫기 버튼 · 서버 원문이 없다 — 닫기 원 하나", async () => {
    const { CardBenefitDetailDialog } =
      await import("./CardBenefitDetailDialog");
    act(() =>
      root.render(<CardBenefitDetailDialog rowId={1} onClose={() => {}} />),
    );
    const dialog = document.body.querySelector("[role=dialog]");
    expect(dialog).not.toBeNull();
    expect(dialog!.querySelector("[data-slot=dialog-footer]")).toBeNull();
    expect(dialog!.querySelector("[data-slot=bottom-sheet-footer]")).toBeNull();
    expect(dialog!.textContent).toContain("benefit.detailTitle");
    expect(dialog!.textContent).not.toContain("benefit.close");
  });
});
