// 정산 상세 — 바닥은 주 동작 하나 + 왼쪽 [삭제], 나머지 동작은 머리 ⋮ (bottom-sheet "동작이 여럿이면 머리 ⋮", 스펙 3차 정리).
// 번역은 CSV 원본에서 읽는다.
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DutchPay } from "@/entities/dutch-pay";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

function koCopy(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync("i18n/translations.csv", "utf-8").split(
    "\n",
  )) {
    const cells: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (quoted && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = !quoted;
      } else if (c === "," && !quoted) {
        cells.push(cur);
        cur = "";
      } else cur += c;
    }
    cells.push(cur);
    const [ns, key, ko] = cells;
    if ((ns === "dutchPay" || ns === "common") && key)
      out[`${ns}:${key}`] = ko ?? "";
  }
  return out;
}
const COPY = koCopy();

vi.mock("react-i18next", () => ({
  useTranslation: (ns?: string) => ({
    t: (k: string, opts?: Record<string, unknown>) => {
      const raw = COPY[`${ns ?? "common"}:${k}`];
      if (raw == null) return k;
      return raw.replace(/\{\{(\w+)\}\}/g, (_m, name: string) =>
        String(opts?.[name] ?? ""),
      );
    },
    i18n: { language: "ko" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/shared/lib/confirm-fail", () => ({
  useConfirmFail: () => () => {},
}));

const { DutchDetailDialog } = await import("./DutchDetailDialog");

// 지어낸 값(groo-sql 시드 형식)
const session = (isSettled: boolean): DutchPay => ({
  rowId: 1,
  userRowId: 1,
  sourceExpenseRowId: null,
  title: "금요일 회식 2차",
  description: "강남 고깃집",
  totalAmount: 240000,
  currency: "KRW",
  splitMethod: "EQUAL",
  dutchPayDate: "2026-10-23",
  isSettled,
  participants: [
    {
      rowId: 11,
      participantName: "나",
      amount: 80000,
      isPaid: true,
      userRowId: 1,
      isPayer: true,
      paidAt: null,
    },
    {
      rowId: 12,
      participantName: "지민",
      amount: 80000,
      userRowId: null,
      isPayer: false,
      paidAt: null,
      isPaid: isSettled,
    },
    {
      rowId: 13,
      participantName: "도윤",
      amount: 80000,
      userRowId: null,
      isPayer: false,
      paidAt: null,
      isPaid: isSettled,
    },
  ],
  createAt: "2026-10-23T20:00:00",
  modifyAt: "2026-10-23T20:00:00",
});

let container: HTMLDivElement;
let root: Root;
let closed: number;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  closed = 0;
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  window.matchMedia = ((query: string) => ({
    matches: false,
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
  await new Promise((r) => setTimeout(r, 20));
});

const q = <T extends Element = HTMLElement>(sel: string) =>
  document.body.querySelector<T>(sel);
const byName = (name: string) =>
  Array.from(document.body.querySelectorAll<HTMLElement>("button")).find(
    (b) => (b.getAttribute("aria-label") ?? b.textContent?.trim()) === name,
  );
const menuItems = () =>
  Array.from(
    document.body.querySelectorAll<HTMLElement>(
      "[role=menuitem], [data-slot=menu-sheet-item]",
    ),
  );
const open = (d: DutchPay) =>
  act(() =>
    root.render(
      <DutchDetailDialog
        d={d}
        onClose={() => closed++}
        markPaid={() => Promise.resolve()}
        settleAll={() => Promise.resolve()}
        remove={() => Promise.resolve()}
      />,
    ),
  );
const footerLabels = () =>
  Array.from(
    q("[data-slot=bottom-sheet-footer]")!.querySelectorAll("button"),
  ).map((b) => b.textContent);

describe("정산 상세 바닥 · 머리 ⋮", () => {
  it("진행 중이면 바닥은 왼쪽 [삭제] 와 주 동작 [모두 받음] 둘뿐이다([일괄 요청] 은 바닥에 없다)", () => {
    open(session(false));
    expect(footerLabels()).toEqual(["삭제", "모두 받음"]);
  });

  it("끝난 정산은 바닥 [삭제] 하나, 머리 ⋮ 는 없다(담을 동작이 없다)", () => {
    open(session(true));
    expect(footerLabels()).toEqual(["삭제"]);
    expect(byName("금요일 회식 2차 더보기")).toBeUndefined();
  });

  it("진행 중이면 머리 ⋮ 가 이름이 붙은 버튼으로 있고, 열면 막힌 [일괄 요청] 줄(설명 포함)이 있다", () => {
    open(session(false));
    const more = byName("금요일 회식 2차 더보기");
    expect(more).toBeTruthy();
    act(() => more!.click());
    const items = menuItems();
    expect(items).toHaveLength(1);
    expect(items[0]!.textContent).toContain("일괄 요청");
    expect(items[0]!.textContent).toContain("송금 요청은 곧 열려요.");
    // 1280 미만 Menu Sheet 는 <button disabled>, 1280 이상 Menu 는 aria-disabled
    expect(
      (items[0] as HTMLButtonElement).disabled ||
        items[0]!.getAttribute("aria-disabled") === "true",
    ).toBe(true);
  });

  it("막힌 줄을 눌러도 상세는 닫히지 않는다", () => {
    open(session(false));
    act(() => byName("금요일 회식 2차 더보기")!.click());
    act(() => menuItems()[0]!.click());
    expect(closed).toBe(0);
  });
});
