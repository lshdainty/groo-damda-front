// 폭이 768 을 넘나들어도 예산에서 고른 달이 남는다 — "폼은 갈림 밖"(I-wrap-b1 ε 9).
// 종전엔 달(monthKey)이 BudgetMobile · BudgetDesktop 각자의 모델 안에 있어, 폭이 바뀌면 이번 달로 돌아갔다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const st = vi.hoisted(() => ({ mobile: true }));

vi.mock("react-router-dom", () => ({
  useOutletContext: () => ({ mobile: st.mobile }),
}));
// 두 갈래는 고른 달만 보이고 바꾸는 단추를 둔다 — 실제 화면과 같은 모델 훅을 탄다
vi.mock("./BudgetMobile", async () => {
  const { useBudgetModel } = await import("./budget-model");
  return { BudgetMobile: Probe("mobile", useBudgetModel) };
});
vi.mock("./BudgetDesktop", async () => {
  const { useBudgetModel } = await import("./budget-model");
  return { BudgetDesktop: Probe("desktop", useBudgetModel) };
});
vi.mock("@/features/expense", () => {
  const q = { data: undefined, isError: false, refetch: async () => {} };
  return {
    useBudgetCompliance: () => q,
    useExpenseBudgets: () => q,
    useExpenseCategories: () => q,
    useRangeSummary: () => q,
  };
});
vi.mock("@/features/user", () => ({
  useUserPreferences: () => ({ data: undefined }),
}));

function Probe(
  name: string,
  useModel: typeof import("./budget-model").useBudgetModel,
) {
  return function ProbeView({
    month,
  }: {
    month?: import("./budget-model").BudgetMonth;
  }) {
    const m = useModel(month);
    return (
      <div data-view={name}>
        <span data-month>{m.monthKey}</span>
        <button type="button" onClick={() => m.setMonthKey("2025-03")}>
          pick
        </button>
      </div>
    );
  };
}

const { BudgetPage } = await import("./BudgetPage");

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
const render = (mobile: boolean) => {
  st.mobile = mobile;
  act(() => root.render(<BudgetPage />));
};
const shown = () =>
  container.querySelector("[data-month]")?.textContent ?? null;

describe("폭이 바뀌어도 고른 달이 남는다 (I-wrap-b1 ε 9)", () => {
  it("폰에서 고른 달이 넓은 화면 · 다시 폰에서도 그대로다", () => {
    render(true);
    act(() => container.querySelector("button")!.click());
    expect(shown()).toBe("2025-03");

    render(false);
    expect(
      container.querySelector("[data-view]")?.getAttribute("data-view"),
    ).toBe("desktop");
    expect(shown()).toBe("2025-03");
    render(true);
    expect(shown()).toBe("2025-03");
  });
});
