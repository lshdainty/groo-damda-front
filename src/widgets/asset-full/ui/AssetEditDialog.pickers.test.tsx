// 고르기 시트 — 기관 · 카드 상품 · 종목(I-17 18 ~ 20).
//
// 폼 안 스크롤 상자(칩 격자 · 카드 목록 · 검색 결과 상자)를 걷고, 칸(Input Button)이 1280 미만에서는 시트, 이상에서는 팝오버를 연다.
// 고르면 닫히고 값이 칸에 들어간다. 시트 안은 검색칸(초점) + 분류 머리 + 줄(오른쪽 라디오)이다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetPointerBlockForTest } from "@/shared/lib/groo/pointer-block";
import type { Asset } from "@/entities/asset";
import {
  bodyText,
  click,
  fieldControl,
  installDomStubs,
  setInput,
} from "./asset-form/test-helpers";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const state = vi.hoisted(() => ({
  catalogCalls: [] as Record<string, unknown>[],
  stockCalls: [] as string[],
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      o && Object.keys(o).length
        ? `${k}|${Object.entries(o)
            .map(([n, v]) => `${n}=${String(v)}`)
            .join(",")}`
        : k,
    i18n: { language: "ko" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/features/asset", () => ({
  useAssets: () => ({ data: { assets: [] }, isLoading: false }),
}));
vi.mock("@/features/card-catalog", () => ({
  useCardCatalogs: (p: Record<string, unknown>) => {
    state.catalogCalls.push(p);
    return {
      data: {
        content: [
          {
            rowId: 11,
            externalCardId: 1,
            company: { rowId: 1, name: "현대카드", nameEng: "", logoUrl: null },
            cardName: "현대 ZERO",
            cardType: "CREDIT",
            benefitType: "DISCOUNT",
            isDiscontinued: "Y",
            onlyOnline: "N",
            launchDate: null,
            imgUrl: null,
            detailUrl: null,
            annualFee: { amount: 0, label: null },
            performance: {
              requiredAmount: 0,
              requiredText: null,
              isRequired: "N",
            },
          },
        ],
      },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: () => Promise.resolve(),
    };
  },
}));
vi.mock("@/features/stock/model/useStockMaster", () => ({
  useStockSearch: (q: string) => {
    state.stockCalls.push(q);
    if (q === "실패")
      return {
        data: [],
        isFetching: false,
        isError: true,
        refetch: () => Promise.resolve(),
      };
    return {
      data:
        q && q !== "없는종목"
          ? [{ symbol: "A005930", marketCode: "KRX", nameKr: "가나다 전자" }]
          : [],
      isFetching: false,
    };
  },
  useStockSymbolName: () => ({ data: undefined }),
}));
vi.mock("@/features/stock/model/useLivePrices", () => ({
  useLivePrices: () => ({
    quoteOf: () => undefined,
    unitKrw: () => null,
    prevUnitKrw: () => null,
    currencyOf: () => undefined,
  }),
}));
vi.mock("@/features/subscription/model/useSubscription", () => ({
  useMyFeatures: () => ({ data: undefined }),
}));
vi.mock("@/features/user", () => ({
  useDefaultCurrencyState: () => ({
    currency: "KRW",
    ready: true,
    ensure: async () => true,
  }),
}));

const { AssetEditDialog } = await import("./AssetEditDialog");

const invest: Asset = {
  userRowId: 1,
  rowId: 5,
  assetName: "연금저축",
  assetType: "INVESTMENT",
  balance: 0,
  cashBalance: 0,
  holdingBalance: 0,
  currency: "KRW",
  exchangeRate: 1,
  color: null,
  institution: "삼성증권",
  memo: null,
  sortOrder: 0,
  isIncludedInTotal: "Y",
  isAmountHidden: "N",
  cardCatalog: null,
  createAt: "2026-01-01T00:00:00",
  modifyAt: "2026-01-01T00:00:00",
};

let container: HTMLDivElement;
let root: Root;
let created: Record<string, unknown> | null = null;
let updated: Record<string, unknown> | null = null;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  __resetPointerBlockForTest();
  state.catalogCalls = [];
  state.stockCalls = [];
  created = null;
  updated = null;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function open(
  item: Asset | null,
  kind?: Parameters<typeof AssetEditDialog>[0]["kind"],
  wide = false,
) {
  installDomStubs({ wide });
  act(() =>
    root.render(
      <AssetEditDialog
        item={item}
        kind={kind}
        onClose={() => {}}
        onCreate={(v) => {
          created = v as unknown as Record<string, unknown>;
        }}
        onUpdate={(v) => {
          updated = v as unknown as Record<string, unknown>;
        }}
      />,
    ),
  );
}

/** 가장 위에 뜬 시트의 제목 — 폼 시트 위에 고르기 시트가 겹쳐 뜬다 */
const topTitle = () =>
  [...document.querySelectorAll("[data-slot=bottom-sheet-title]")].pop()
    ?.textContent;
/** Input Button 은 누르는 층과 값 층이 따로라 값은 상자(부모)에서 읽는다 */
const shown = (labelKey: string) =>
  fieldControl(labelKey)?.parentElement?.textContent ?? "";
const options = () => [...document.body.querySelectorAll("[role='option']")];
const option = (text: string) =>
  options().find((o) => (o.textContent ?? "").includes(text));

describe("기관 고르기", () => {
  it("칸을 누르면 고르기 시트가 열리고 검색칸에 초점이 간다 — 칩 격자 상자는 없다", () => {
    open(null, "입출금");
    click(fieldControl("editDialog.institutionBrand"));
    expect(topTitle()).toBe("editDialog.pickInstitutionTitle");
    expect(
      document.querySelector("[role=combobox][aria-autocomplete]"),
    ).not.toBeNull();
    expect(options().length).toBeGreaterThan(10);
    // 폼 안 스크롤 상자 0
    expect(document.querySelector("[style*='max-height']")).toBeNull();
  });

  it("'kx 은행' 처럼 공백 · 대소문자를 무시하고 찾는다", () => {
    open(null, "입출금");
    click(fieldControl("editDialog.institutionBrand"));
    const search = document.querySelector<HTMLInputElement>(
      "[role=combobox][aria-autocomplete]",
    )!;
    setInput(search, "케이 뱅크");
    expect(option("케이뱅크")).toBeDefined();
    setInput(search, "kb");
    expect(option("국민")).toBeDefined(); // 별칭(KB)으로도 찾는다
    setInput(search, "없는기관이름");
    expect(options().length).toBe(0);
    expect(bodyText()).toContain("없는기관이름");
  });

  it("고르면 시트가 닫히고 값이 칸에 들어가 저장 본문에 실린다", () => {
    open(null, "입출금");
    click(fieldControl("editDialog.institutionBrand"));
    const first = options()[1]!;
    const name = first.querySelector(
      "[data-slot=searchable-list-item-title]",
    )!.textContent!;
    click(first);
    expect(
      document.querySelector("[data-slot=bottom-sheet-title]")?.textContent,
    ).not.toBe("editDialog.pickInstitutionTitle");
    expect(shown("editDialog.institutionBrand")).toContain(name);
    setInput(fieldControl("editDialog.nameLabel")!, "새 통장");
    click(
      [...document.body.querySelectorAll("button")].find(
        (b) => b.textContent?.trim() === "addAction",
      ),
    );
    expect(created!.institution).toBe(name);
  });

  it("1280 이상에서는 같은 자리 팝오버다", () => {
    open(null, "입출금", true);
    click(fieldControl("editDialog.institutionBrand"));
    expect(
      document.querySelector("[data-slot=popover-content]"),
    ).not.toBeNull();
    expect(document.querySelector("[data-slot=bottom-sheet-title]")).toBeNull();
  });

  it("투자는 증권사 고르기 — 증권 분류만 나온다", () => {
    open(null, "투자");
    click(fieldControl("editDialog.brokerExchange"));
    expect(topTitle()).toBe("editDialog.pickBrokerTitle");
    expect(bodyText()).toContain("editDialog.category.brokerage");
    expect(bodyText()).not.toContain("editDialog.category.commercialBank");
  });
});

describe("카드 상품 고르기", () => {
  it("고르기 시트에 단종 스위치 · 단종 배지가 있고 고르면 칸에 이름이 들어간다", () => {
    open(null, "신용카드");
    click(fieldControl("editDialog.cardProduct"));
    expect(bodyText()).toContain("editDialog.includeDiscontinued");
    const row = option("현대 ZERO")!;
    expect(row.textContent).toContain("editDialog.discontinued");
    expect(row.textContent).toContain("editDialog.annualFeeFree");
    click(row);
    expect(shown("editDialog.cardProduct")).toContain("현대 ZERO");
  });

  it("목록 요청은 고르기 시트를 열 때 시작하고 종류(신용)로 거른다", () => {
    open(null, "신용카드");
    expect(state.catalogCalls.length).toBe(0);
    click(fieldControl("editDialog.cardProduct"));
    expect(state.catalogCalls[state.catalogCalls.length - 1]).toMatchObject({
      cardType: "CREDIT",
      page: 0,
    });
  });
});

describe("종목 추가", () => {
  it("버튼 → 검색 시트 → 줄을 누르면 보유 줄이 하나 늘고 시트가 닫힌다", async () => {
    open(invest);
    const addBtn = [...document.body.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === "holdings.addStock",
    );
    click(addBtn);
    expect(topTitle()).toBe("holdings.addStockTitle");
    // 검색어가 없으면 줄이 없다 — 치면 서버 검색(300ms 뒤) 결과가 뜬다
    expect(options().length).toBe(0);
    const search = document.querySelector<HTMLInputElement>(
      "[role=combobox][aria-autocomplete]",
    )!;
    setInput(search, "가나");
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });
    const found = option("가나다 전자")!;
    expect(found).toBeDefined();
    click(found);
    expect(document.querySelectorAll("[data-slot=holding-row]").length).toBe(1);
    click(
      [...document.body.querySelectorAll("button")].find(
        (b) => b.textContent?.trim() === "save",
      ),
    );
    expect(updated).not.toBeNull();
  });
});

describe("고르기 시트의 찾기 · 스위치 · 0건", () => {
  const searchInput = () =>
    document.querySelector<HTMLInputElement>(
      "[role=combobox][aria-autocomplete]",
    )!;
  const tick = (ms: number) =>
    act(async () => {
      await new Promise((r) => setTimeout(r, ms));
    });

  it("카드 상품 서버 요청은 마지막 입력 뒤 300ms 에 한 번 — 글자마다 안 나간다", async () => {
    open(null, "신용카드");
    click(fieldControl("editDialog.cardProduct"));
    const keywords = () =>
      new Set(state.catalogCalls.map((c) => c.keyword ?? ""));
    setInput(searchInput(), "숲");
    setInput(searchInput(), "숲길");
    await tick(100);
    expect(keywords().has("숲길")).toBe(false);
    await tick(350);
    expect(keywords().has("숲길")).toBe(true);
    // 중간 글자("숲")로는 요청이 안 나갔다
    expect(keywords().has("숲")).toBe(false);
  });

  it("단종 스위치 줄은 검색칸 바로 아래에 고정 — 흐림 스크롤 밖", () => {
    open(null, "신용카드");
    click(fieldControl("editDialog.cardProduct"));
    const sw = document.querySelector("[role=switch]")!;
    expect(sw.closest("[data-slot=scroll-fog]")).toBeNull();
    const search = searchInput().closest("[data-slot=searchable-list-field]")!;
    expect(
      search.compareDocumentPosition(sw) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("단종 스위치를 켜면 목록 요청이 바로 바뀐다", () => {
    open(null, "신용카드");
    click(fieldControl("editDialog.cardProduct"));
    expect(
      state.catalogCalls[state.catalogCalls.length - 1]?.includeDiscontinued,
    ).toBeUndefined();
    click(document.querySelector("[role=switch]") as HTMLElement | null);
    expect(
      state.catalogCalls[state.catalogCalls.length - 1]?.includeDiscontinued,
    ).toBe(true);
  });

  it("종목 0건이면 결과 없음 안내가 먼저, 직접 추가 줄은 그 아래 맨 끝이다", async () => {
    open(invest);
    click(
      [...document.body.querySelectorAll("button")].find(
        (b) => b.textContent?.trim() === "holdings.addStock",
      ),
    );
    setInput(searchInput(), "없는종목");
    await tick(400);
    const empty = document.querySelector("[data-slot=searchable-list-empty]");
    const manual = option("holdings.addManual");
    expect(empty).not.toBeNull();
    expect(manual).toBeDefined();
    expect(
      empty!.compareDocumentPosition(manual!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // 누르면 바로 더하는 목록 — 줄에 라디오가 없다(selectionMark off, 17-1b Q4 = B)
    expect(
      manual!.querySelector("[data-slot=searchable-list-item-radio]"),
    ).toBeNull();
  });

  it("종목 검색이 실패하면 0건 안내가 아니라 실패 안내 + 다시 시도, 직접 추가 줄은 맨 아래", async () => {
    open(invest);
    click(
      [...document.body.querySelectorAll("button")].find(
        (b) => b.textContent?.trim() === "holdings.addStock",
      ),
    );
    setInput(searchInput(), "실패");
    await tick(400);
    expect(
      document.querySelector("[data-slot=searchable-list-error]"),
    ).not.toBeNull();
    expect(
      document.querySelector("[data-slot=searchable-list-empty]"),
    ).toBeNull();
    expect(option("holdings.addManual")).toBeDefined();
  });

  it("끝 흐림은 결과 목록에만 — 검색칸은 흐림 밖(위로 줄이 비치지 않는다)", () => {
    open(null, "입출금");
    click(fieldControl("editDialog.institutionBrand"));
    const fog = document.querySelector("[data-slot=scroll-fog]")!;
    expect(fog).not.toBeNull();
    expect(fog.querySelector("[data-slot=searchable-list-field]")).toBeNull();
    expect(fog.querySelector("[role=listbox]")).not.toBeNull();
    // 고르기 시트에는 본문 틀(스크롤 + 흐림 전체)이 없다
    const pick = [
      ...document.querySelectorAll("[data-slot=bottom-sheet-content]"),
    ].pop()!;
    expect(pick.querySelector("[data-slot=bottom-sheet-body]")).toBeNull();
  });
});
