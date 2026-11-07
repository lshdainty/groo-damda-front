// 홈 일정 · 할 일 줄 — 사흘 안은 warning(넘침만 critical), 할 일 앞은 할 일 화면과 같은 square neutral 칸 (I-28 28-1)
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardSummary } from "@/features/dashboard";
import {
  CategoryBody,
  EventRows,
  MonthNote,
  TodoRows,
  type ColoredSlice,
} from "./home-parts";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      o ? `${k}${JSON.stringify(o)}` : k,
    i18n: { language: "ko" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const ev = (rowId: number, daysUntil: number) =>
  ({
    rowId,
    title: `일정${rowId}`,
    color: null,
    daysUntil,
  }) as unknown as DashboardSummary["upcomingEvents"][number];
const todo = (rowId: number, status: string, dueDate: string | null) =>
  ({
    rowId,
    title: `할일${rowId}`,
    status,
    dueDate,
  }) as unknown as DashboardSummary["recentTodos"][number];

describe("다가오는 일정 줄", () => {
  it("사흘 안(오늘 · 내일 · 3일)은 fg-warning, 4일부터는 기본색 — critical 아님", () => {
    act(() =>
      root.render(
        <EventRows
          events={[ev(1, 0), ev(2, 1), ev(3, 3), ev(4, 4)]}
          onOpen={() => {}}
        />,
      ),
    );
    const sufs = Array.from(
      container.querySelectorAll<HTMLElement>("[data-slot=list-suffix] span"),
    );
    const within = sufs.slice(0, 3);
    const out = sufs[3]!;
    for (const s of within) {
      expect(s.className).toContain("text-fg-warning");
      expect(s.className).not.toContain("text-fg-critical");
    }
    expect(out.className).not.toContain("text-fg-warning");
    expect(out.className).not.toContain("text-fg-critical");
  });
});

describe("최근 할 일 줄", () => {
  it("앞은 square neutral 칸(24) — 표시용(aria-hidden · 눌리지 않음), 완료는 체크 + 취소선", () => {
    act(() =>
      root.render(
        <TodoRows
          todos={[
            todo(1, "ACTIVE", "2026-10-30"),
            todo(2, "COMPLETED", null),
            todo(3, "ACTIVE", "2026-10-20"),
          ]}
          todayStr="2026-10-29"
          onOpen={() => {}}
        />,
      ),
    );
    const boxes = Array.from(
      container.querySelectorAll<HTMLElement>("[role=checkbox]"),
    );
    expect(boxes).toHaveLength(3);
    for (const b of boxes) {
      expect(b.getAttribute("aria-hidden")).toBe("true");
      expect(b.tabIndex).toBe(-1);
      expect(b.className).toContain("pointer-events-none");
      expect(b.className).toContain("rounded"); // square: 원이 아니다
      expect(b.className).not.toContain("rounded-full");
    }
    expect(boxes[0]!.getAttribute("data-state")).toBe("unchecked");
    expect(boxes[1]!.getAttribute("data-state")).toBe("checked");
    expect(boxes[2]!.className).toContain("border-stroke-critical-solid");
    const done = container.querySelector(".line-through")!;
    expect(done.className).toContain("text-fg-disabled");
  });
});

describe("MonthNote 전월 대비 비율", () => {
  it("소수 둘째 자리까지 보인다 — 3.76% (4% 로 반올림하지 않는다)", () => {
    act(() => {
      root.render(
        <MonthNote dailyAvg={34593} prevExpense={1042400} savingsPct={3.76} />,
      );
    });
    expect(container.textContent).toContain("3.76%");
    expect(container.textContent).not.toContain("4%");
  });
});

describe("홈 지출 도넛 비중(B3 1A — 비중은 늘 소수 한 자리)", () => {
  it("범례 · 표가 같은 한 자리 값이고 아주 작은 몫은 '0.1% 미만'", () => {
    const slice = (id: string, amount: number, i: number) =>
      ({
        id,
        name: `카테고리${id}`,
        amount,
        color: "blue",
        fill: `var(--c${i})`,
      }) as unknown as ColoredSlice;
    act(() =>
      root.render(
        <CategoryBody
          size={180}
          center={false}
          month={11}
          slices={[
            slice("a", 3_000_000, 0),
            slice("b", 6_999_000, 1),
            slice("c", 1, 2),
          ]}
        />,
      ),
    );
    const legend = container.querySelector(
      "[data-slot=chart-donut-legend]",
    )!.textContent!;
    expect(legend).toContain("30.0%");
    expect(legend).toContain("70.0%");
    expect(legend).toContain("0.1% 미만");
    expect(legend).not.toMatch(/(^|[^.\d])30%/);
    const table = Array.from(container.querySelectorAll("td")).map(
      (td) => td.textContent,
    );
    expect(table).toContain("30.0%");
  });
});
