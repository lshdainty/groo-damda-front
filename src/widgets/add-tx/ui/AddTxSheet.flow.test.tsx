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
import * as React from "react";
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
  /** 문자 전용 저장 경로(`/import/sms/commit`)로 나간 본문(QA #123) */
  sms: null as Record<string, unknown> | null,
  transfer: null as Record<string, unknown> | null,
  transferUpdate: null as Record<string, unknown> | null,
  /** 훅이 어떤 옵션으로 불렸나 — `silent` 를 켜야 전역 토스트가 겹치지 않는다 */
  opts: {} as Record<string, unknown>,
  snack: [] as string[],
}));
const state = vi.hoisted(() => ({
  presets: [] as Array<Record<string, unknown>>,
  categories: [] as Array<Record<string, unknown>>,
  assets: [] as Array<Record<string, unknown>>,
  /** 자산 · 카테고리 목록이 아직 안 왔다 — refetch 가 오면 풀린다 */
  listsLate: false,
  /** 받아 오기가 실패한다 */
  refetchFails: false,
  /** 자산 조회가 받은 목록 없이 실패한 상태 */
  assetsFailed: false,
  /** 문자 해석 결과 — 없으면 못 알아본 문자 */
  parsed: null as Record<string, unknown> | null,
  /** 거래 고치기의 지난 실패(없으면 실패 아님) */
  updateError: null as unknown,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, p?: Record<string, unknown>) =>
      p && "name" in p
        ? `${k}:${String(p.name)}`
        : // 환율 안내는 값을 이어 붙여 보인다 — 칸 · 안내 · 원화 줄이 같은 값인지 잰다
          p && "rate" in p
          ? `${k}:${String(p.original)} × ${String(p.rate)} = ${String(p.krw)}`
          : k,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/shared/ds/snackbar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/ds/snackbar")>()),
  useSnackbar: () => ({
    show: (o: { message: string }) => sent.snack.push(o.message),
    dismiss: () => {},
  }),
}));
vi.mock("@/shared/lib/groo/hide-amounts", () => ({
  MaskAmount: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  HideUnit: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/features/expense", () => ({
  useLedgerResultToast: () => () => {},
  useReplaceExpense: (o: unknown) => {
    sent.opts.replace = o;
    return {
      mutate: () => {},
      isPending: false,
      isError: false,
      reset: () => {},
    };
  },
  useExpenseCategories: () => ({
    data: state.listsLate ? undefined : state.categories,
    isPending: state.listsLate,
    isError: false,
    refetch: async () => {
      if (!state.refetchFails) state.listsLate = false;
      return { data: state.refetchFails ? undefined : state.categories };
    },
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
      reset: () => {},
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
      isError: state.updateError != null,
      error: state.updateError,
      reset: () => {},
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
    data:
      state.listsLate || state.assetsFailed
        ? undefined
        : { assets: state.assets },
    isPending: state.listsLate && !state.assetsFailed,
    isError: state.assetsFailed,
    isFetching: false,
    refetch: async () => {
      if (!state.refetchFails) state.listsLate = false;
      return {
        data: state.refetchFails ? undefined : { assets: state.assets },
      };
    },
  }),
  useCreateTransfer: () => ({
    mutate: (
      data: Record<string, unknown>,
      opts?: { onSuccess?: () => void },
    ) => {
      sent.transfer = data;
      sent.calls += 1;
      opts?.onSuccess?.();
    },
    isPending: false,
    isError: false,
    reset: () => {},
  }),
  useUpdateTransfer: () => ({
    mutate: ({ data }: { data: Record<string, unknown> }) => {
      sent.transferUpdate = data;
      sent.calls += 1;
    },
    isPending: false,
    isError: false,
    reset: () => {},
  }),
}));
vi.mock("@/features/sms", () => ({
  parseSms: async () => state.parsed ?? { matched: false },
  looksLikePaymentSms: () => true,
  useCommitSms: () => ({
    mutate: (data: Record<string, unknown>) => {
      sent.sms = data;
      sent.calls += 1;
    },
    isPending: false,
    isError: false,
    reset: () => {},
  }),
}));
vi.mock("@/features/expense-split", () => ({
  useReplaceExpenseSplits: () => ({
    mutateAsync: async () => ({}),
    isPending: false,
  }),
  useDeleteAllExpenseSplits: () => ({
    mutateAsync: async () => ({}),
    isPending: false,
  }),
  useExpenseSplits: () => ({ data: [], isPending: false, isError: false }),
}));
const prefs = vi.hoisted(() => ({ defaultCurrency: "KRW" }));
vi.mock("@/features/user", () => ({
  useDefaultCurrencyState: () => ({
    currency: prefs.defaultCurrency,
    ready: true,
    ensure: async () => true,
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
const incomeCategory = {
  ...category,
  rowId: 21,
  categoryName: "환불",
  expenseType: "INCOME",
};
state.categories = [
  category as unknown as Record<string, unknown>,
  incomeCategory,
];
const asset = (rowId: number, assetName: string, assetType: string) => ({
  rowId,
  assetName,
  assetType,
  institution: null,
  balance: 0,
  isIncludedInTotal: "Y",
  sortOrder: rowId,
});

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
const { useTxForm } = await import("../model/use-tx-form");
const { useTxSheetParts } = await import("./use-tx-sheet-parts");

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
/** 거래 폼 표면의 글 — 2단계 머리(addTx.stepMeta)를 가진 표면 */
const formText = () =>
  [...document.body.querySelectorAll("[role=dialog]")].find((d) =>
    d.textContent?.includes("addTx.stepMeta"),
  )?.textContent ?? "";
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
  sent.create =
    sent.update =
    sent.preset =
    sent.sms =
    sent.transfer =
    sent.transferUpdate =
      null;
  state.listsLate = false;
  state.refetchFails = false;
  state.assetsFailed = false;
  state.parsed = null;
  state.updateError = null;
  state.assets = [];
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
    // 카테고리 고르기 표면이 닫히는 중이라 맨 뒤 [role=dialog] 가 아직 그것일 수 있다 — 폼 쪽에서 본다
    expect(formText()).toContain("addTx.errFx");
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
    // 바뀐 값이 있으면 ← 는 먼저 묻는다(useLeaveConfirm) — [나가기] 로 버린다
    expect(
      document.body.querySelector("[role=alertdialog]")?.textContent,
    ).toContain("작성한 내용이 사라져요");
    await press("나가기");
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

describe("이체 프리셋 저장 — 이자는 대출 상환에만, 금액을 비우면 이자도 비운다 (2026-09-15 결정)", () => {
  /** 이체 칩 → 금액 → [다음] → 보내는 · 받는 계좌 고르기 */
  const fillTransfer = async (toName: string) => {
    state.assets = [
      asset(1, "주거래", "BANK_ACCOUNT"),
      asset(2, "비상금", "BANK_ACCOUNT"),
      asset(3, "전세대출", "LOAN"),
    ];
    await open();
    click(lastButton("addTx.transfer"));
    await tick();
    setValue(amountInput(), "500000");
    await press("addTx.next");
    click(row("addTx.fromAccountRow"));
    await tick();
    click(lastButton("주거래"));
    await tick();
    click(row("addTx.toAccount"));
    await tick();
    click(lastButton(toName));
    await tick();
  };
  const toPresetStep = async () => {
    click(
      document.body.querySelector<HTMLElement>(
        "[data-slot=bottom-sheet-back]",
      )!,
    );
    await tick();
    await press("addTx.saveCurrentInput");
    setValue(
      document.body.querySelector<HTMLInputElement>(
        "[role=dialog] input:not([type=hidden])",
      )!,
      "대출 상환",
    );
  };

  it("받는 계좌가 대출이면 이자 줄이 생기고, 금액을 함께 저장하면 이자도 실린다", async () => {
    await fillTransfer("전세대출");
    click(row("addTx.interest"));
    await tick();
    setValue(
      document.body.querySelector<HTMLInputElement>(
        'input[aria-label="addTx.interest"]',
      )!,
      "20000",
    );
    await press("done");
    await toPresetStep();
    await press("save");
    expect(sent.preset).toMatchObject({
      expenseType: "TRANSFER",
      amount: 500000,
      lockAmount: "Y",
      interestAmount: 20000,
      assetRowId: 1,
      toAssetRowId: 3,
    });
  });

  it("금액을 비워 저장하면 이자도 보내지 않는다 — 매달 달라지는 값이라 박아 두면 틀리다", async () => {
    await fillTransfer("전세대출");
    click(row("addTx.interest"));
    await tick();
    setValue(
      document.body.querySelector<HTMLInputElement>(
        'input[aria-label="addTx.interest"]',
      )!,
      "20000",
    );
    await press("done");
    await toPresetStep();
    click(row("savePreset.amountRow"));
    await tick();
    setValue(
      document.body.querySelector<HTMLInputElement>(
        'input[aria-label="savePreset.amountRow"]',
      )!,
      "",
    );
    await press("done");
    await press("save");
    expect(sent.preset).toMatchObject({ lockAmount: "N" });
    expect(sent.preset!.interestAmount).toBeUndefined();
    expect(sent.preset!.amount).toBeUndefined();
  });

  it("받는 계좌가 대출이 아니면 이자 줄이 없고 이자도 실리지 않는다", async () => {
    await fillTransfer("비상금");
    expect(document.body.textContent).not.toContain("addTx.interest");
    await toPresetStep();
    await press("save");
    expect(sent.preset!.interestAmount).toBeUndefined();
  });
});

describe("결제 문자에서 온 내역의 거래 종류 (QA #123)", () => {
  const parsed = {
    matched: true,
    confidence: "HIGH",
    cancel: false,
    amount: 5500,
    merchant: "스타벅스",
    expenseDate: "2026-10-22T10:00:00",
    installmentMonths: null,
    cardHint: null,
    assetRowId: null,
    assetRemembered: false,
    categoryRowId: 11,
    originalAmount: null,
    originalCurrency: null,
  };
  const readSms = async () => {
    state.parsed = parsed;
    await open();
    await pressStartingWith("sms.pasteOpen");
    setValue(
      document.body.querySelector<HTMLTextAreaElement>(
        "[role=dialog] textarea",
      )!,
      "[Web발신] KB국민 5,500원 스타벅스",
    );
    await press("sms.pasteAction");
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  };

  it("그대로 두면 지출로 나간다 — 종류를 한쪽으로 박아 둔 게 아니다", async () => {
    await readSms();
    await press("addTx.add");
    expect(sent.sms).toMatchObject({ expenseType: "EXPENSE", amount: 5500 });
    expect(String(sent.sms!.text)).toContain("스타벅스");
  });

  it("1단계로 돌아가 수입으로 고쳐 저장하면 수입으로 나간다", async () => {
    await readSms();
    click(
      document.body.querySelector<HTMLElement>(
        "[data-slot=bottom-sheet-back]",
      )!,
    );
    await tick();
    click(lastButton("income"));
    await tick();
    await press("addTx.next");
    // 종류를 바꾸면 그 종류에 없는 카테고리는 풀린다 — 수입 카테고리를 다시 고른다
    click(row("addTx.category"));
    await tick();
    click(lastButton("환불"));
    await tick();
    await press("addTx.add");
    expect(sent.sms).toMatchObject({ expenseType: "INCOME", amount: 5500 });
  });

  it("2단계에서 바로 수입으로 바꿀 수 있다 — 지출 · 수입 칩이 있고 이체 칩은 막힌다", async () => {
    await readSms();
    const radios = [
      ...document.body.querySelectorAll<HTMLElement>('[role="radio"]'),
    ];
    expect(radios.map((r) => r.textContent)).toEqual([
      "expense",
      "income",
      "addTx.transfer",
    ]);
    expect((radios[2] as HTMLButtonElement).disabled).toBe(true);
    click(lastButton("income"));
    await tick();
    click(row("addTx.category"));
    await tick();
    click(lastButton("환불"));
    await tick();
    await press("addTx.add");
    expect(sent.sms).toMatchObject({ expenseType: "INCOME" });
  });

  it("문자 초안에는 고정 스위치가 없다 — 저장 경로가 표식을 못 받는다", async () => {
    await open();
    expect(document.body.querySelector('[role="switch"]')).toBeNull();
    await readSms();
    expect(document.body.querySelector('[role="switch"]')).toBeNull();
  });
});

describe("외화 — 원화 금액 줄은 원화만 고친다 (H1)", () => {
  it("$5.50 · 환율 1,350 거래의 청구액을 7,500 으로 고쳐도 현지 금액 · 환율은 그대로다", async () => {
    prefs.defaultCurrency = "USD";
    await open();
    setValue(amountInput(), "5.50");
    await press("addTx.next");
    setValue(
      document.body.querySelector<HTMLInputElement>(
        'input[inputmode="decimal"]',
      )!,
      "1350",
    );
    await tick();
    expect(dialogText()).toContain("7,425원");
    click(row("addTx.krwAmount"));
    await tick();
    // 원화 줄 전용 칸 — 통화 칩이 없고 값은 원화다
    const krw = document.body.querySelector<HTMLInputElement>(
      'input[aria-label="addTx.krwAmount"]',
    )!;
    expect(krw.value).toBe("7,425");
    expect(
      document.body.querySelector('[aria-label="addTx.currencyChip"]'),
    ).toBeNull();
    setValue(krw, "7500");
    await press("done");
    expect(dialogText()).toContain("7,500원");
    click(row("addTx.category"));
    await tick();
    click(lastButton("식비"));
    await tick();
    await press("addTx.add");
    expect(sent.create).toMatchObject({
      amount: 7500,
      originalAmount: 5.5,
      originalCurrency: "USD",
      exchangeRate: 1350,
    });
  });

  it("환율을 모르면 원화 금액만 넣어도 저장된다", async () => {
    prefs.defaultCurrency = "USD";
    await open();
    setValue(amountInput(), "5.50");
    await press("addTx.next");
    click(row("addTx.krwAmount"));
    await tick();
    setValue(
      document.body.querySelector<HTMLInputElement>(
        'input[aria-label="addTx.krwAmount"]',
      )!,
      "7500",
    );
    await press("done");
    click(row("addTx.category"));
    await tick();
    click(lastButton("식비"));
    await tick();
    await press("addTx.add");
    expect(sent.create).toMatchObject({
      amount: 7500,
      originalAmount: 5.5,
      originalCurrency: "USD",
    });
  });
});

describe("고칠 수 있는 거절은 서버에 가기 전에 칸 오류로 막는다 (M4)", () => {
  it("이자가 금액보다 크면 보내지 않고 이자 줄 아래에 글을 보인다", async () => {
    state.assets = [
      asset(1, "주거래", "BANK_ACCOUNT"),
      asset(3, "전세대출", "LOAN"),
    ];
    await open();
    click(lastButton("addTx.transfer"));
    await tick();
    setValue(amountInput(), "100000");
    await press("addTx.next");
    click(row("addTx.fromAccountRow"));
    await tick();
    click(lastButton("주거래"));
    await tick();
    click(row("addTx.toAccount"));
    await tick();
    click(lastButton("전세대출"));
    await tick();
    click(row("addTx.interest"));
    await tick();
    setValue(
      document.body.querySelector<HTMLInputElement>(
        'input[aria-label="addTx.interest"]',
      )!,
      "200000",
    );
    await press("done");
    await press("addTx.add");
    expect(sent.calls).toBe(0);
    expect(dialogText()).toContain("addTx.errInterest");
  });

  it("이미 있는 프리셋 이름이면 저장하지 않고 이름 칸 아래에 글을 보인다", async () => {
    state.presets = [
      {
        rowId: 1,
        templateName: "점심",
        expenseType: "EXPENSE",
        categoryRowId: 11,
        lockAmount: "N",
        amount: null,
        useCount: 1,
      },
    ];
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
    setValue(
      document.body.querySelector<HTMLInputElement>(
        "[role=dialog] input:not([type=hidden])",
      )!,
      "점심",
    );
    await press("save");
    expect(sent.preset).toBeNull();
    expect(dialogText()).toContain("savePreset.nameDuplicate");
  });
});

describe("한글 조합 중 Enter 는 저장하지 않는다 (L2)", () => {
  it("조합 중 Enter 는 무시하고 조합이 끝난 Enter 만 저장한다", async () => {
    await open({ expense });
    const merchant = [...document.body.querySelectorAll("input")].find(
      (i) => i.value === "식당",
    )!;
    await act(async () => {
      merchant.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          isComposing: true,
        }),
      );
    });
    expect(sent.calls).toBe(0);
    await act(async () => {
      merchant.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    });
    expect(sent.calls).toBe(1);
  });
});

describe("기본 통화 (QA #124 · D7)", () => {
  it("설정이 늦게 도착해도 첫 렌더의 원화에 잠기지 않는다", async () => {
    await open();
    expect(
      document.body.querySelector('[aria-label="addTx.currencyChip"]')!
        .textContent,
    ).toContain("KRW");
    prefs.defaultCurrency = "USD";
    await open();
    expect(
      document.body.querySelector('[aria-label="addTx.currencyChip"]')!
        .textContent,
    ).toContain("USD");
  });

  it("수정은 그 거래의 값으로 연다 — 기본 통화가 USD 여도 원화 거래가 해외 결제로 열리지 않는다", async () => {
    prefs.defaultCurrency = "USD";
    await open({ expense });
    expect(dialogText()).toContain("12,000원");
    expect(dialogText()).not.toContain("addTx.fxRateLabel");
  });

  it("기본 통화가 외화여도 현지 금액을 안 적으면 외화 셋이 모두 null 로 나간다", async () => {
    prefs.defaultCurrency = "USD";
    await open();
    // 칩을 원화로 돌려 일반 거래로 저장 — 외화 입력이 흘러들지 않는다
    click(
      document.body.querySelector<HTMLElement>(
        '[aria-label="addTx.currencyChip"]',
      )!,
    );
    await tick();
    click(lastButton("₩ KRW"));
    await tick();
    setValue(amountInput(), "5000");
    await press("addTx.next");
    click(row("addTx.category"));
    await tick();
    click(lastButton("식비"));
    await tick();
    await press("addTx.add");
    expect(sent.create).toMatchObject({
      amount: 5000,
      originalAmount: null,
      originalCurrency: null,
      exchangeRate: null,
    });
  });
});

describe("프리셋 칩은 지금 종류의 것만 보여 준다", () => {
  const p = (rowId: number, templateName: string, expenseType: string) => ({
    rowId,
    templateName,
    expenseType,
    categoryRowId: 11,
    assetRowId: null,
    toAssetRowId: null,
    merchant: null,
    paymentMethod: null,
    description: null,
    isFixed: false,
    useCount: 5 - rowId,
    lockAmount: "N",
    amount: null,
  });
  beforeEach(() => {
    state.presets = [
      p(1, "점심칩", "EXPENSE"),
      p(2, "월급칩", "INCOME"),
      p(3, "적금칩", "TRANSFER"),
    ];
  });
  const chips = () => document.body.textContent ?? "";

  it("지출 — 지출 프리셋만", async () => {
    await open();
    expect(chips()).toContain("점심칩");
    expect(chips()).not.toContain("월급칩");
    expect(chips()).not.toContain("적금칩");
  });

  it("수입 — 수입 프리셋만", async () => {
    await open();
    click(lastButton("income"));
    await tick();
    expect(chips()).toContain("월급칩");
    expect(chips()).not.toContain("점심칩");
  });

  it("이체 — 이체 프리셋만(칩 줄 자체는 뜬다)", async () => {
    await open();
    click(lastButton("addTx.transfer"));
    await tick();
    expect(chips()).toContain("적금칩");
    expect(chips()).not.toContain("점심칩");
  });
});

describe("이체 프리셋 사용 기록 (#174)", () => {
  it("칩으로 채워 이체를 저장하면 사용 기록이 오른다 — 지출 · 수입과 같은 규칙", async () => {
    state.assets = [
      asset(1, "주거래", "BANK_ACCOUNT"),
      asset(2, "비상금", "BANK_ACCOUNT"),
    ];
    state.presets = [
      {
        rowId: 7,
        templateName: "적금칩",
        expenseType: "TRANSFER",
        categoryRowId: null,
        assetRowId: 1,
        toAssetRowId: 2,
        fee: null,
        interestAmount: null,
        merchant: null,
        paymentMethod: null,
        description: null,
        isFixed: false,
        useCount: 1,
        lockAmount: "Y",
        amount: 100000,
      },
    ];
    await open();
    click(lastButton("addTx.transfer"));
    await tick();
    await pressStartingWith("적금칩");
    await press("addTx.add");
    expect(sent.transfer).toMatchObject({
      fromAssetRowId: 1,
      toAssetRowId: 2,
      amount: 100000,
    });
    expect(sent.touched).toEqual([7]);
  });
});

describe("환율 칸 — 보이는 값에만 천 단위 쉼표, 보내는 값은 쉼표 없는 숫자 (I-21 D 22)", () => {
  const rateInput = () =>
    document.body.querySelector<HTMLInputElement>(
      'input[inputmode="decimal"]',
    )!;

  it("1388.75 를 치면 칸에는 1,388.75 로 보이고, 요청 본문 exchangeRate 는 쉼표 없는 숫자 1388.75 다", async () => {
    prefs.defaultCurrency = "USD";
    await open();
    setValue(amountInput(), "98765.43");
    await press("addTx.next");
    setValue(rateInput(), "1388.75");
    await tick();
    expect(rateInput().value).toBe("1,388.75");
    // 환율 안내 · 원화 금액도 같은 값
    expect(dialogText()).toContain("× 1,388.75");
    expect(dialogText()).toContain("137,160,491원");
    click(row("addTx.category"));
    await tick();
    click(lastButton("식비"));
    await tick();
    await press("addTx.add");
    expect(sent.create).toMatchObject({
      exchangeRate: 1388.75,
      originalAmount: 98765.43,
    });
    expect(typeof sent.create!.exchangeRate).toBe("number");
  });

  it("쉼표를 붙여 넣어도 지우고 숫자로 보낸다", async () => {
    prefs.defaultCurrency = "USD";
    await open();
    setValue(amountInput(), "10");
    await press("addTx.next");
    setValue(rateInput(), "1,388.75");
    await tick();
    expect(rateInput().value).toBe("1,388.75");
    click(row("addTx.category"));
    await tick();
    click(lastButton("식비"));
    await tick();
    await press("addTx.add");
    expect(sent.create).toMatchObject({ exchangeRate: 1388.75 });
  });

  it("수정 폼으로 다시 열어도 환율이 쉼표로 보이고 그대로 다시 저장된다", async () => {
    const foreign = {
      ...expense,
      amount: 137160491,
      originalAmount: 98765.43,
      originalCurrency: "USD",
      exchangeRate: 1388.75,
    } as Expense;
    await open({ expense: foreign });
    expect(rateInput().value).toBe("1,388.75");
    await press("save");
    expect(sent.update).toMatchObject({
      exchangeRate: 1388.75,
      originalAmount: 98765.43,
    });
  });
});

describe("이체 수정의 종류 칩은 셋이고 이체만 고른 채 나머지는 막힌다 (D 25)", () => {
  it("지출 · 수입은 막혀 있고 이체가 고른 칩이다", async () => {
    state.assets = [
      asset(1, "주거래", "BANK_ACCOUNT"),
      asset(2, "비상금", "BANK_ACCOUNT"),
    ];
    await open({
      editTransfer: {
        rowId: 7,
        fromAssetRowId: 1,
        toAssetRowId: 2,
        amount: 300000,
        fee: 0,
        interestAmount: 0,
        description: null,
        transferDate: "2026-10-28T12:00:00",
      } as never,
    });
    const radios = [
      ...document.body.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
    ];
    expect(radios.map((r) => r.textContent)).toEqual([
      "expense",
      "income",
      "addTx.transfer",
    ]);
    expect(radios.map((r) => r.disabled)).toEqual([true, true, false]);
    expect(radios[2]!.getAttribute("aria-checked")).toBe("true");
  });
});

describe("자산 · 카테고리 목록을 받기 전 · 실패한 채 수정해도 읽어 온 값을 잃지 않는다 (N1)", () => {
  const card = asset(9, "현대카드", "CREDIT_CARD");
  const installment = {
    ...expense,
    assetRowId: 9,
    paymentMethod: "CARD",
    installmentMonths: 12,
  } as Expense;
  const settle = async () => {
    await tick();
    await tick();
  };

  it("목록이 오기 전에 메모만 고쳐 저장하면 본문에 installmentMonths 12 · 카테고리 · 계좌가 그대로 실린다", async () => {
    state.assets = [card];
    state.listsLate = true;
    await open({ expense: installment });
    await press("save");
    await settle();
    expect(sent.update).toMatchObject({
      installmentMonths: 12,
      assetRowId: 9,
      categoryRowId: 11,
    });
  });

  it("대출 이체의 이자도 목록이 오기 전 저장에서 지워지지 않는다", async () => {
    state.assets = [
      asset(1, "주거래", "BANK_ACCOUNT"),
      asset(3, "전세대출", "LOAN"),
    ];
    state.listsLate = true;
    await open({
      editTransfer: {
        rowId: 7,
        fromAssetRowId: 1,
        toAssetRowId: 3,
        amount: 1000000,
        fee: 0,
        interestAmount: 50000,
        description: null,
        transferDate: "2026-10-28T12:00:00",
      } as never,
    });
    await press("save");
    await settle();
    expect(sent.transferUpdate).toMatchObject({
      toAssetRowId: 3,
      interestAmount: 50000,
    });
  });

  it("목록을 끝내 못 받으면 요청을 보내지 않고 맨 위 알림을 띄운다 — 값을 추측해 보내지 않는다", async () => {
    state.assets = [card];
    state.listsLate = true;
    state.refetchFails = true;
    await open({ expense: installment });
    await press("save");
    await settle();
    expect(sent.calls).toBe(0);
    // 목록을 못 받아 막은 저장은 "참조를 못 받았다" 고정 글이다(e6db3a35) — 저장 실패 글과 갈린다
    expect(dialogText()).toContain("query.referenceSaveFailed");
  });
});

describe("계좌 고르기 — 받는 중 · 못 받음을 빈 목록과 가른다 (B2-6)", () => {
  const sheetText = () =>
    [...document.body.querySelectorAll("[role=dialog]")].slice(-1)[0]
      ?.textContent ?? "";
  const toAccountPick = async () => {
    await open();
    setValue(amountInput(), "5000");
    await press("addTx.next");
    click(row("addTx.account"));
    await tick();
  };

  it("못 받았으면 실패 + [다시 시도] — 빈 글 · 계좌 없음 줄이 아니다", async () => {
    state.assetsFailed = true;
    await toAccountPick();
    expect(sheetText()).toContain("addTx.assetLoadFailed");
    expect(sheetText()).toContain("loadFailedDesc");
    expect(sheetText()).not.toContain("addTx.noPickableAsset");
    expect(sheetText()).not.toContain("addTx.noAccountOption");
    expect(lastButton("retry")).toBeTruthy();
  });

  it("받는 중이면 Skeleton — 실패도 빈 글도 아니다", async () => {
    state.listsLate = true;
    await toAccountPick();
    const sheet = [...document.body.querySelectorAll("[role=dialog]")].slice(
      -1,
    )[0]!;
    expect(sheet.querySelector("[data-slot=pick-skeleton]")).not.toBeNull();
    expect(sheetText()).not.toContain("addTx.assetLoadFailed");
    expect(sheetText()).not.toContain("addTx.noPickableAsset");
  });
});

describe("목록에 없는 값 — 새로 채운 값은 비우고, 읽어 온 값은 기록이라 지운 이름으로 보인다 (N4)", () => {
  it('거래에서 읽어 온 지운 계좌는 "지운 계좌" 로 보이고 본문은 그 id 그대로다', async () => {
    state.assets = [];
    await open({ expense: { ...expense, assetRowId: 99 } as Expense });
    expect(dialogText()).toContain("addTx.deletedAsset");
    await press("save");
    expect(sent.update).toMatchObject({ assetRowId: 99 });
  });

  it("프리셋이 가리키던 지운 계좌는 비우고 칸 오류가 아니라 계좌 없음으로 둔다", async () => {
    state.assets = [];
    state.presets = [
      {
        rowId: 1,
        templateName: "점심",
        expenseType: "EXPENSE",
        categoryRowId: 11,
        assetRowId: 99,
        lockAmount: "Y",
        amount: 9000,
        useCount: 1,
        merchant: null,
        paymentMethod: null,
        description: null,
        isFixed: false,
        toAssetRowId: null,
      },
    ];
    await open();
    await pressStartingWith("점심");
    await tick();
    expect(dialogText()).not.toContain("addTx.deletedAsset");
    click(row("addTx.category"));
    await tick();
    click(lastButton("식비"));
    await tick();
    await press("addTx.add");
    expect(sent.create).toMatchObject({ assetRowId: null });
  });
});

describe("호스트가 폼을 든 채 한 단계로 보인다 — 실제 폼 (I-21 7a)", () => {
  /** 상세 같은 호스트 — 폼을 한 번 들고 [수정] 때 그 거래로 갈아 끼운다 */
  function Host({
    onBack,
    onSaved,
  }: {
    onBack: () => void;
    onSaved: (e: Expense) => void;
  }) {
    const [seed, setSeed] = React.useState<Expense | null>(null);
    const f = useTxForm({
      expense: seed ?? undefined,
      onClose: onBack,
      onSaved,
    });
    const parts = useTxSheetParts(f, {
      mobile: true,
      embedded: true,
      onClose: onBack,
      onBack,
    });
    return (
      <div>
        <button
          type="button"
          onClick={() => {
            setSeed(expense);
            f.beginEdit({ expense });
          }}
        >
          open-edit
        </button>
        <button
          type="button"
          onClick={() => {
            const other = { ...expense, rowId: 6, amount: 777 } as Expense;
            setSeed(other);
            f.beginEdit({ expense: other });
          }}
        >
          open-other
        </button>
        {seed && (
          <section data-testid="host-form">
            <h2>{parts.embedParts.title}</h2>
            {parts.embedParts.body}
            {parts.embedParts.footer(parts.embedParts.onBack)}
          </section>
        )}
        {parts.overlays}
      </div>
    );
  }

  it("[수정] 으로 폼을 그 거래로 갈아 끼우고, 다른 거래를 열면 그 거래의 값으로 다시 채워진다", async () => {
    await act(async () => {
      root.render(<Host onBack={() => {}} onSaved={() => {}} />);
    });
    click(lastButton("open-edit"));
    await tick();
    expect(dialogTextOf("host-form")).toContain("12,000원");
    click(lastButton("open-other"));
    await tick();
    expect(dialogTextOf("host-form")).toContain("777원");
    await press("save");
    expect(sent.update).toMatchObject({ amount: 777 });
  });

  it("저장 응답을 못 읽었으면(PARSE) '저장됐는지 확인하지 못했어요', 그 밖의 실패는 '저장하지 못했어요'", async () => {
    const { WriteUnconfirmedError } = await import("@/shared/api");
    state.updateError = new WriteUnconfirmedError(200);
    await act(async () => {
      root.render(<Host onBack={() => {}} onSaved={() => {}} />);
    });
    click(lastButton("open-edit"));
    await tick();
    expect(dialogTextOf("host-form")).toContain("query.saveUnconfirmed");
    expect(dialogTextOf("host-form")).not.toContain("addTx.saveFailed");
    state.updateError = Object.assign(new Error("500"), {
      response: { status: 500 },
    });
    await act(async () => {
      root.render(<Host onBack={() => {}} onSaved={() => {}} />);
    });
    await tick();
    expect(dialogTextOf("host-form")).toContain("addTx.saveFailed");
    state.updateError = null;
  });

  it("저장 실패 뒤 다시 [수정] 하면 지난 실패 알림이 남아 있지 않다 (N6)", async () => {
    await act(async () => {
      root.render(<Host onBack={() => {}} onSaved={() => {}} />);
    });
    click(lastButton("open-edit"));
    await tick();
    click(lastButton("open-other"));
    await tick();
    expect(dialogTextOf("host-form")).not.toContain("addTx.saveFailed");
  });
});

const dialogTextOf = (id: string) =>
  document.body.querySelector(`[data-testid="${id}"]`)?.textContent ?? "";
