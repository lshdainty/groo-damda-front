// 정산 상세 — 바닥은 주 동작 하나 + 왼쪽 [삭제] 뿐, 머리 ⋮ 는 없다(담을 실행이 없다).
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
// 1280 이상(대화상자)인가 — matchMedia 가 돌려준다. 기본은 미만(시트)
let wideMedia = false;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  closed = 0;
  wideMedia = false;
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  window.matchMedia = ((query: string) => ({
    matches: wideMedia,
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
  it("진행 중이면 바닥은 왼쪽 [삭제] 와 주 동작 [모두 받음] 둘뿐이다", () => {
    open(session(false));
    expect(footerLabels()).toEqual(["삭제", "모두 받음"]);
  });

  it("끝난 정산은 바닥 [삭제] 하나뿐이다", () => {
    open(session(true));
    expect(footerLabels()).toEqual(["삭제"]);
    expect(byName("금요일 회식 2차 더보기")).toBeUndefined();
  });

  it("진행 중이어도 머리에 ⋮ 는 없다 — 제목 · 닫기만(메뉴는 실행만 담는다)", () => {
    open(session(false));
    expect(byName("금요일 회식 2차 더보기")).toBeUndefined();
    expect(
      Array.from(document.body.querySelectorAll("button")).filter((b) =>
        /더보기/.test(b.getAttribute("aria-label") ?? ""),
      ),
    ).toHaveLength(0);
    expect(menuItems()).toHaveLength(0);
  });

  it("[일괄 요청] 은 어디에도 없다(참여자 줄의 막힌 [요청] 은 그대로)", () => {
    open(session(false));
    expect(document.body.textContent).not.toContain("일괄 요청");
    expect(document.body.textContent).toContain("송금 요청은 곧 열려요.");
  });
});

// button.md "가장자리 맞춤" — flush 는 ghostColor 를 덮어(neutralSubtle) 빨강이 사라지므로 삭제(critical)에는 쓰지 않는다.
// 빨강은 ghostColor="critical" 이 정한다 — className 으로 글자색을 다시 덮어씌우지 않는다(스펙 토큰 inline override 금지)
describe("정산 상세 바닥 [삭제] 색", () => {
  it.each([
    ["1280 이상 대화상자", true],
    ["1280 미만 시트", false],
  ])(
    "%s — [삭제] 는 ghost critical 빨간 글자, flush · 글자색 덮기가 없다",
    (_, wide) => {
      wideMedia = wide;
      open(session(false));
      const cls = byName("삭제")!.className.split(/\s+/);
      expect(cls).toContain("text-fg-critical");
      // flush 의 흔적 — 왼쪽 여백 0 · 텍스트 버튼 글자색
      expect(cls).not.toContain("pl-0");
      expect(cls).not.toContain("text-fg-neutral-subtle");
      // 누름 · 호버 글자색을 className 으로 덮은 흔적(ghost critical 은 글자색이 아니라 바탕으로 반응한다)
      expect(cls.filter((c) => /^(hover|active):text-/.test(c))).toEqual([]);
    },
  );
});

// button.md "모달 footer 는 small" · dialog.md 바닥 "Button small 36" — 시트는 large 48(bottom-sheet.md 바닥).
// 화면은 1280 이상에서 크기를 주지 않고(size={undefined}) 바닥 부품(DialogFooter)이 small 을 넣는다 —
// 코드만 읽으면 기본 medium 40 으로 보이는 자리라 실제로 그린 크기를 잠근다
describe("정산 상세 바닥 단추 크기", () => {
  it.each([
    ["1280 이상 대화상자", "min-h-[36px]", true],
    ["1280 미만 시트", "min-h-[48px]", false],
  ])("%s — [삭제] · [모두 받음] 의 높이는 %s", (_, height, wide) => {
    wideMedia = wide;
    open(session(false));
    for (const name of ["삭제", "모두 받음"]) {
      expect(byName(name)!.className.split(/\s+/)).toContain(height);
    }
  });
});
