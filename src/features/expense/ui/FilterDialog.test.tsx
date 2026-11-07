// 거르기 시트 · 조건 본문 부품(I-07 18 ~ 23) — 실제 부품을 띄운 채로 모델이 말하는 규칙을 잠근다.
// 번역은 CSV 원본에서 읽는다(사용자가 읽는 글로 찾는다).
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Asset } from "@/entities/asset";
import type { ExpenseCategory } from "@/entities/expense";
import {
  DEFAULT_FILTER,
  activeConditionCount,
  type FilterPeriodRange,
  type FilterValue,
} from "../model/filter";

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
    if ((ns === "expense" || ns === "common") && key)
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

const { FilterDialog } = await import("./FilterDialog");

const cat = (rowId: number, categoryName: string): ExpenseCategory =>
  ({
    rowId,
    categoryName,
    icon: null,
    color: null,
    expenseType: "EXPENSE",
    sortOrder: rowId,
    parentRowId: null,
    hasChildren: false,
  }) as unknown as ExpenseCategory;
const categories = [cat(1, "식비"), cat(2, "교통")];
const asset = (rowId: number, assetName: string): Asset =>
  ({ rowId, assetName, assetType: "BANK_ACCOUNT", institution: null }) as Asset;
const assets = [asset(7, "생활비 통장"), asset(8, "비상금 통장")];

let container: HTMLDivElement;
let root: Root;
let applied: FilterValue[];

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  applied = [];
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  window.history.replaceState(null, "");
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
  document.body.removeAttribute("style");
  await new Promise((r) => setTimeout(r, 100));
});

const VIEW = {
  preset: "custom",
  start: "2026-10-01",
  end: "2026-10-31",
} as const;
const open = async (
  initial: FilterValue | null = null,
  defaultPeriod?: FilterPeriodRange,
) => {
  await act(async () =>
    root.render(
      <FilterDialog
        initial={initial}
        defaultPeriod={defaultPeriod}
        categories={categories}
        assets={assets}
        onClose={() => {}}
        onApply={(v) => applied.push(v)}
      />,
    ),
  );
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};
const all = (sel: string) =>
  Array.from(document.querySelectorAll<HTMLElement>(sel));
const named = (sel: string, name: string) =>
  all(sel).find((e) => (e.textContent ?? "").trim() === name);
const click = (el: HTMLElement | undefined) => {
  expect(el, "누를 것이 있다").toBeTruthy();
  act(() => el!.click());
};
const applyBtn = () => named("button", "필터 적용") as HTMLButtonElement;
const last = () => applied[applied.length - 1]!;

describe("폼 시트 (18)", () => {
  it("제목 '필터' · 바닥 '초기화' + '필터 적용' 이고, 본문에 조건 여섯이 차례로 있다", async () => {
    await open();
    const sheet = document.querySelector("[data-slot=bottom-sheet-content]");
    const heads = all("section h3").map((h) => h.textContent);

    expect(sheet).not.toBeNull();
    expect(
      document.querySelector("[data-slot=bottom-sheet-title]")?.textContent,
    ).toBe("필터");
    expect(named("button", "초기화")).toBeTruthy();
    expect(applyBtn()).toBeTruthy();
    expect(heads).toEqual([
      "조건 맞추기",
      "기간",
      "거래 종류",
      "카테고리",
      "계좌 · 카드",
      "금액 범위",
    ]);
  });
});

describe("조건 맞추기 (19)", () => {
  it("조건이 하나 이하면 두 줄 모두 막히고 안내가 있다", async () => {
    await open({ ...DEFAULT_FILTER, types: ["EXPENSE"] });
    const radios = all("[role=radio]").filter((r) =>
      ["all", "any"].includes(r.getAttribute("value") ?? ""),
    );

    expect(radios.length).toBe(2);
    expect(radios.every((r) => r.hasAttribute("disabled"))).toBe(true);
    expect(document.body.textContent).toContain(
      "조건이 두 개 이상일 때 고를 수 있어요.",
    );
    expect(document.body.textContent).toContain("기간은 항상 함께 적용돼요.");
  });

  it("조건이 둘 이상이면 풀리고, '하나라도 일치' 를 고르면 그대로 적용된다", async () => {
    await open({
      ...DEFAULT_FILTER,
      types: ["EXPENSE"],
      amountRanges: [{ min: "1000", max: "" }],
    });
    const any = all("[role=radio]").find(
      (r) => r.getAttribute("value") === "any",
    )!;

    expect(any.hasAttribute("disabled")).toBe(false);
    click(any);
    click(applyBtn());
    expect(last().match).toBe("any");
  });

  it("조건이 하나로 줄면 적용할 때 '모두 일치' 로 돌아간다", async () => {
    await open({
      ...DEFAULT_FILTER,
      match: "any",
      types: ["EXPENSE"],
      amountRanges: [{ min: "1000", max: "" }],
    });
    // 금액 구간을 지운다 — 조건이 하나(종류)만 남는다
    click(
      all("button").find(
        (b) => b.getAttribute("aria-label") === "이 줄 지우기",
      ),
    );
    click(applyBtn());

    expect(last().match).toBe("all");
  });
});

describe("기간 (20)", () => {
  it("처음 열면 보던 달로 채워져 있고, 적용하면 그 기간이 들어간다 — 폰은 옮기기라 옛 동작 그대로", async () => {
    await open(null, VIEW);
    expect(
      all("[data-slot=input-button]").some((b) =>
        /10월 1일~10월 31일|Oct 1.Oct 31/.test(b.textContent ?? ""),
      ),
    ).toBe(true);

    click(applyBtn());
    expect(last().periods).toEqual([VIEW]);
  });

  it("기간 달력의 빠른 기간은 옛 필터 그대로(이번 주 · 이번 달 · 3개월)이고 새로 넓힌 지난 달 · 올해는 없다", async () => {
    await open(null, VIEW);
    click(
      all("[data-slot=input-button-trigger]").find((b) =>
        /10월 1일~10월 31일|Oct 1.Oct 31/.test(
          b.parentElement?.textContent ?? "",
        ),
      ),
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/이번 주|This week/);
    expect(text).toMatch(/이번 달|This month/);
    expect(text).toMatch(/최근 3개월|Last 3 months/);
    expect(text).not.toMatch(/올해|This year/);
    expect(text).not.toMatch(/지난 ?달|Last month/);
  });

  it("칸은 Input Button 하나이고 날짜를 치는 칸이 아니다", async () => {
    await open({
      ...DEFAULT_FILTER,
      periods: [{ preset: "custom", start: "2026-10-01", end: "2026-10-10" }],
    });
    const field = all("[data-slot=input-button]").find((b) =>
      b.textContent?.includes("10"),
    );

    expect(field).toBeTruthy();
    expect(document.querySelector("input[type=date]")).toBeNull();
    // 값이 있으면 "기간 추가" 가 보인다 — 최대 셋까지
    expect(named("button", "기간 추가")).toBeTruthy();
  });

  it("시작이 끝보다 늦은 기간이 들어 있으면 적용이 막히고 오류가 보인다", async () => {
    await open({
      ...DEFAULT_FILTER,
      periods: [{ preset: "custom", start: "2026-10-20", end: "2026-10-10" }],
    });

    expect(applyBtn().disabled).toBe(true);
    expect(document.body.textContent).toContain("시작일이 종료일보다 늦을 수");
  });
});

describe("거래 종류 (21)", () => {
  it("지출 · 수입을 칩으로 여럿 고른다 — 둘 다 끄면 둘 다 켠 것과 같다(조건 아님)", async () => {
    await open();
    const chips = all("[role=checkbox]").filter((c) =>
      ["지출", "수입"].includes((c.textContent ?? "").trim()),
    );
    expect(chips.length).toBe(2);
    expect(chips.every((c) => c.getAttribute("data-state") === "checked")).toBe(
      true,
    );

    click(chips[0]);
    click(chips[1]);
    click(applyBtn());

    // 엉뚱한 '수입' 칩이 생기지 않는다 — 종류 조건은 하나만 골랐을 때만 걸린다
    expect(last().types.slice().sort()).toEqual(["EXPENSE", "INCOME"]);
    expect(activeConditionCount(last())).toBe(0);
  });

  it("하나만 고르면 그 종류 조건이 걸린다", async () => {
    await open();
    const income = all("[role=checkbox]").find(
      (c) => (c.textContent ?? "").trim() === "수입",
    );
    click(income);
    click(applyBtn());

    expect(last().types).toEqual(["EXPENSE"]);
    expect(activeConditionCount(last())).toBe(1);
  });
});

describe("카테고리 · 계좌 — 고른 것만 · 고른 것 빼고 (22)", () => {
  const mode = (name: string) =>
    all("[role=radio]").find((r) => (r.textContent ?? "").trim() === name);

  it("3상태 안내('한 번 더 누르면')가 없다 — 칩은 두 상태뿐이다", async () => {
    await open();
    expect(document.body.textContent).not.toContain("한 번 더 누르면");
    expect(mode("고른 것만")).toBeTruthy();
    expect(mode("고른 것 빼고")).toBeTruthy();
  });

  it("고른 것을 '빼고' 로 바꾸면 include 에서 exclude 로 옮겨 간다 — 한 조건에 둘이 섞이지 않는다", async () => {
    await open({
      ...DEFAULT_FILTER,
      categories: { include: [1], exclude: [] },
    });
    // 카테고리 모드 칩은 첫 번째 쌍 — 계좌도 같은 글이라 첫 번째를 고른다
    click(
      all("[role=radio]").filter(
        (r) => (r.textContent ?? "").trim() === "고른 것 빼고",
      )[0],
    );
    click(applyBtn());

    expect(last().categories).toEqual({ include: [], exclude: [1] });
  });

  it("이미 빼고 있던 조건은 열어도 그대로 '빼고' 모드다", async () => {
    await open({
      ...DEFAULT_FILTER,
      categories: { include: [], exclude: [2] },
    });
    click(applyBtn());

    expect(last().categories).toEqual({ include: [], exclude: [2] });
    expect(
      all("[role=radio]").filter(
        (r) =>
          (r.textContent ?? "").trim() === "고른 것 빼고" &&
          r.getAttribute("data-state") === "checked",
      ).length,
    ).toBeGreaterThan(0);
  });

  it("'빼고' 모드에서 칩을 더 고르면 exclude 에만 쌓인다", async () => {
    await open();
    click(
      all("[role=radio]").filter(
        (r) => (r.textContent ?? "").trim() === "고른 것 빼고",
      )[0],
    );
    click(named("[role=checkbox]", "식비"));
    click(named("[role=checkbox]", "교통"));
    click(applyBtn());

    expect(last().categories).toEqual({ include: [], exclude: [1, 2] });
  });

  it("계좌 · 카드는 체크 줄이고 줄을 누르면 고른다", async () => {
    await open();
    const row = all("[data-slot=list-item]").find((r) =>
      r.textContent?.includes("생활비 통장"),
    )!;
    const check = row.querySelector<HTMLElement>("[role=checkbox]")!;
    click(check);
    click(applyBtn());

    expect(last().assets).toEqual({ include: [7], exclude: [] });
  });
});

describe("금액 (23)", () => {
  it("구간은 최대 셋이고, 셋이 차면 '구간 추가' 가 사라진다", async () => {
    await open();
    expect(named("button", "구간 추가")).toBeTruthy();

    click(named("button", "구간 추가"));
    click(named("button", "구간 추가"));
    click(named("button", "구간 추가"));

    expect(all("input[inputmode=numeric]").length).toBe(6);
    expect(named("button", "구간 추가")).toBeUndefined();
  });
});

describe("초기화", () => {
  it("모든 조건을 비운다 — 기간은 보던 달로 돌아간다", async () => {
    await open(
      {
        ...DEFAULT_FILTER,
        match: "any",
        periods: [{ preset: "custom", start: "2026-10-01", end: "2026-10-10" }],
        types: ["EXPENSE"],
        categories: { include: [1], exclude: [] },
      },
      VIEW,
    );
    click(named("button", "초기화"));
    click(applyBtn());

    expect(last()).toEqual({
      ...DEFAULT_FILTER,
      periods: [VIEW],
      types: ["EXPENSE", "INCOME"],
    });
  });
});
