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

const catState = vi.hoisted(() => ({ loaded: true }));
const assetState = vi.hoisted(() => ({ loaded: true }));
const sent = vi.hoisted(() => ({
  update: null as Record<string, unknown> | null,
  create: null as Record<string, unknown> | null,
}));

// 라벨 키를 그대로 흘려보낸다 — 여기서 보는 건 페이로드뿐이다.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/features/expense", () => ({
  useExpenseCategories: () => ({
    data: catState.loaded ? [category] : undefined,
    isLoading: !catState.loaded,
  }),
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
    data: assetState.loaded
      ? { assets: [asset, savings, card, loan] }
      : undefined,
    isLoading: !assetState.loaded,
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
  sent.update = null;
  sent.create = null;
  // Radix Select 는 포인터 캡처·스크롤 API 를 쓴다 — jsdom 엔 없어서 채워 준다.
  const proto = window.HTMLElement.prototype as unknown as Record<
    string,
    unknown
  >;
  proto.hasPointerCapture = () => false;
  proto.setPointerCapture = () => {};
  proto.releasePointerCapture = () => {};
  proto.scrollIntoView = () => {};
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(preset: ExpenseTemplate | null) {
  act(() =>
    root.render(
      <PresetEditDialog preset={preset} mobile={false} onClose={() => {}} />,
    ),
  );
}

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

const byValue = (v: string) =>
  [...document.body.querySelectorAll<HTMLInputElement>("input")].find(
    (el) => el.value === v,
  );

/** 메모 칸만 textarea 다 — 값이 아니라 태그로 집는다(빈 채로도 찾아야 한다). */
const memoBox = () =>
  document.body.querySelector<HTMLTextAreaElement>("textarea");

const byText = <T extends Element>(selector: string, text: string) =>
  [...document.body.querySelectorAll<T>(selector)].find(
    (el) => el.textContent?.trim() === text,
  );

/** Radix Select 를 실제로 연다 — 키보드로 열고 항목을 고른다(포인터는 jsdom 에서 안 뜬다). */
function pickOption(triggerText: string, optionText: string) {
  const trigger = byText<HTMLButtonElement>("button", triggerText);
  if (!trigger) throw new Error(`셀렉트를 찾지 못했다: ${triggerText}`);
  act(() => {
    trigger.focus();
    trigger.dispatchEvent(
      new KeyboardEvent("keydown", { key: " ", bubbles: true }),
    );
  });
  const option = byText("[role='option']", optionText);
  if (!option) throw new Error(`항목을 찾지 못했다: ${optionText}`);
  act(() =>
    option.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    ),
  );
}

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

function clickSave(label: "save" | "add" = "save") {
  const save = byText<HTMLButtonElement>("button", label);
  if (!save) throw new Error("저장 버튼을 찾지 못했다");
  act(() => save.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

describe("비운 칸은 명시 null 로 나간다 (QA #325 회귀)", () => {
  it("거래처를 지우면 null 이 나간다 — 안 건드린 칸은 그대로", () => {
    render(basePreset);
    setValue(byValue("김밥천국")!, "");
    clickSave();

    expect(sent.update).not.toBeNull();
    // `undefined` 였다면 직렬화에서 키째 빠져 서버가 "안 고침" 으로 읽는다.
    expect(wire(sent.update)).toHaveProperty("merchant");
    expect(sent.update!.merchant).toBeNull();
    // 반대편 — 안 건드린 칸은 값을 지킨다.
    expect(sent.update!.paymentMethod).toBe("CARD");
    expect(sent.update!.assetRowId).toBe(3);
  });

  it("결제수단을 '선택 안 함' 으로 되돌리면 null 이 나간다", () => {
    render(basePreset);
    pickOption("form.paymentMethod.CARD", "selectNone");
    clickSave();

    expect(wire(sent.update)).toHaveProperty("paymentMethod");
    expect(sent.update!.paymentMethod).toBeNull();
    // 반대편 — 채워진 칸은 그대로.
    expect(sent.update!.merchant).toBe("김밥천국");
    expect(sent.update!.assetRowId).toBe(3);
  });

  it("계좌를 '선택 안 함' 으로 되돌리면 null 이 나간다", () => {
    render(basePreset);
    pickOption("국민 · 주거래", "selectNone");
    clickSave();

    expect(wire(sent.update)).toHaveProperty("assetRowId");
    expect(sent.update!.assetRowId).toBeNull();
    // 반대편 — 채워진 칸은 그대로.
    expect(sent.update!.merchant).toBe("김밥천국");
    expect(sent.update!.paymentMethod).toBe("CARD");
  });

  it("공백만 남긴 거래처도 비운 것으로 본다", () => {
    render(basePreset);
    setValue(byValue("김밥천국")!, "   ");
    clickSave();

    expect(sent.update!.merchant).toBeNull();
  });
});

describe("메모는 이제 이 화면의 칸이다 (D2)", () => {
  it("읽어 온 메모로 폼을 연다", () => {
    render(basePreset);

    // 안 채우고 열면, 이름만 고쳐 저장해도 메모가 `null` 로 나가 지워진다.
    // 칸이 생겨서 오히려 위험해진 자리다 — 자산 통화 칸과 같은 순서로 잠근다.
    expect(memoBox()?.value).toBe("회사 근처 단골");
  });

  it("안 건드리면 읽어 온 메모가 그대로 나간다", () => {
    render(basePreset);
    setValue(byValue("점심")!, "점심값");
    clickSave();

    expect(sent.update!.description).toBe("회사 근처 단골");
  });

  it("메모를 지우면 null 이 나간다 — 키를 빼면 옛 메모가 서버에 남는다", () => {
    render(basePreset);
    setValue(memoBox()!, "");
    clickSave();

    expect(wire(sent.update)).toHaveProperty("description");
    expect(sent.update!.description).toBeNull();
    // 반대편 — 안 건드린 칸은 그대로.
    expect(sent.update!.merchant).toBe("김밥천국");
  });

  it("공백만 남긴 메모도 비운 것으로 본다", () => {
    render(basePreset);
    setValue(memoBox()!, "   ");
    clickSave();

    expect(sent.update!.description).toBeNull();
  });
});

describe("금액은 lockAmount 와 한 쌍이다", () => {
  it("고정을 켠 프리셋은 금액을 싣는다", () => {
    render({ ...basePreset, lockAmount: "Y", amount: 9000 });
    clickSave();

    expect(sent.update!.amount).toBe(9000);
    expect(sent.update!.lockAmount).toBe("Y");
  });

  it("고정을 끈 프리셋은 금액 키를 뺀다 — 금액칸 자체가 안 그려진다", () => {
    render(basePreset);
    clickSave();

    // 서버가 짝으로 보고 버린다(`resolveAmount`: 고정이 아니면 항상 null).
    expect(wire(sent.update)).not.toHaveProperty("amount");
    expect(sent.update!.lockAmount).toBe("N");
  });
});

describe("새로 만들 때도 같은 본문이다", () => {
  it("빈 폼으로 만들면 비운 칸이 전부 null 로 나간다", () => {
    render(null);
    setValue(byValue("")!, "새 프리셋");
    const tile = [...document.body.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("식비"),
    );
    act(() => tile!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    clickSave("add");

    expect(sent.create).not.toBeNull();
    expect(sent.create!.templateName).toBe("새 프리셋");
    expect(sent.create!.categoryRowId).toBe(11);
    expect(sent.create!.merchant).toBeNull();
    expect(sent.create!.paymentMethod).toBeNull();
    expect(sent.create!.assetRowId).toBeNull();
    expect(sent.create!.description).toBeNull();
    // 등록 경로는 `Optional` 이 아니라 값을 그대로 받는다 — null 과 키 없음이 같은 뜻이다.
    expect(sent.update).toBeNull();
  });
});

describe("이체 프리셋", () => {
  /**
   * 탭을 옮긴다 — 라벨은 t() 가 키를 그대로 흘린다.
   * radix Tabs 는 `mousedown` 에서 바꾼다. `click` 만 쏘면 아무 일도 안 일어난다.
   */
  function switchTab(label: string) {
    const tab = byText<HTMLButtonElement>("button", label);
    if (!tab) throw new Error(`탭을 찾지 못했다: ${label}`);
    act(() =>
      tab.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })),
    );
  }

  it("보내는·받는 계좌와 수수료가 본문에 실린다", () => {
    render(null);
    switchTab("addTx.transfer");
    setValue(byValue("")!, "적금 이체"); // 첫 input = 이름
    pickOption("addTx.selectPlaceholder", "국민 · 주거래");
    pickOption("addTx.selectPlaceholder", "국민 · 청약");
    const feeBox = [
      ...document.body.querySelectorAll<HTMLInputElement>("input"),
    ].find((el) => el.placeholder === "0");
    setValue(feeBox!, "500");
    clickSave("add");

    expect(sent.create).not.toBeNull();
    expect(sent.create!.expenseType).toBe("TRANSFER");
    expect(sent.create!.assetRowId).toBe(3);
    expect(sent.create!.toAssetRowId).toBe(4);
    expect(sent.create!.fee).toBe(500);
    // 이체에는 카테고리가 없다 — 서버도 실려 오면 거절한다.
    expect(sent.create!.categoryRowId).toBeNull();
  });

  it("카드는 이체 상대 목록에 없다 — 서버도 400 으로 막는다", () => {
    render(null);
    switchTab("addTx.transfer");
    const trigger = byText<HTMLButtonElement>(
      "button",
      "addTx.selectPlaceholder",
    );
    act(() => {
      trigger!.focus();
      trigger!.dispatchEvent(
        new KeyboardEvent("keydown", { key: " ", bubbles: true }),
      );
    });
    const options = [...document.body.querySelectorAll("[role='option']")].map(
      (el) => el.textContent?.trim(),
    );
    expect(options).toContain("국민 · 주거래");
    expect(options).toContain("국민 · 청약");
    expect(options).not.toContain("국민 · 체크");
  });

  it("이체를 지출로 바꿔 저장하면 이체 칸이 null 로 지워진다", () => {
    render({
      ...basePreset,
      expenseType: "TRANSFER",
      categoryRowId: null,
      categoryName: null,
      toAssetRowId: 4,
      toAssetName: "청약",
      fee: 500,
    });
    switchTab("expense");
    // 지출에는 카테고리가 필요하다 — 타일을 눌러 고른다(타일 글자는 머리글자+이름).
    const tile = [
      ...document.body.querySelectorAll<HTMLButtonElement>("button"),
    ].find((el) => el.textContent?.includes("식비"));
    if (!tile) throw new Error("카테고리 타일을 찾지 못했다");
    act(() => tile.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    clickSave();

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

  it("고정 금액을 끄면 이자가 null 로 나간다 — 계좌·수수료는 남는다", () => {
    const repo = render(loanPreset);
    void repo;
    // "고정 금액 사용" 체크를 끈다.
    const check = [
      ...document.body.querySelectorAll<HTMLElement>(
        "[role='checkbox'], input",
      ),
    ].find(
      (el) =>
        el.getAttribute("role") === "checkbox" ||
        (el as HTMLInputElement).type === "checkbox",
    );
    if (!check) throw new Error("고정 금액 체크를 찾지 못했다");
    act(() => check.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    clickSave();

    const body = wire(sent.update);
    expect(body).toHaveProperty("interestAmount");
    expect(sent.update!.interestAmount).toBeNull();
    expect(sent.update!.lockAmount).toBe("N");
    // 반대편 — 계좌 짝의 성질인 수수료는 그대로.
    expect(sent.update!.toAssetRowId).toBe(6);
    expect(sent.update!.fee).toBe(500);
  });

  it("고정 금액이 켜져 있으면 이자가 그대로 나간다", () => {
    render(loanPreset);
    clickSave();

    expect(sent.update!.interestAmount).toBe(20000);
    expect(sent.update!.lockAmount).toBe("Y");
  });
});

describe("자산을 늦게 받아도 읽어 온 이자가 지워지지 않는다", () => {
  it("처음엔 자산이 없고 나중에 받는다 → 저장하면 이자가 그대로 나간다", () => {
    assetState.loaded = false;
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
    render(loanPreset);
    assetState.loaded = true;
    render(loanPreset);
    clickSave();

    expect(sent.update!.interestAmount).toBe(20000);
  });
});

describe("카테고리를 늦게 받을 때 — 받기 전 유지 · 받았는데 없으면 비움", () => {
  it("받기 전에는 읽어 온 카테고리를 유지한다 → 받은 뒤 저장하면 그대로 나간다", () => {
    catState.loaded = false;
    render(basePreset);
    catState.loaded = true;
    render(basePreset);
    clickSave();

    expect(sent.update!.categoryRowId).toBe(11);
    catState.loaded = true;
  });

  it("받았는데 목록에 없으면(지운 카테고리) 비운다 → 지운 id 가 저장되지 않는다", () => {
    catState.loaded = true;
    render({ ...basePreset, categoryRowId: 99, categoryName: "지운 카테고리" });
    clickSave();

    expect(sent.update).toBeNull();
  });
});

describe("자산을 받기 전에 저장해도 이자는 읽어 온 그대로 나간다 (요청 본문)", () => {
  it("자산 조회가 대기 중인 채 저장 → interestAmount 20000 유지", () => {
    assetState.loaded = false;
    render({
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
    });
    clickSave();

    expect(sent.update!.interestAmount).toBe(20000);
    assetState.loaded = true;
  });
});
