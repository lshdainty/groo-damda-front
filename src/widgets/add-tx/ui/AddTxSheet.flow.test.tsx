// 거래 추가 · 수정 폼의 **단계 흐름과 보내는 것** (I-21 D 19 ~ 25 · E 32 · 1-B).
//
// 새 거래는 ① 종류 칩 · 밑줄 금액 → [다음] → ② 거래처 · 줄 칸 → [추가] 두 단계, 수정은 2단계로 바로 열린다. 이 시험이 잠그는 것:
//   · [다음] · [추가] 는 켜 둔다 — 틀리면 요청 없이 그 칸 아래에 글을 보인다(누를 때 검증)
//   · 1단계 값은 ← 로 돌아와도 남는다
//   · 저장 본문은 지금 규칙 그대로(가진 칸만 · 외화는 `amount` = 원화 · `originalAmount` · `originalCurrency` · `exchangeRate`)
//   · 요청 실패는 호출처 `silent` 로 켠다 — 전역 서버 원문 토스트와 겹치지 않는다
//   · 프리셋: 금액이 있으면 2단계로 · 비었으면 1단계에 남는다 · 적용한 칩을 다시 누르면 표시만 풀린다
//   · 수정의 금액 단계는 "완료" 에 넣고 ← 는 버린다
//   · 프리셋 저장 단계의 금액은 줄 하나 — 0 이어도 저장되고 `lockAmount` 는 금액 유무로 정한다
// 시험은 작성만 한다(UI 이관이 끝날 때까지 돌리지 않는다 — 10-30 사용자).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetPointerBlockForTest } from "@/shared/lib/groo/pointer-block";
import {
  click,
  lastButton,
  row,
  setValue,
  setupFormDom,
  tick,
} from "@/widgets/calendar/ui/event-form/test-utils";
import type { Expense, ExpenseCategory } from "@/entities/expense";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const sent = vi.hoisted(() => ({
  create: null as Record<string, unknown> | null,
  update: null as Record<string, unknown> | null,
  preset: null as Record<string, unknown> | null,
  touched: [] as number[],
  calls: 0,
  /** 훅이 어떤 옵션으로 불렸나 — `silent` 를 켜야 전역 토스트가 겹치지 않는다 */
  opts: {} as Record<string, unknown>,
  snack: [] as string[],
}));
const state = vi.hoisted(() => ({
  presets: [] as Array<Record<string, unknown>>,
  categories: [] as Array<Record<string, unknown>>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, p?: Record<string, unknown>) =>
      p && "name" in p ? `${k}:${String(p.name)}` : k,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/shared/ds/snackbar", () => ({
  useSnackbar: () => ({
    show: (o: { message: string }) => sent.snack.push(o.message),
    dismiss: () => {},
  }),
}));
vi.mock("@/shared/lib/groo/hide-amounts", () => ({
  MaskAmount: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/features/expense", () => ({
  useLedgerResultToast: () => () => {},
  useReplaceExpense: (o: unknown) => {
    sent.opts.replace = o;
    return { mutate: () => {}, isPending: false, isError: false };
  },
  useExpenseCategories: () => ({
    data: state.categories,
    isPending: false,
    isError: false,
    refetch: () => {},
  }),
  useExpenseTemplates: () => ({
    data: state.presets,
    isPending: false,
    isError: false,
    refetch: () => {},
  }),
  useCreateExpense: (o: unknown) => {
    sent.opts.create = o;
    return {
      mutate: (data: Record<string, unknown>) => {
        sent.create = data;
        sent.calls += 1;
      },
      isPending: false,
      isError: false,
    };
  },
  useUpdateExpense: (o: unknown) => {
    sent.opts.update = o;
    return {
      mutate: ({ data }: { id: number; data: Record<string, unknown> }) => {
        sent.update = data;
        sent.calls += 1;
      },
      isPending: false,
      isError: false,
    };
  },
  useCreateExpenseTemplate: (o: unknown) => {
    sent.opts.preset = o;
    return {
      mutate: (
        data: Record<string, unknown>,
        cb?: { onSuccess?: () => void },
      ) => {
        sent.preset = data;
        cb?.onSuccess?.();
      },
      isPending: false,
      isError: false,
      reset: () => {},
    };
  },
  useTouchExpenseTemplate: () => ({
    mutate: (id: number) => sent.touched.push(id),
    isPending: false,
  }),
}));
vi.mock("@/features/asset", () => ({
  useAssets: () => ({
    data: { assets: [] },
    isPending: false,
    isError: false,
    refetch: () => {},
  }),
  useCreateTransfer: () => ({ mutate: () => {}, isPending: false }),
  useUpdateTransfer: () => ({ mutate: () => {}, isPending: false }),
}));
vi.mock("@/features/sms", () => ({
  parseSms: async () => ({ matched: false }),
  looksLikePaymentSms: () => true,
  useCommitSms: () => ({ mutate: () => {}, isPending: false, isError: false }),
}));
vi.mock("@/features/expense-split", () => ({
  useExpenseSplits: () => ({ data: [], isPending: false, isError: false }),
}));
vi.mock("@/features/expense-split/ui/SplitTxDialog", () => ({
  SplitTxDialog: () => null,
}));
const prefs = vi.hoisted(() => ({ defaultCurrency: "KRW" }));
vi.mock("@/features/user", () => ({
  useDefaultCurrency: () => prefs.defaultCurrency,
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
state.categories = [category as unknown as Record<string, unknown>];

const expense: Expense = {
  rowId: 5,
  categoryRowId: 11,
  assetRowId: null,
  assetName: null,
  expenseType: "EXPENSE",
  amount: 12000,
  description: "메모",
  expenseDate: "2026-10-22T19:40:00",
  merchant: "식당",
  isFixed: false,
  paymentMethod: null,
  installmentMonths: null,
  originalAmount: null,
  originalCurrency: null,
  exchangeRate: null,
  createAt: "2026-10-22T19:40:00",
  modifyAt: "2026-10-22T19:40:00",
} as unknown as Expense;

const { AddTxSheet } = await import("./AddTxSheet");

let container: HTMLDivElement;
let root: Root;

const open = async (props: Partial<Parameters<typeof AddTxSheet>[0]> = {}) => {
  await act(async () => {
    root.render(<AddTxSheet mobile onClose={() => {}} {...props} />);
  });
  await tick();
};
const amountInput = () =>
  document.body.querySelector<HTMLInputElement>(
    'input[aria-label="form.amount"]',
  )!;
const dialogText = () =>
  [...document.body.querySelectorAll("[role=dialog]")].slice(-1)[0]
    ?.textContent ?? "";
/** 글이 그 말로 시작하는 버튼 — 프리셋 칩은 이름 뒤에 금액이 붙는다 */
const pressStartingWith = async (prefix: string) => {
  const el = [...document.body.querySelectorAll("button")]
    .filter((b) => b.textContent?.startsWith(prefix))
    .slice(-1)[0];
  if (!el) throw new Error(`${prefix} 버튼을 찾지 못했다`);
  click(el);
  await tick();
};
const press = async (label: string) => {
  click(lastButton(label));
  await tick();
};

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  setupFormDom(false);
  __resetPointerBlockForTest();
  sent.create = sent.update = sent.preset = null;
  sent.touched = [];
  sent.calls = 0;
  sent.opts = {};
  sent.snack = [];
  state.presets = [];
  prefs.defaultCurrency = "KRW";
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  document.body.innerHTML = "";
});

describe("새 거래 — 1단계 · 2단계", () => {
  it("금액을 비운 채 [다음] 을 눌러도 막히지 않는다 — 2단계로 가지 않고 칸 아래에 글을 보인다", async () => {
    await open();
    expect(dialogText()).toContain("addTx.stepMeta");
    await press("addTx.next");
    expect(dialogText()).toContain("addTx.entryRequired");
    expect(dialogText()).not.toContain("addTx.category");
    expect(sent.calls).toBe(0);
  });

  it("[다음] 으로 2단계에 가고 ← 로 돌아와도 금액이 남는다", async () => {
    await open();
    setValue(amountInput(), "128000000");
    expect(amountInput().value).toBe("128,000,000");
    await press("addTx.next");
    expect(dialogText()).toContain("128,000,000원");
    expect(row("addTx.category")).toBeTruthy();
    click(
      document.body.querySelector<HTMLElement>(
        '[aria-label="topNavigation.back"], [data-slot=bottom-sheet-back]',
      )!,
    );
    await tick();
    expect(amountInput().value).toBe("128,000,000");
  });

  it("카테고리 없이 [추가] 를 누르면 요청 없이 그 줄 아래에 글이 뜬다", async () => {
    await open();
    setValue(amountInput(), "5000");
    await press("addTx.next");
    await press("addTx.add");
    expect(sent.calls).toBe(0);
    expect(dialogText()).toContain("addTx.errCategory");
  });

  it("카테고리를 고르고 [추가] — 본문은 지금 규칙 그대로이고 요청 실패는 호출처 silent 다", async () => {
    await open();
    setValue(amountInput(), "128000000");
    await press("addTx.next");
    click(row("addTx.category"));
    await tick();
    click(lastButton("식비"));
    await tick();
    await press("addTx.add");
    expect(sent.create).toMatchObject({
      amount: 128000000,
      categoryRowId: 11,
      expenseType: "EXPENSE",
      isFixed: false,
      originalAmount: null,
      originalCurrency: null,
      exchangeRate: null,
    });
    expect(sent.opts.create).toEqual({ silent: true });
  });

  it("[추가] 를 연타해도 거래는 한 번만 만들어진다 — 저장 잠금", async () => {
    await open();
    setValue(amountInput(), "5000");
    await press("addTx.next");
    click(row("addTx.category"));
    await tick();
    click(lastButton("식비"));
    await tick();
    click(lastButton("addTx.add"));
    click(lastButton("addTx.add"));
    await tick();
    expect(sent.calls).toBe(1);
  });
});

describe("외화 — 1단계 통화 칩 · 2단계 환율 칸", () => {
  it("설정의 기본 통화가 USD 면 칩이 먼저 USD 이고, 현지 금액 × 환율이 원화 금액이 된다", async () => {
    prefs.defaultCurrency = "USD";
    await open();
    const chip = document.body.querySelector<HTMLElement>(
      '[aria-label="addTx.currencyChip"]',
    )!;
    expect(chip.textContent).toContain("USD");
    setValue(amountInput(), "98765.43");
    expect(amountInput().value).toBe("98,765.43");
    await press("addTx.next");
    setValue(
      document.body.querySelector<HTMLInputElement>(
        'input[inputmode="decimal"]',
      )!,
      "1388.75",
    );
    await tick();
    expect(dialogText()).toContain("137,160,491원");
    click(row("addTx.category"));
    await tick();
    click(lastButton("식비"));
    await tick();
    await press("addTx.add");
    expect(sent.create).toMatchObject({
      amount: 137160491,
      originalAmount: 98765.43,
      originalCurrency: "USD",
      exchangeRate: 1388.75,
    });
  });

  it("환율도 원화 금액도 없으면 보내지 않고 환율 칸 아래에 글을 보인다", async () => {
    prefs.defaultCurrency = "USD";
    await open();
    setValue(amountInput(), "10");
    await press("addTx.next");
    click(row("addTx.category"));
    await tick();
    click(lastButton("식비"));
    await tick();
    await press("addTx.add");
    expect(sent.calls).toBe(0);
    expect(dialogText()).toContain("addTx.errFx");
  });
});

describe("프리셋", () => {
  const preset = (o: Record<string, unknown>) => ({
    rowId: 1,
    templateName: "점심",
    expenseType: "EXPENSE",
    categoryRowId: 11,
    assetRowId: null,
    toAssetRowId: null,
    merchant: "도시락",
    paymentMethod: null,
    description: null,
    isFixed: false,
    useCount: 3,
    lockAmount: "Y",
    amount: 9000,
    ...o,
  });

  it("금액이 있는 프리셋은 채우고 2단계로 간다 — 금액은 잠기지 않는다", async () => {
    state.presets = [preset({})];
    await open();
    await pressStartingWith("점심");
    expect(dialogText()).toContain("9,000원");
    expect(document.body.querySelector("[data-locked]")).toBeNull();
  });

  it("금액이 빈 프리셋은 1단계에 남아 금액 칸에 도움말을 보인다", async () => {
    state.presets = [preset({ lockAmount: "N", amount: null })];
    await open();
    await pressStartingWith("점심");
    expect(dialogText()).toContain("addTx.emptyPresetHint:점심");
    expect(dialogText()).toContain("addTx.stepMeta");
  });

  it("적용한 칩을 다시 누르면 표시만 풀리고 저장해도 사용 기록을 올리지 않는다", async () => {
    state.presets = [preset({ lockAmount: "N", amount: null })];
    await open();
    await pressStartingWith("점심");
    await pressStartingWith("점심");
    setValue(amountInput(), "4500");
    await press("addTx.next");
    await press("addTx.add");
    expect(sent.touched).toEqual([]);
  });
});

describe("수정 — 2단계로 바로", () => {
  it("금액은 줄 › 한 단계 — 완료에 넣고 ← 는 버린다", async () => {
    await open({ expense });
    expect(dialogText()).not.toContain("addTx.next");
    click(row("form.amount"));
    await tick();
    setValue(amountInput(), "45000");
    await press("done");
    expect(dialogText()).toContain("45,000원");
    click(row("form.amount"));
    await tick();
    setValue(amountInput(), "1");
    click(
      document.body.querySelector<HTMLElement>(
        "[data-slot=bottom-sheet-back]",
      )!,
    );
    await tick();
    expect(dialogText()).toContain("45,000원");
  });

  it("저장 본문에 고친 금액이 실리고 실패는 호출처 silent 다", async () => {
    await open({ expense });
    click(row("form.amount"));
    await tick();
    setValue(amountInput(), "45000");
    await press("done");
    await press("save");
    expect(sent.update).toMatchObject({ amount: 45000, categoryRowId: 11 });
    expect(sent.opts.update).toEqual({ silent: true });
  });

  it("같은 제목의 다른 거래를 열면 그 거래의 값으로 새로 채워진다", async () => {
    await open({ expense });
    const other = { ...expense, rowId: 6, amount: 777 } as Expense;
    await open({ expense: other });
    expect(dialogText()).toContain("777원");
    await press("save");
    expect(sent.update).toMatchObject({ amount: 777 });
  });
});

describe("프리셋으로 저장 — 같은 시트 안 한 단계", () => {
  it("금액이 있으면 lockAmount Y, 금액을 비우면 N 으로 저장되고 알림이 뜬다", async () => {
    await open();
    setValue(amountInput(), "7000");
    await press("addTx.next");
    click(row("addTx.category"));
    await tick();
    click(lastButton("식비"));
    await tick();
    click(
      document.body.querySelector<HTMLElement>(
        "[data-slot=bottom-sheet-back]",
      )!,
    );
    await tick();
    await press("addTx.saveCurrentInput");
    expect(dialogText()).toContain("savePreset.title");
    expect(document.body.querySelector('input[type="checkbox"]')).toBeNull();
    const name = document.body.querySelector<HTMLInputElement>(
      "[role=dialog] input:not([type=hidden])",
    )!;
    setValue(name, "도시락");
    await press("save");
    expect(sent.preset).toMatchObject({
      templateName: "도시락",
      amount: 7000,
      lockAmount: "Y",
    });
    expect(sent.snack[0]).toContain("savePreset.saved:도시락");
  });

  it("카테고리가 없으면 [저장] 을 눌렀을 때 글을 보이고 요청하지 않는다", async () => {
    await open();
    setValue(amountInput(), "7000");
    await press("addTx.saveCurrentInput");
    const name = document.body.querySelector<HTMLInputElement>(
      "[role=dialog] input:not([type=hidden])",
    )!;
    setValue(name, "이름");
    await press("save");
    expect(sent.preset).toBeNull();
    expect(dialogText()).toContain("savePreset.needCategory");
  });
});

describe("저장 본문 — 가진 칸만 싣고 비운 칸은 null (QA #107 · #108)", () => {
  it("거래처 · 메모를 비우고 저장하면 null 이 나간다", async () => {
    await open({ expense });
    const merchant = [...document.body.querySelectorAll("input")].find(
      (i) => i.value === "식당",
    )!;
    setValue(merchant, "");
    click(row("addTx.memo"));
    await tick();
    setValue(
      document.body.querySelector<HTMLTextAreaElement>(
        "[role=dialog] textarea",
      )!,
      "",
    );
    await press("done");
    await press("save");
    expect(sent.update).toMatchObject({ merchant: null, description: null });
  });

  it("고정 스위치를 켜고 저장하면 고정으로 나간다", async () => {
    await open({ expense });
    const sw = document.body.querySelector<HTMLElement>('[role="switch"]')!;
    click(sw);
    await tick();
    await press("save");
    expect(sent.update).toMatchObject({ isFixed: true });
  });

  it("거래처 칸에서 Enter 를 누르면 저장되고 연타해도 한 번만 나간다(QA #132 · #122)", async () => {
    await open({ expense });
    const merchant = [...document.body.querySelectorAll("input")].find(
      (i) => i.value === "식당",
    )!;
    const enter = () =>
      act(() =>
        merchant.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        ),
      );
    await enter();
    await enter();
    expect(sent.calls).toBe(1);
  });
});

describe("호스트 시트 안에 한 단계로 끼우기 (I-21 7a)", () => {
  it("embed 로 조각을 받아 호스트가 그리고, ← 는 onBack(상세로), 저장은 onSaved 를 부른다", async () => {
    const calls: string[] = [];
    await act(async () => {
      root.render(
        <AddTxSheet
          mobile
          expense={expense}
          onClose={() => calls.push("close")}
          onBack={() => calls.push("back")}
          onSaved={() => calls.push("saved")}
          embed={(p) => (
            <div data-testid="host">
              <h2>{p.title}</h2>
              {p.body}
              <button type="button" onClick={p.onBack}>
                host-back
              </button>
              {p.footer}
            </div>
          )}
        />,
      );
    });
    await tick();
    // 자기 표면(dialog)을 그리지 않는다
    expect(document.body.querySelector("[role=dialog]")).toBeNull();
    expect(document.body.textContent).toContain("addTx.editTitle");
    await press("host-back");
    expect(calls).toEqual(["back"]);
  });
});
