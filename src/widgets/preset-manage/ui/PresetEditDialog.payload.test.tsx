// 프리셋 편집이 **보내는 것**을 고정한다 (QA #325 회귀).
//
// 규칙은 하나다 — 이 다이얼로그가 **가진 칸만** 싣는다.
// PUT 은 세 갈래이므로(`Patch`: 키 없음=유지 · null=지움 · 값=교체, QA #96)
// 칸이 있으면 지금 상태를 그대로(비었으면 `null`) 싣고, 칸이 없으면 키를 뺀다.
// 자산 편집(#106·#110)·거래 시트(#107·#108)와 같은 판단이다.
//
// - 거래처·결제수단·계좌: 이 화면이 그리는 칸이다. 비운 채 저장하면 지워져야 하는데
//   `|| undefined` 로 키를 빼서, 서버가 `Optional` 로 옮긴 뒤(#325) "안 고침" 으로 읽혔다 —
//   화면만 지워진 척 닫히고 옛 값이 서버에 남았다.
// - 메모: **이제 이 화면의 칸이다**(D2 · desk-app #330). 종전엔 칸이 없고 읽어 온 값도
//   안 들고 있어서(상태 자체가 없었다) 무엇을 실어도 지어낸 값이라 키를 뺐다 —
//   서버를 `Optional` 로 옮긴 #325 의 계기가 이 칸이었다. 칸이 생겼으니 다른 칸과
//   같은 규칙으로 돌아온다: 비우면 `null`, 안 건드리면 읽어 온 값 그대로.
// - 금액: `lockAmount` 와 **한 쌍**이라 계약이 다르다. 고정을 끄면 서버가 실린 금액을
//   버리므로(`ExpenseTemplateServiceImpl.resolveAmount`) 키를 빼도 옛 금액이 안 남는다.
//
// 반대편도 함께 잠근다 — 값이 있는 칸은 그대로 나가야 하고, 새로 만들 때도 같은 본문이다.
// 안 그러면 "프리셋은 아무것도 안 보낸다" 는 잘못된 교훈이 번진다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Asset } from "@/entities/asset";
import type { ExpenseCategory } from "@/entities/expense";
import type { ExpenseTemplate } from "@/entities/expense-template";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const catState = vi.hoisted(() => ({ fail: false, args: [] as unknown[] }));
const sent = vi.hoisted(() => ({
  update: null as Record<string, unknown> | null,
  create: null as Record<string, unknown> | null,
}));

// 라벨 키를 그대로 흘려보낸다 — 여기서 보는 건 페이로드뿐이다.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      o ? `${k}${JSON.stringify(o)}` : k,
    i18n: { language: "ko" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/features/expense", () => ({
  useExpenseCategories: (opts?: unknown) => {
    catState.args.push(opts);
    return catState.fail
      ? {
          data: undefined,
          isLoading: false,
          isError: true,
          errorUpdateCount: 1,
          refetch: () => {},
        }
      : {
          data: categories,
          isLoading: false,
          isError: false,
          errorUpdateCount: 0,
        };
  },
  useExpenseTemplates: () => ({ data: [], isLoading: false }),
  useCreateExpenseTemplate: () => ({
    mutate: (data: Record<string, unknown>) => {
      sent.create = data;
    },
    isPending: false,
  }),
  useUpdateExpenseTemplate: () => ({
    mutate: ({ data }: { id: number; data: Record<string, unknown> }) => {
      sent.update = data;
    },
    isPending: false,
  }),
}));
vi.mock("@/features/asset", () => ({
  useAssets: () => ({
    data: { assets: [asset, savings, card, loan] },
    isLoading: false,
  }),
}));

const category: ExpenseCategory = {
  rowId: 11,
  categoryName: "식비",
  icon: null,
  color: "#2c70bf",
  expenseType: "EXPENSE",
  sortOrder: 0,
  parentRowId: null,
  hasChildren: false,
  createAt: "2026-01-01T00:00:00",
  modifyAt: "2026-01-01T00:00:00",
};

/** 식비(하위 없음) · 교통(하위 버스) — 하위가 있는 상위는 고를 수 없다 */
const categories: ExpenseCategory[] = [
  category,
  {
    ...category,
    rowId: 13,
    categoryName: "교통",
    sortOrder: 1,
    hasChildren: true,
  },
  {
    ...category,
    rowId: 14,
    categoryName: "버스",
    sortOrder: 2,
    parentRowId: 13,
  },
];

const asset: Asset = {
  rowId: 3,
  userRowId: 1,
  assetName: "주거래",
  assetType: "BANK_ACCOUNT",
  balance: 0,
  cashBalance: 0,
  holdingBalance: 0,
  currency: "KRW",
  exchangeRate: 1,
  color: null,
  institution: "국민",
  memo: null,
  sortOrder: 0,
  isIncludedInTotal: "Y",
  isAmountHidden: "N",
  cardCatalog: null,
  createAt: "2026-01-01T00:00:00",
  modifyAt: "2026-01-01T00:00:00",
};

/** 거래에서 '프리셋으로 저장' 해 만들어진 프리셋 — 설명이 그때 붙었다. */
const basePreset: ExpenseTemplate = {
  rowId: 77,
  userRowId: 1,
  templateName: "점심",
  categoryRowId: 11,
  categoryName: "식비",
  assetRowId: 3,
  assetName: "주거래",
  toAssetRowId: null,
  toAssetName: null,
  fee: null,
  interestAmount: null,
  expenseType: "EXPENSE",
  amount: null,
  description: "회사 근처 단골",
  merchant: "김밥천국",
  paymentMethod: "CARD",
  useCount: 0,
  sortOrder: 0,
  lockAmount: "N",
  lastUsedAt: null,
  createAt: "2026-01-01T00:00:00",
  modifyAt: "2026-01-01T00:00:00",
};

/** 받는 계좌 후보. */
const savings: Asset = {
  ...asset,
  rowId: 4,
  assetName: "청약",
  assetType: "SAVINGS",
  institution: "국민",
};

/** 이자 칸이 뜨는 유일한 조건 — 받는 자산이 대출. */
const loan: Asset = {
  ...asset,
  rowId: 6,
  assetName: "대출",
  assetType: "LOAN",
  institution: null,
};

/** 이체 후보에서 빠져야 하는 카드. */
const card: Asset = {
  ...asset,
  rowId: 5,
  assetName: "체크",
  assetType: "CHECK_CARD",
  institution: "국민",
};

const { PresetEditDialog } = await import("./PresetEditDialog");

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
  sent.update = null;
  sent.create = null;
  window.history.replaceState(null, "");
  // 폭 1280 미만(시트) — 고르기는 폼 시트 위 고르기 시트다
  window.matchMedia = ((query: string) => ({
    matches: query.includes("never-wide"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  document.body.removeAttribute("style");
  await new Promise((r) => setTimeout(r, 50));
});

function render(preset: ExpenseTemplate | null) {
  act(() =>
    root.render(<PresetEditDialog preset={preset} onClose={() => {}} />),
  );
}

const tick = (ms = 0) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
const click = (el: Element | undefined | null) => {
  if (!el) throw new Error("누를 요소를 찾지 못했다");
  return act(async () => {
    el.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    await new Promise((r) => setTimeout(r, 0));
  });
};

/** 리액트가 관리하는 입력에 값을 넣는다(setter 를 우회하면 상태가 안 바뀐다). */
function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  // 프로토타입이 다르면 setter 도 다르다 — input 것을 textarea 에 쓰면 값이 안 들어간다.
  const proto =
    el instanceof window.HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  act(() => {
    setter?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const textInput = () =>
  document.querySelector<HTMLInputElement>("[data-slot=text-input-value]")!;
const textarea = () => document.querySelector<HTMLTextAreaElement>("textarea")!;
const buttonByText = (text: string) =>
  Array.from(document.querySelectorAll<HTMLElement>("button")).find(
    (b) => b.textContent?.trim() === text,
  );
/** 폼 줄 — 제목으로 찾는다 */
const rowOf = (title: string) =>
  Array.from(
    document.querySelectorAll<HTMLElement>("[data-slot=list-item]"),
  ).find(
    (li) => li.querySelector("[data-slot=list-title]")?.textContent === title,
  )!;
const valueOf = (title: string) =>
  rowOf(title).querySelector("[data-slot=list-suffix]")?.textContent;
const rowButton = (title: string) =>
  rowOf(title).querySelector<HTMLElement>("[data-slot=list-body]");
/** 고르기 시트 안의 줄 */
const pickItem = (text: string) =>
  Array.from(
    document.querySelectorAll<HTMLElement>("[data-slot=list-body]"),
  ).find((b) => b.textContent?.includes(text));
const pickItemTitles = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>("[data-slot=list-body]"),
  ).map((b) => b.querySelector("[data-slot=list-title]")?.textContent);

/** 줄을 눌러 고르기 시트를 열고 항목을 고른다 */
async function pick(rowTitle: string, itemText: string) {
  await click(rowButton(rowTitle));
  await tick();
  await click(pickItem(itemText));
  await tick();
}
/** 치는 값 줄을 눌러 한 단계 들어가 값을 넣고 "done" 을 누른다 */
async function typeInStep(rowTitle: string, value: string, multiline = false) {
  await click(rowButton(rowTitle));
  await tick();
  setValue(multiline ? textarea() : textInput(), value);
  await click(buttonByText("done"));
  await tick();
}
const chip = (label: string) =>
  Array.from(document.querySelectorAll<HTMLElement>("[role=radio]")).find(
    (b) => b.textContent === label,
  )!;

/**
 * 서버가 실제로 받는 본문.
 *
 * axios 는 객체를 `JSON.stringify` 로 보낸다 — 값이 `undefined` 인 키는 그때 통째로
 * 사라진다. 그래서 "키가 있느냐" 는 자바스크립트 객체가 아니라 **직렬화 결과**로 봐야
 * 한다(`{ amount: undefined }` 는 객체엔 키가 있지만 본문엔 없다).
 */
function wire(payload: Record<string, unknown> | null) {
  if (!payload) throw new Error("보낸 본문이 없다");
  return JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
}

const clickSave = (label: "save" | "add" = "save") =>
  click(buttonByText(label));

describe("비운 칸은 명시 null 로 나간다 (QA #325 회귀)", () => {
  it("거래처를 지우면 null 이 나간다 — 안 건드린 칸은 그대로", async () => {
    render(basePreset);
    await typeInStep("preset.defaultMerchant", "");
    await clickSave();

    expect(sent.update).not.toBeNull();
    // `undefined` 였다면 직렬화에서 키째 빠져 서버가 "안 고침" 으로 읽는다.
    expect(wire(sent.update)).toHaveProperty("merchant");
    expect(sent.update!.merchant).toBeNull();
    // 반대편 — 안 건드린 칸은 값을 지킨다.
    expect(sent.update!.paymentMethod).toBe("CARD");
    expect(sent.update!.assetRowId).toBe(3);
  });

  it("결제수단을 '결제 수단 없음' 으로 되돌리면 null 이 나간다", async () => {
    render(basePreset);
    await pick("paymentMethodLabel", "preset.noPayment");
    await clickSave();

    expect(wire(sent.update)).toHaveProperty("paymentMethod");
    expect(sent.update!.paymentMethod).toBeNull();
    // 반대편 — 채워진 칸은 그대로.
    expect(sent.update!.merchant).toBe("김밥천국");
    expect(sent.update!.assetRowId).toBe(3);
  });

  it("계좌를 '계좌·카드 없음' 으로 되돌리면 null 이 나간다", async () => {
    render(basePreset);
    await pick("accountCard", "preset.noAccount");
    await clickSave();

    expect(wire(sent.update)).toHaveProperty("assetRowId");
    expect(sent.update!.assetRowId).toBeNull();
    // 반대편 — 채워진 칸은 그대로.
    expect(sent.update!.merchant).toBe("김밥천국");
    expect(sent.update!.paymentMethod).toBe("CARD");
  });

  it("공백만 남긴 거래처도 비운 것으로 본다", async () => {
    render(basePreset);
    await typeInStep("preset.defaultMerchant", "   ");
    await clickSave();

    expect(sent.update!.merchant).toBeNull();
  });
});

describe("메모는 이제 이 화면의 칸이다 (D2)", () => {
  it("읽어 온 메모로 폼을 연다", () => {
    render(basePreset);

    // 안 채우고 열면, 이름만 고쳐 저장해도 메모가 `null` 로 나가 지워진다.
    expect(valueOf("memo")).toContain("회사 근처 단골");
  });

  it("안 건드리면 읽어 온 메모가 그대로 나간다", async () => {
    render(basePreset);
    setValue(textInput(), "점심값");
    await clickSave();

    expect(sent.update!.description).toBe("회사 근처 단골");
  });

  it("메모를 지우면 null 이 나간다 — 키를 빼면 옛 메모가 서버에 남는다", async () => {
    render(basePreset);
    await typeInStep("memo", "", true);
    await clickSave();

    expect(wire(sent.update)).toHaveProperty("description");
    expect(sent.update!.description).toBeNull();
    // 반대편 — 안 건드린 칸은 그대로.
    expect(sent.update!.merchant).toBe("김밥천국");
  });

  it("공백만 남긴 메모도 비운 것으로 본다", async () => {
    render(basePreset);
    await typeInStep("memo", "   ", true);
    await clickSave();

    expect(sent.update!.description).toBeNull();
  });
});

describe("금액은 한 줄이다 — 금액이 있으면 고정, 비우면 직접 넣는다 (2-B)", () => {
  it("'고정 금액 사용' 스위치는 없다 — 스위치는 고정 지출 하나뿐", () => {
    render({ ...basePreset, lockAmount: "Y", amount: 9000 });
    expect(document.body.textContent).not.toContain("lockAmountTitle");
    expect(document.querySelectorAll("[role=switch]")).toHaveLength(1);
  });

  it("금액 줄 값 — 금액이 있으면 금액", () => {
    render({ ...basePreset, lockAmount: "Y", amount: 9000 });
    expect(valueOf("preset.amountLabel")).toContain("9,000");
  });

  it("금액 줄 값 — 금액이 없으면 '비워 둠'", () => {
    render(basePreset);
    expect(valueOf("preset.amountLabel")).toBe("preset.amountBlank");
  });

  it("금액이 있는 프리셋은 금액을 싣고 lockAmount Y", async () => {
    render({ ...basePreset, lockAmount: "Y", amount: 9000 });
    await clickSave();

    expect(sent.update!.amount).toBe(9000);
    expect(sent.update!.lockAmount).toBe("Y");
  });

  it("금액이 없는 프리셋은 금액 키를 뺀다 — 서버가 짝으로 버린다", async () => {
    render(basePreset);
    await clickSave();

    expect(wire(sent.update)).not.toHaveProperty("amount");
    expect(sent.update!.lockAmount).toBe("N");
  });

  it("금액 줄에서 금액을 넣으면 lockAmount Y + amount", async () => {
    render(basePreset);
    await typeInStep("preset.amountLabel", "12000");
    await clickSave();

    expect(sent.update!.amount).toBe(12000);
    expect(sent.update!.lockAmount).toBe("Y");
  });

  it("금액을 비우면 lockAmount N · 금액 키 없음", async () => {
    render({ ...basePreset, lockAmount: "Y", amount: 9000 });
    await typeInStep("preset.amountLabel", "");
    await clickSave();

    expect(sent.update!.lockAmount).toBe("N");
    expect(wire(sent.update)).not.toHaveProperty("amount");
  });

  it("금액 단계 안내 글은 '비워 두면 …' 이다", async () => {
    render(basePreset);
    await click(rowButton("preset.amountLabel"));
    await tick();
    expect(document.body.textContent).toContain("preset.amountHint");
  });
});

describe("검증은 누를 때 칸 아래에 나온다", () => {
  it("빈 이름 · 카테고리 없이 [추가] → 오류 · 요청 0", async () => {
    render(null);
    await clickSave("add");

    expect(sent.create).toBeNull();
    expect(document.body.textContent).toContain("preset.nameRequired");
    expect(document.body.textContent).toContain("preset.categoryRequired");
  });

  it("이체는 보내는 · 받는 계좌를 고르라고 알린다", async () => {
    render(null);
    await click(chip("addTx.transfer"));
    setValue(textInput(), "적금 이체");
    await clickSave("add");

    expect(sent.create).toBeNull();
    expect(document.body.textContent).toContain("preset.fromRequired");
    expect(document.body.textContent).toContain("preset.toRequired");
  });
});

describe("새로 만들 때도 같은 본문이다", () => {
  it("빈 폼으로 만들면 비운 칸이 전부 null 로 나간다", async () => {
    render(null);
    setValue(textInput(), "새 프리셋");
    await pick("category", "식비");
    await clickSave("add");

    expect(sent.create).not.toBeNull();
    expect(sent.create!.templateName).toBe("새 프리셋");
    expect(sent.create!.categoryRowId).toBe(11);
    expect(sent.create!.merchant).toBeNull();
    expect(sent.create!.paymentMethod).toBeNull();
    expect(sent.create!.assetRowId).toBeNull();
    expect(sent.create!.description).toBeNull();
    expect(sent.create!.lockAmount).toBe("N");
    // 등록 경로는 `Optional` 이 아니라 값을 그대로 받는다 — null 과 키 없음이 같은 뜻이다.
    expect(sent.update).toBeNull();
  });
});

describe("카테고리 고르기 — 하위가 있는 상위는 못 고른다", () => {
  it("하위가 있는 상위는 목록 제목, 하위와 하위 없는 최상위만 고르는 줄", async () => {
    render(null);
    await click(rowButton("category"));
    await tick();

    const titles = pickItemTitles();
    expect(titles).toContain("버스");
    expect(titles).toContain("식비");
    // 상위 "교통" 은 목록 제목이지 줄이 아니다
    expect(titles).not.toContain("교통");
  });
});

describe("이체 프리셋", () => {
  it("보내는·받는 계좌와 수수료가 본문에 실린다", async () => {
    render(null);
    await click(chip("addTx.transfer"));
    setValue(textInput(), "적금 이체");
    await pick("preset.fromAccount", "주거래");
    await pick("preset.toAccount", "청약");
    await typeInStep("preset.feeLabel", "500");
    await clickSave("add");

    expect(sent.create).not.toBeNull();
    expect(sent.create!.expenseType).toBe("TRANSFER");
    expect(sent.create!.assetRowId).toBe(3);
    expect(sent.create!.toAssetRowId).toBe(4);
    expect(sent.create!.fee).toBe(500);
    // 이체에는 카테고리가 없다 — 서버도 실려 오면 거절한다.
    expect(sent.create!.categoryRowId).toBeNull();
  });

  it("카드는 이체 상대 목록에 없다 — 서버도 400 으로 막는다", async () => {
    render(null);
    await click(chip("addTx.transfer"));
    await click(rowButton("preset.fromAccount"));
    await tick();

    const titles = pickItemTitles();
    expect(titles).toContain("주거래");
    expect(titles).toContain("청약");
    expect(titles).not.toContain("체크");
  });

  it("이체를 지출로 바꿔 저장하면 이체 칸이 null 로 지워진다", async () => {
    render({
      ...basePreset,
      expenseType: "TRANSFER",
      categoryRowId: null,
      categoryName: null,
      toAssetRowId: 4,
      toAssetName: "청약",
      fee: 500,
    });
    await click(chip("expense"));
    // 지출에는 카테고리가 필요하다
    await pick("category", "식비");
    await clickSave();

    const body = wire(sent.update);
    expect(body).toHaveProperty("toAssetRowId");
    expect(sent.update!.toAssetRowId).toBeNull();
    expect(sent.update!.fee).toBeNull();
    expect(sent.update!.expenseType).toBe("EXPENSE");
  });
});

describe("이자는 금액을 따라간다 (2026-09-15 결정)", () => {
  /** 대출 자산 — 이자 칸이 뜨는 유일한 조건. */
  const loanPreset: ExpenseTemplate = {
    ...basePreset,
    expenseType: "TRANSFER",
    categoryRowId: null,
    categoryName: null,
    assetRowId: 3,
    toAssetRowId: 6,
    toAssetName: "대출",
    fee: 500,
    interestAmount: 20000,
    amount: 300000,
    lockAmount: "Y",
  };

  it("금액을 비우면 이자가 null 로 나간다 — 계좌·수수료는 남는다", async () => {
    render(loanPreset);
    await typeInStep("preset.amountLabel", "");
    await clickSave();

    const body = wire(sent.update);
    expect(body).toHaveProperty("interestAmount");
    expect(sent.update!.interestAmount).toBeNull();
    expect(sent.update!.lockAmount).toBe("N");
    // 반대편 — 계좌 짝의 성질인 수수료는 그대로.
    expect(sent.update!.toAssetRowId).toBe(6);
    expect(sent.update!.fee).toBe(500);
  });

  it("금액이 있으면 이자가 그대로 나간다", async () => {
    render(loanPreset);
    await clickSave();

    expect(sent.update!.interestAmount).toBe(20000);
    expect(sent.update!.lockAmount).toBe("Y");
  });
});

describe("카테고리 조회 실패 (I-20 20-2 후속)", () => {
  it("카테고리 줄을 열면 고르기 대신 실패 한 벌이 나온다 — 조회는 silent", async () => {
    catState.fail = true;
    render(null);
    await click(rowButton("category"));
    await tick();
    expect(document.body.textContent).toContain("preset.categoryLoadFailed");
    expect(pickItemTitles()).not.toContain("식비");
    expect(
      catState.args.every((a) => (a as { silent?: boolean })?.silent),
    ).toBe(true);
    catState.fail = false;
  });
});
