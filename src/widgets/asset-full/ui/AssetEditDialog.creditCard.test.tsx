// 신용카드 수정 폼 — 이월 금액 칸(D7 · D15)과 결제일 변경 확인(D5).
//
// 칸이 지금 미결제 잔액으로 채워지고 늘 `balance` 로 나갔는데, 서버는 그 값을 **이월
// 금액**으로 받아 이월 거래를 새로 만들었다 — 이름만 고쳐 저장해도 빚이 두 배가 됐다
// (QA 23차 1, 출시 차단). 이제:
//   (1) 칸은 이월 금액(`carryoverAmount`, 없으면 0)으로 열리고, 그 키로만 나간다 —
//       신용카드는 `balance` 를 싣지 않는다
//   (2) 지금 미결제 잔액은 옆에 읽기 전용으로 둔다(두 숫자를 헷갈리지 않게)
//   (3) 이월 회차의 결제일이 됐으면 칸이 잠기고 키째 빠진다(D15)
//   (4) 결제일을 바꾸면 "다음 회차부터 · N월분은 옛 결제일에" 를 묻고, 확인해야 저장한다(D5)
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetPointerBlockForTest } from "@/shared/lib/groo/pointer-block";
import { formatDay } from "@/shared/lib/groo/format";
import type { Asset } from "@/entities/asset";
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
    // 값이 있으면 `키|이름=값,…` 으로 — 문장에 무엇이 들어갔는지 본다.
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
vi.mock("@/features/card-catalog", () => ({
  useCardCatalogs: () => ({ data: undefined, isFetching: false }),
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

/**
 * 결제일 14일 신용카드 — 등록 때 이월 50,000 을 적었고 그 뒤 300,000 을 더 썼다.
 * 8월 회차까지 결제가 끝났다.
 */
const card: Asset = {
  userRowId: 1,
  rowId: 7,
  assetName: "현대 ZERO",
  assetType: "CREDIT_CARD",
  balance: -350_000,
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
  carryoverAmount: 50_000,
  carryoverLocked: false,
  cardClosedThrough: "2026-08-31",
  createAt: "2026-01-01T00:00:00",
  modifyAt: "2026-01-01T00:00:00",
};

let container: HTMLDivElement;
let root: Root;
let update: Record<string, unknown> | null = null;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  __resetPointerBlockForTest();
  update = null;
  installDomStubs();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function open(item: Asset) {
  act(() =>
    root.render(
      <AssetEditDialog
        item={item}
        onClose={() => {}}
        onCreate={() => {}}
        onUpdate={(v) => {
          update = v as unknown as Record<string, unknown>;
        }}
      />,
    ),
  );
}

/** 폼의 저장 — 확인창이 뜨면 그 저장이 나중에 붙는다. */
const lastSave = () => {
  const all = buttons("save");
  return all[all.length - 1]!;
};
const amountInput = () => fieldControl("editDialog.balanceLabelCard")!;

/** 결제일 Select 를 열어 고른다. */
const pickPaymentDay = (day: number) =>
  chooseSelect("editDialog.paymentDay", `editDialog.dayUnit|day=${day}`);

describe("이월 금액 칸(D7)", () => {
  it("칸은 이월 금액으로 열리고 지금 미결제 잔액은 옆에 읽기 전용이다", () => {
    open(card);

    expect(amountInput().value).toBe("50,000");
    expect(amountInput().readOnly).toBe(false);
    const unpaid = document.body.querySelector(
      "[data-testid='current-unpaid']",
    );
    expect(unpaid?.textContent).toMatch(/^editDialog\.currentUnpaid\|balance=/);
    expect(unpaid?.textContent).toMatch(/350,000/);
  });

  it("그대로 저장하면 이월 금액이 전용 키로 나가고 balance 는 안 싣는다 — 빚이 두 배가 되던 자리", () => {
    open(card);
    click(buttons("save")[0]!);

    expect(update).not.toBeNull();
    expect(update!.carryoverAmount).toBe(50_000);
    expect(update!).not.toHaveProperty("balance");
  });

  it("고친 이월 금액이 나간다", () => {
    open(card);
    setInput(amountInput(), "70000");
    click(buttons("save")[0]!);

    expect(update!.carryoverAmount).toBe(70_000);
    expect(update!).not.toHaveProperty("balance");
  });

  it("이월이 없는 카드는 0 으로 열린다 — 잔액으로 채우지 않는다", () => {
    open({ ...card, carryoverAmount: 0 });

    expect(amountInput().value).toBe("0");
  });
});

describe("이월 회차가 결제됐으면 읽기 전용(D15)", () => {
  it("칸이 잠기고 이유를 말하며, 저장 본문에서 키째 빠진다", () => {
    open({ ...card, carryoverLocked: true });

    expect(amountInput().readOnly).toBe(true);
    expect(
      document.body.querySelector("[data-testid='carryover-locked']")
        ?.textContent,
    ).toBe("editDialog.carryoverLocked");

    click(buttons("save")[0]!);
    expect(update).not.toBeNull();
    expect(update!).not.toHaveProperty("carryoverAmount");
    expect(update!).not.toHaveProperty("balance");
  });
});

describe("결제일 변경은 다음 회차부터(D5)", () => {
  it("바꾸면 옛 결제일로 결제되는 회차를 말하고, 확인해야 저장한다", () => {
    open(card);
    pickPaymentDay(25);
    click(buttons("save")[0]!);

    // 8월분까지 결제가 끝났다 → 9월분은 옛 결제일(14일)인 10/14 에 결제된다.
    expect(update).toBeNull();
    expect(bodyText()).toContain("editDialog.paymentDayChangeAsk");
    expect(bodyText()).toContain("editDialog.paymentDayChangeConfirm|month=9,");
    expect(bodyText()).toContain(`oldDate=${formatDay("2026-10-14").md}`);

    click(lastSave());
    expect(update).not.toBeNull();
    expect(update!.paymentDay).toBe(25);
  });

  it("결제일을 안 바꾸면 묻지 않는다", () => {
    open(card);
    click(buttons("save")[0]!);

    expect(bodyText()).not.toContain("editDialog.paymentDayChangeConfirm");
    expect(update!.paymentDay).toBe(14);
  });

  it("확인창에서 취소하면 저장하지 않는다", () => {
    open(card);
    pickPaymentDay(25);
    click(buttons("save")[0]!);
    click(buttons("cancel")[buttons("cancel").length - 1]!);

    expect(update).toBeNull();
  });

  it("결제일 변경이 대기 중이면 서버가 준 실제 결제일과 그 회차의 달을 말한다(QA 26차 4)", () => {
    // 25일 카드를 9/21 에 21일로 바꿔 둔 채 다시 10일로 바꾼다. 8월분은 처음 결제일인
    // 9/25 에 나간다 — 지금 결제일(21)로 세면 "9월 21일" 이라는 틀린 날을 말했다.
    open({
      ...card,
      paymentDay: 21,
      cardClosedThrough: "2026-07-31",
      nextPaymentDate: "2026-09-25",
    });
    pickPaymentDay(10);
    click(buttons("save")[0]!);

    expect(update).toBeNull();
    expect(bodyText()).toContain("editDialog.paymentDayChangeConfirm|month=8,");
    expect(bodyText()).toContain(`oldDate=${formatDay("2026-09-25").md}`);
  });
});
