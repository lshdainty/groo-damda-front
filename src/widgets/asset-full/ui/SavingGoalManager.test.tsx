// 저축 목표 관리 폰 — 흰 면 하나 · 막대 · % 한 색 · 금액 가림(asset.savingGoals) · 실패(I-08 24 ~ 28)
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const show = vi.hoisted(() => vi.fn());
vi.mock("@/shared/ds/snackbar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/ds/snackbar")>()),
  useSnackbar: () => ({ show, dismiss: vi.fn() }),
}));
const deleteAsync = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      o ? `${k}${JSON.stringify(o)}` : k,
    i18n: { language: "ko" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("react-router-dom", () => ({
  useLocation: () => ({ pathname: "/", search: "" }),
}));
vi.mock("./SavingGoalAddDialog", () => ({ SavingGoalAddDialog: () => null }));

const goalsState = {
  q: { data: undefined, isError: false, refetch: vi.fn() } as {
    data: unknown;
    isError: boolean;
    refetch: ReturnType<typeof vi.fn>;
  },
};
vi.mock("@/features/savingGoal", () => ({
  useSavingGoals: () => goalsState.q,
  useDeleteSavingGoal: () => ({
    mutate: vi.fn(),
    mutateAsync: deleteAsync,
    isPending: false,
  }),
}));

const { SavingGoalManager } = await import("./SavingGoalManager");
const { setHiddenCardsLocal } =
  await import("@/shared/lib/groo/hide-amounts-core");

const goal = (rowId: number, color: string, extra: object = {}) => ({
  rowId,
  title: `목표 ${rowId}`,
  targetAmount: 1_000_000,
  currentAmount: 250_000,
  color,
  icon: "piggy-bank",
  deadlineDate: null,
  isAchieved: "N",
  ...extra,
});

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  goalsState.q = {
    data: {
      goals: [goal(1, "#ef4444"), goal(2, "#22c55e", { isAchieved: "Y" })],
    },
    isError: false,
    refetch: vi.fn(),
  };
});
afterEach(() => {
  act(() => setHiddenCardsLocal([]));
  act(() => root.unmount());
  container.remove();
});
const render = (mobile = true) =>
  act(() => root.render(<SavingGoalManager mobile={mobile} />));

describe("저축 목표 폰 — 흰 면 하나(I-08 24)", () => {
  it("카드 · 줄 사이 선이 없다", () => {
    render();
    expect(container.querySelector("[data-slot=card]")).toBeNull();
    expect(container.querySelector("hr, [data-slot=list-divider]")).toBeNull();
  });
  it("전체 진행률은 막대 없이 큰 숫자 + %, 목록 제목은 '목표 목록 · N개'", () => {
    render();
    expect(container.textContent).toContain("savingGoal.overallProgress");
    expect(container.textContent).toContain("500,000");
    expect(container.textContent).toContain("2,000,000");
    expect(container.textContent).toContain('savingGoal.goalCount{"n":2}');
    // 막대는 줄마다 하나(둘) — 요약에는 없다
    expect(container.querySelectorAll("[role=meter]")).toHaveLength(2);
  });
});

describe("막대 · % 는 한 색(fg-brand) — 목표 색은 타일에만(I-08 26)", () => {
  it("목표 색이 다른 둘의 막대 채움이 같은 클래스이고 인라인 배경이 없다", () => {
    render();
    const fills = Array.from(
      container.querySelectorAll("[data-slot=progress-fill]"),
    ) as HTMLElement[];
    expect(fills).toHaveLength(2);
    for (const f of fills) {
      expect(f.className).toContain("bg-fg-brand");
      expect(f.style.background).toBe("");
    }
    const pcts = Array.from(container.querySelectorAll("li span")).filter((s) =>
      /^\d+%$/.test(s.textContent ?? ""),
    );
    expect(pcts.length).toBeGreaterThan(0);
    for (const p of pcts) expect(p.className).toContain("text-fg-brand");
  });
  it("달성 목표는 배지 '달성'이 제목 곁에 붙는다", () => {
    render();
    expect(container.querySelectorAll("[data-slot=badge]")).toHaveLength(1);
  });
});

describe("저축 목표 금액 가림(asset.savingGoals) — 웹도 앱처럼(I-08 27)", () => {
  it("켜면 요약 · 줄 금액이 ••••, 막대 · % 는 보인다", () => {
    render();
    expect(container.textContent).toContain("250,000");
    act(() => setHiddenCardsLocal(["asset.savingGoals"]));
    expect(container.textContent).not.toContain("250,000");
    expect(container.textContent).not.toContain("1,000,000");
    expect(container.textContent).toContain("••••");
    expect(container.querySelectorAll("[role=meter]")).toHaveLength(2);
    expect(container.textContent).toContain("25%");
  });
});

describe("저축 목표 — 빈 · 불러오는 중 · 실패(I-08 28)", () => {
  it("목표 0개 — 빈 글 한 줄, 요약 없음", () => {
    goalsState.q = {
      data: { goals: [] },
      isError: false,
      refetch: vi.fn(),
    };
    render();
    expect(container.textContent).toContain("savingGoal.emptyManager");
    expect(container.textContent).not.toContain("savingGoal.overallProgress");
  });
  it("실패 → 다시 시도(오류 원문 없음), 누르면 다시 받는다", () => {
    goalsState.q = { data: undefined, isError: true, refetch: vi.fn() };
    render();
    expect(container.textContent).toContain("savingGoal.loadFailed");
    const retry = container.querySelector(
      "[data-slot=result-section] button",
    ) as HTMLButtonElement;
    act(() => retry.click());
    expect(goalsState.q.refetch).toHaveBeenCalled();
  });
});

describe("저축 목표 데스크톱 — 줄 끝 수정 · 삭제 아이콘", () => {
  it("이름이 목표를 말한다", () => {
    render(false);
    const names = Array.from(container.querySelectorAll("button")).map((b) =>
      b.getAttribute("aria-label"),
    );
    expect(names.some((n) => n?.startsWith("savingGoal.editNamed"))).toBe(true);
    expect(names.some((n) => n?.startsWith("savingGoal.deleteNamed"))).toBe(
      true,
    );
  });
});

describe("저축 목표 삭제 확인창 — ds Alert Dialog (I-28 3-6)", () => {
  it("제목이 이름을 짚고 확정은 criticalSolid, 끝나면 닫는다", async () => {
    deleteAsync.mockClear();
    render(false);
    await act(async () => {
      (
        container.querySelector(
          "[aria-label^='savingGoal.deleteNamed']",
        ) as HTMLElement
      ).click();
    });
    const d = document.querySelector("[role=alertdialog]");
    expect(d?.getAttribute("aria-modal")).toBe("true");
    expect(d?.textContent).toContain("savingGoal.deleteTitle");
    expect(d?.textContent).toContain("목표 1");
    const ok = document.querySelector("[data-slot=alert-dialog-action]");
    expect(ok?.className).toContain("bg-bg-critical-solid");
    await act(async () => {
      (ok as HTMLElement).click();
    });
    expect(deleteAsync).toHaveBeenCalledWith(1);
    expect(document.querySelector("[role=alertdialog]")).toBeNull();
  });

  it("삭제가 실패하면 확인창을 닫고 critical 스낵바 + 다시 시도", async () => {
    show.mockClear();
    deleteAsync.mockClear();
    deleteAsync.mockRejectedValueOnce(new Error("x"));
    render(false);
    await act(async () => {
      (
        container.querySelector(
          "[aria-label^='savingGoal.deleteNamed']",
        ) as HTMLElement
      ).click();
    });
    await act(async () => {
      (
        document.querySelector("[data-slot=alert-dialog-action]") as HTMLElement
      ).click();
    });
    expect(document.querySelector("[role=alertdialog]")).toBeNull();
    const opt = show.mock.calls[0]![0];
    expect(opt.tone).toBe("critical");
    expect(opt.message).toBe("savingGoal.deleteFailed");
    await act(async () => opt.action.onClick());
    expect(deleteAsync).toHaveBeenCalledTimes(2);
  });
});
