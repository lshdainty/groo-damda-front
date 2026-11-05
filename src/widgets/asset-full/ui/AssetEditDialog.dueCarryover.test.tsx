// 신용카드 결제 대기 청구분 칸(2026-09-22 사용자 결정).
//
// 결제일 전에 카드를 등록하면 실제 카드사는 지난달 청구분을 다가오는 결제일에, 이번 달 쓴
// 금액을 그다음 결제일에 뺀다. "이전 미결제 사용액" 한 칸이면 전부 다음 달에 빠져 한 달 동안
// 통장 잔액이 실제보다 많았다. 그래서 두 칸으로 받는다.
//   (1) 새 카드: 오늘이 이번 달 결제일 전이면 "9월 12일에 결제될 금액" 칸이 열리고, 원래 칸은
//       "그 뒤 쓴 금액" 이 된다(설명에 그다음 결제일). 결제일 당일부터는 칸 하나(종전 그대로)
//   (2) 새 카드 저장: 청구분은 `dueCarryoverAmount`, 그 뒤 쓴 금액은 `balance`(음수)
//   (3) 기존 카드: 서버가 칸을 줄 때만(`dueCarryover`) — 열려 있으면 고쳐서(0 포함) 싣고,
//       잠겼으면 칸이 잠기고 키째 뺀다
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetPointerBlockForTest } from "@/shared/lib/groo/pointer-block";
import type { Asset } from "@/entities/asset";
import type { CardCatalogSummary } from "@/entities/card";
import { formatDay } from "@/shared/lib/groo/format";
import {
  bodyText,
  buttons,
  chooseSelect,
  click,
  fieldControl,
  installDomStubs,
  setInput,
} from "./asset-form/test-helpers";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => {
      const vals = Object.entries(o ?? {}).filter(
        ([name]) => name !== "defaultValue",
      );
      return vals.length === 0
        ? k
        : `${k}|${vals.map(([name, v]) => `${name}=${String(v)}`).join(",")}`;
    },
    i18n: { language: "ko" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/features/asset", () => ({
  useAssets: () => ({ data: { assets: [] }, isLoading: false }),
}));
const zero: CardCatalogSummary = {
  rowId: 11,
  externalCardId: 1,
  company: { rowId: 1, name: "현대카드", nameEng: "Hyundai", logoUrl: null },
  cardName: "현대 ZERO",
  cardType: "CREDIT",
  benefitType: "DISCOUNT",
  isDiscontinued: "N",
  onlyOnline: "N",
  launchDate: null,
  imgUrl: null,
  detailUrl: null,
  annualFee: null,
  performance: { requiredAmount: 0, requiredText: null, isRequired: "N" },
};
vi.mock("@/features/card-catalog", () => ({
  useCardCatalogs: () => ({
    data: { content: [zero], totalElements: 1, last: true },
    isFetching: false,
  }),
}));
vi.mock("@/features/stock/model/useStockMaster", () => ({
  useStockSearch: () => ({ data: [], isFetching: false }),
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

/** 화면과 같은 표기 — 테스트 환경의 로케일을 따른다(날짜 `Sep 14` 꼴). */
const md = (key: string) => formatDay(key).md;

/** 결제일 14일 신용카드 — 9/10 에 등록, 8월 회차가 9/14 결제를 기다린다. */
const card: Asset = {
  userRowId: 1,
  rowId: 7,
  assetName: "현대 ZERO",
  assetType: "CREDIT_CARD",
  balance: -40_000,
  cashBalance: 0,
  holdingBalance: 0,
  currency: "KRW",
  exchangeRate: 1,
  color: null,
  institution: "현대카드",
  memo: null,
  sortOrder: 0,
  isIncludedInTotal: "Y",
  isAmountHidden: "N",
  cardCatalog: null,
  creditLimit: 5_000_000,
  paymentDay: 14,
  paymentAssetRowId: 3,
  carryoverAmount: 10_000,
  carryoverLocked: false,
  cardClosedThrough: "2026-07-31",
  dueCarryover: { amount: 30_000, locked: false, paymentDate: "2026-09-14" },
  createAt: "2026-09-10T01:00:00",
  modifyAt: "2026-09-10T01:00:00",
};

let container: HTMLDivElement;
let root: Root;
let created: Record<string, unknown> | null = null;
let updated: Record<string, unknown> | null = null;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  __resetPointerBlockForTest();
  created = null;
  updated = null;
  // 오늘은 2026-09-10 — Date 만 멈춘다(Radix 타이머는 그대로 돈다).
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 10, 12, 0));
  installDomStubs();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

function open(item: Asset | null) {
  act(() =>
    root.render(
      <AssetEditDialog
        item={item}
        kind={item ? undefined : "신용카드"}
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

/** 그 이름의 마지막 버튼 — 확인창이 뜨면 저장이 나중에 붙는다. */
const lastButton = (text: string) => {
  const all = buttons(text);
  return all[all.length - 1]!;
};
const dueInput = () => fieldControl("editDialog.dueCarryoverLabel");
const afterInput = () =>
  (fieldControl("editDialog.carryoverAfterLabel") ??
    fieldControl("editDialog.balanceLabelCard"))!;

const pickPaymentDay = (day: number) =>
  chooseSelect("editDialog.paymentDay", `editDialog.dayUnit|day=${day}`);

/** 새 신용카드 — 카탈로그에서 카드를 고르고 결제일을 정한다. */
function newCard(paymentDay: number) {
  open(null);
  // 카드 상품 칸 → 고르기 시트(검색 줄) → 카드 줄을 누르면 닫히며 값이 들어간다(I-17 19)
  click(fieldControl("editDialog.cardProduct"));
  const pick = [...document.body.querySelectorAll("[role='option']")].find(
    (el) => el.textContent?.includes("현대 ZERO"),
  );
  if (!pick) throw new Error("카탈로그 카드를 찾지 못했다");
  click(pick);
  pickPaymentDay(paymentDay);
}

describe("새 카드 — 결제일 전이면 칸이 둘이다", () => {
  it("9/10 · 결제일 12일: '9월 12일에 결제될 금액' 칸이 열리고 원래 칸은 '그 뒤 쓴 금액'(10월 12일 결제)", () => {
    newCard(12);

    expect(dueInput()).not.toBeNull();
    expect(bodyText()).toContain(
      `editDialog.dueCarryoverLabel|date=${md("2026-09-12")}`,
    );
    expect(bodyText()).toContain("editDialog.carryoverAfterLabel");
    expect(bodyText()).toContain(
      `editDialog.carryoverAfterHelp|date=${md("2026-10-12")}`,
    );
    expect(bodyText()).not.toContain("editDialog.balanceLabelCard");
  });

  it("결제일 당일(10일)·지난 날(5일)이면 칸 하나 — 기다리는 청구분이 없다", () => {
    for (const day of [10, 5]) {
      newCard(day);
      expect(dueInput(), `결제일 ${day}`).toBeNull();
      expect(bodyText()).toContain("editDialog.balanceLabelCard");
      act(() => root.unmount());
      root = createRoot(container);
    }
  });

  it("저장하면 청구분은 dueCarryoverAmount, 그 뒤 쓴 금액은 balance(음수)로 나간다", () => {
    newCard(12);
    setInput(dueInput()!, "30000");
    setInput(afterInput(), "10000");
    click(lastButton("addAction"));

    expect(created).not.toBeNull();
    expect(created!.dueCarryoverAmount).toBe(30_000);
    expect(created!.balance).toBe(-10_000);
    expect(created!.paymentDay).toBe(12);
  });

  it("청구분 0 이면 키를 싣지 않는다", () => {
    newCard(12);
    setInput(afterInput(), "10000");
    click(lastButton("addAction"));

    expect(created).not.toBeNull();
    expect("dueCarryoverAmount" in created!).toBe(false);
  });
});

describe("기존 카드 — 서버가 칸을 줄 때만", () => {
  it("열려 있으면 청구분으로 열리고, 고쳐 저장하면 싣는다(0 이면 지운다)", () => {
    open(card);
    expect(dueInput()!.value).toBe("30,000");
    expect(dueInput()!.readOnly).toBe(false);
    expect(bodyText()).toContain(
      `editDialog.dueCarryoverLabel|date=${md("2026-09-14")}`,
    );
    expect(bodyText()).toContain("editDialog.carryoverAfterHelpNoDate");

    setInput(dueInput()!, "0");
    click(lastButton("save"));
    expect(updated!.dueCarryoverAmount).toBe(0);
  });

  it("잠겼으면 칸이 잠기고 키째 뺀다", () => {
    open({
      ...card,
      dueCarryover: { amount: 30_000, locked: true, paymentDate: "2026-09-14" },
    });
    expect(dueInput()!.readOnly).toBe(true);
    expect(bodyText()).toContain("editDialog.carryoverLocked");

    click(lastButton("save"));
    expect("dueCarryoverAmount" in updated!).toBe(false);
  });

  it("칸이 없으면(null) 종전 그대로 — 칸 하나, 키 없음", () => {
    open({ ...card, dueCarryover: null });
    expect(dueInput()).toBeNull();
    expect(bodyText()).toContain("editDialog.balanceLabelCard");

    click(lastButton("save"));
    expect("dueCarryoverAmount" in updated!).toBe(false);
  });
});
