// 더치페이 참여자 줄 — 실제로 렌더해 칸 계약을 잠근다(I-wrap-b6 다.10).
// 문자열 시험(use-dutch-step.fields.test.ts)은 클래스 상수가 소스에 있다는 것만 보므로, 그 클래스가 줄의 어느 요소에 붙는지는 여기서 본다.
// 컨테이너 쿼리(@max-[…]/list-item)는 jsdom 이 재지 못한다 — 실제 폭(390 · 200%)은 렌더 하네스 몫이고, 여기서는 DOM 계약만 잠근다.
// `t` 는 키(+ 이름)를 그대로 돌려주므로 칸은 aria-label 키로 집는다.
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Expense } from "@/entities/expense";
import { setupDetailDom } from "./test-utils";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: { name?: string }) => (o?.name ? `${k}:${o.name}` : k),
    i18n: { language: "ko" },
  }),
  Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/features/dutch-pay", () => ({
  useCreateDutchPay: () => ({ mutateAsync: async () => ({}), error: null }),
}));
vi.mock("@/features/expense", () => ({
  useExpenseCategories: () => ({
    data: [],
    isPending: false,
    isError: false,
    refetch: async () => ({ data: [] }),
  }),
}));
vi.mock("@/features/user", () => ({
  useCurrentUser: () => ({
    data: { rowId: 1, userName: "민준" },
    isPending: false,
    isError: false,
    refetch: async () => ({ data: { rowId: 1, userName: "민준" } }),
  }),
}));

const { useDutchStep } = await import("./use-dutch-step");

const expense = {
  rowId: 5,
  categoryRowId: 1,
  assetRowId: 1,
  assetName: "현대카드",
  expenseType: "EXPENSE",
  amount: 30000,
  description: "저녁",
  merchant: "식당",
  expenseDate: "2026-11-02T12:00:00Z",
} as unknown as Expense;

function Host({ onCreated }: { onCreated: () => void }): ReactNode {
  const step = useDutchStep({
    enabled: true,
    expense,
    onCreated,
    onExit: () => {},
  });
  return (
    <div>
      {step.body}
      {step.above}
      {step.primary}
    </div>
  );
}

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  setupDetailDom();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<Host onCreated={() => {}} />));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const setValue = (el: HTMLInputElement, v: string) =>
  act(() => {
    const set = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    set.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
const click = (el: Element) =>
  act(() => el.dispatchEvent(new MouseEvent("click", { bubbles: true })));

function addPerson(name: string) {
  const input = host.querySelector<HTMLInputElement>(
    '[aria-label="fromTx.addNameLabel"]',
  )!;
  setValue(input, name);
  const add = [...host.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === "fromTx.add",
  )!;
  click(add);
}
const pickMethod = (v: "EQUAL" | "RATIO" | "CUSTOM") =>
  click(host.querySelector(`[role="radio"][value="${v}"]`)!);
const rows = () =>
  [
    ...host.querySelectorAll(
      '[data-slot="dutch-shares"] [data-slot="list-item"]',
    ),
  ] as HTMLElement[];
const field = (label: string) =>
  host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
const rootOf = (input: HTMLInputElement) =>
  input.closest<HTMLElement>('[data-slot="text-input"]')!;

describe("더치페이 참여자 줄 렌더", () => {
  it("똑같이 나누기 — 줄에는 입력 칸이 없고 금액 글만 있다", () => {
    addPerson("서연");
    expect(rows()).toHaveLength(2);
    expect(
      host.querySelectorAll('[data-slot="dutch-shares"] input'),
    ).toHaveLength(0);
    // 줄 클래스는 FIELD_ROW(문턱 16rem + 48px) — 직접 입력용 446 격자가 아니다
    for (const r of rows()) {
      expect(r.className).toContain("@max-[calc(16rem+48px)]/list-item");
      expect(r.className).not.toContain("446px");
    }
  });

  it("비율 — 모든 줄(나 포함)에 비율 칸이 이름이 담긴 aria-label 로 있고, 칸 root 는 96px 이다", () => {
    addPerson("서연");
    pickMethod("RATIO");
    for (const who of ["fromTx.me", "서연"]) {
      const input = field(`fromTx.ratioLabel:${who}`)!;
      expect(input).not.toBeNull();
      expect(input.getAttribute("inputmode")).toBe("decimal");
      const r = rootOf(input);
      expect(r.className).toContain("w-[96px]");
      expect(r.className).toContain("@max-[calc(16rem+48px)]/list-item:w-full");
      expect(r.className).not.toContain("172px");
      // 칸은 그 사람의 줄 안 뒤 붙이개에 있다
      expect(input.closest('[data-slot="list-suffix"]')).not.toBeNull();
    }
    for (const r of rows()) {
      expect(r.className).toContain("@max-[calc(16rem+48px)]/list-item");
      expect(r.className).not.toContain("446px");
    }
  });

  it("비율 — 값은 숫자와 점만 받고, 바꾸면 몫 금액이 줄 안 detail 로 따라 바뀐다", () => {
    addPerson("서연");
    pickMethod("RATIO");
    const input = field("fromTx.ratioLabel:서연")!;
    expect(input.value).toBe("1");
    setValue(input, "3ab");
    expect(input.value).toBe("3");
    // 1 : 3 → 30,000원 중 서연 몫 22,500
    const yeon = rows().find((r) => r.textContent?.includes("서연"))!;
    expect(
      yeon.querySelector('[data-slot="list-detail"]')?.textContent,
    ).toContain("22,500");
  });

  it("비율 — 0 이하는 저장을 누르기 전에는 표시하지 않고, 누른 뒤에는 그 칸만 aria-invalid 가 켜진다", async () => {
    addPerson("서연");
    pickMethod("RATIO");
    const input = field("fromTx.ratioLabel:서연")!;
    setValue(input, "0");
    expect(input.getAttribute("aria-invalid")).toBeNull();
    await act(async () => {
      const save = [...host.querySelectorAll("button")].find(
        (b) => b.textContent?.trim() === "fromTx.createSettlement",
      )!;
      save.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(
      field("fromTx.ratioLabel:fromTx.me")!.getAttribute("aria-invalid"),
    ).toBeNull();
  });

  it("직접 입력 — 나 줄은 입력 없이 금액 글, 다른 사람 줄만 172px 칸이다", () => {
    addPerson("서연");
    pickMethod("CUSTOM");
    expect(field("fromTx.customLabel:fromTx.me")).toBeNull();
    const input = field("fromTx.customLabel:서연")!;
    expect(input).not.toBeNull();
    expect(
      host.querySelectorAll('[data-slot="dutch-shares"] input'),
    ).toHaveLength(1);
    const r = rootOf(input);
    expect(r.className).toContain("w-[172px]");
    expect(r.className).toContain("@max-[446px]/list-item:w-full");
    expect(r.className).not.toContain("w-[96px]");
    // 나 줄에는 금액 글(suffix)이 있다
    const me = rows().find((r2) =>
      r2.textContent?.includes("fromTx.payerBadge"),
    )!;
    expect(me.querySelector('[data-slot="list-suffix"] input')).toBeNull();
    expect(
      me.querySelector('[data-slot="list-suffix"]')?.textContent,
    ).toContain("30,000");
  });

  it("직접 입력 — 모든 줄에 446 문턱 격자가 붙고, 입력 칸이 있는 줄만 칸을 본문 아래 3열로 내린다", () => {
    addPerson("서연");
    pickMethod("CUSTOM");
    for (const r of rows()) {
      expect(r.className).toContain(
        "@max-[446px]/list-item:[&_[data-slot=list-content]]:grid-cols-[auto_auto_minmax(0,1fr)_auto]",
      );
      expect(r.className).toContain(
        "@max-[446px]/list-item:[&_[data-slot=list-suffix]:has(input)]:col-start-3!",
      );
    }
  });

  it("직접 입력 — 금액을 치면 쉼표가 찍힌다", () => {
    addPerson("서연");
    pickMethod("CUSTOM");
    const input = field("fromTx.customLabel:서연")!;
    setValue(input, "12000");
    expect(input.value).toBe("12,000");
  });

  it("방법을 바꾸면 칸이 바뀐다 — 비율 → 직접 입력 → 똑같이", () => {
    addPerson("서연");
    pickMethod("RATIO");
    expect(field("fromTx.ratioLabel:서연")).not.toBeNull();
    pickMethod("CUSTOM");
    expect(field("fromTx.ratioLabel:서연")).toBeNull();
    expect(field("fromTx.customLabel:서연")).not.toBeNull();
    pickMethod("EQUAL");
    expect(
      host.querySelectorAll('[data-slot="dutch-shares"] input'),
    ).toHaveLength(0);
  });
});
