// 프리셋 목록 이체 행의 부제.
//
// 이체 부제는 이미 "출금 → 입금" 인데, 데스크톱에만 있는 "· 계좌" 접미가 이체에도
// 그대로 붙어 **"QA예금 → QA적금 · QA예금"** 이 됐다(#171 잔여). 지출·수입 행에서는
// 계좌를 알려 주는 쓸모가 있지만 이체 행에서는 이미 적은 것을 한 번 더 적는 것이다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExpenseTemplate } from "@/entities/expense-template";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const state = vi.hoisted(() => ({ items: [] as ExpenseTemplate[] }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/features/expense", () => ({
  useExpenseTemplates: () => ({ data: state.items, isLoading: false }),
  useExpenseCategories: () => ({ data: [], isLoading: false }),
  useDeleteExpenseTemplate: () => ({
    mutate: () => {},
    mutateAsync: () => Promise.resolve(),
    isPending: false,
  }),
  useReorderExpenseTemplates: () => ({ mutate: () => {}, isPending: false }),
}));
vi.mock("@/shared/ds/snackbar", () => ({
  useSnackbar: () => ({ show: () => {}, dismiss: () => {} }),
}));
vi.mock("./PresetEditDialog", () => ({ PresetEditDialog: () => null }));
vi.mock("./PresetDetailDialog", () => ({
  PresetDetailDialog: ({ preset }: { preset: { templateName: string } }) => (
    <div data-testid="detail">{preset.templateName}</div>
  ),
}));

const { PresetManager } = await import("./PresetManager");

const preset = (
  rowId: number,
  templateName: string,
  expenseType: ExpenseTemplate["expenseType"],
): ExpenseTemplate => ({
  rowId,
  userRowId: 1,
  templateName,
  categoryRowId: expenseType === "TRANSFER" ? null : 11,
  categoryName: expenseType === "TRANSFER" ? null : "식비",
  assetRowId: 3,
  assetName: "QA예금",
  toAssetRowId: expenseType === "TRANSFER" ? 4 : null,
  toAssetName: expenseType === "TRANSFER" ? "QA적금" : null,
  fee: null,
  interestAmount: null,
  expenseType,
  amount: null,
  description: null,
  merchant: null,
  paymentMethod: null,
  useCount: 0,
  sortOrder: 0,
  lockAmount: "N",
  lastUsedAt: null,
  createAt: "2026-01-01T00:00:00",
  modifyAt: "2026-01-01T00:00:00",
});

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

function render(mobile: boolean): string {
  act(() => root.render(<PresetManager mobile={mobile} />));
  return container.textContent ?? "";
}

const rows = () =>
  Array.from(container.querySelectorAll<HTMLElement>("[data-slot=list-body]"));

describe("데스크톱 계좌 접미 (#171 잔여)", () => {
  it("이체 행에는 계좌를 또 붙이지 않는다", () => {
    state.items = [preset(1, "적금이체", "TRANSFER")];
    const text = render(false);

    expect(text).toContain("QA예금 → QA적금");
    // 접미가 살아 있으면 "QA예금 → QA적금 · QA예금" 이 된다.
    expect(text).not.toContain("QA적금 · QA예금");
  });

  it("지출 행에는 그대로 붙는다 — 어느 계좌에서 나가는지 알려 주는 자리다", () => {
    state.items = [preset(2, "점심", "EXPENSE")];
    const text = render(false);

    expect(text).toContain("QA예금");
  });
});

describe("목록 (I-20 C 14 · 15 · 17)", () => {
  it("안내 상자 · 숫자 셋이 없고 목록 제목이 개수를 말한다", () => {
    state.items = [preset(1, "점심", "EXPENSE"), preset(2, "월급", "INCOME")];
    const text = render(true);

    expect(text).toContain('preset.listTitle{"count":2}');
    expect(text).not.toContain("preset.introTitle");
    expect(text).not.toContain("preset.statSaved");
  });

  it("줄을 누르면 상세가 열린다 — 폰 · 데스크톱 모두", () => {
    state.items = [preset(1, "점심", "EXPENSE")];
    for (const mobile of [true, false]) {
      render(mobile);
      act(() => rows()[0]!.click());
      expect(container.querySelector("[data-testid=detail]")?.textContent).toBe(
        "점심",
      );
    }
  });

  it("줄 끝에 ⋮ 메뉴가 없다 — 줄 하나는 누름 하나", () => {
    state.items = [preset(1, "점심", "EXPENSE")];
    for (const mobile of [true, false]) {
      render(mobile);
      expect(container.querySelector("[aria-haspopup=menu]")).toBeNull();
    }
  });

  it("정렬은 세 칸 — 사용 많은 순 · 최근 사용 · 이름순", () => {
    state.items = [preset(1, "점심", "EXPENSE")];
    const text = render(true);
    expect(text).toContain("preset.sortUsed");
    expect(text).toContain("preset.sortRecent");
    expect(text).toContain("preset.sortName");
  });

  it("빈 화면 — 안내는 여기에만, 버튼은 폰에만 있다", () => {
    state.items = [];
    expect(render(true)).toContain("preset.emptyDesc");
    expect(
      container.querySelector("[data-slot=result-section] button"),
    ).not.toBeNull();
    render(false);
    expect(container.textContent).toContain("preset.emptyDesc");
    expect(
      container.querySelector("[data-slot=result-section] button"),
    ).toBeNull();
  });
});
