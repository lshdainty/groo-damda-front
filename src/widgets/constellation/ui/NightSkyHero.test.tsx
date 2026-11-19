// 하늘 카드(I-11 8 · 10-29 결정 1 ~ 3) — 카드를 누르면 상세 시트, 도감 줄이 오늘 값을 넘긴다. 번역은 CSV 원본에서 읽는다.
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CollectionEntry,
  ConstellationToday,
} from "@/features/constellation";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const COPY: Record<string, string> = {};
for (const line of readFileSync("i18n/translations.csv", "utf-8").split("\n")) {
  const m = /^constellation,([^,]+),("(?:[^"]|"")*"|[^,]*),/.exec(line);
  if (m) COPY[m[1]!] = m[2]!.replace(/^"|"$/g, "");
}
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    // 복수형 키(`_one` · `_other`)는 한국어에서 늘 `_other` 다
    t: (k: string, opts?: Record<string, unknown>) =>
      (COPY[k] ?? COPY[`${k}_other`] ?? k).replace(
        /\{\{(\w+)\}\}/g,
        (_m, n: string) => String(opts?.[n] ?? ""),
      ),
    i18n: { language: "ko" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const CON = {
  rowId: 1,
  constellationKey: "cen",
  name: "켄타우루스자리",
  nameEn: "Centaurus",
  description: "반은 사람이고 반은 말인 별자리",
  descriptionEn: null,
  colorKey: "blue",
  starCount: 16,
  starMap: JSON.stringify({
    pts: [
      [10, 10],
      [50, 50],
    ],
    edges: [[0, 1]],
  }),
  sortOrder: 1,
};
const collection = vi.hoisted(() => ({ data: undefined as unknown }));
vi.mock("@/features/constellation", async (orig) => ({
  ...(await orig<typeof import("@/features/constellation")>()),
  useConstellationCollection: () => ({ data: collection.data }),
}));

const { NightSkyHero } = await import("./NightSkyHero");
const { CollectionSection } = await import("./CollectionSection");

const TODAY: ConstellationToday = {
  constellation: CON,
  points: 12,
  goal: 16,
  collected: false,
  todoPoints: 10,
  memoPoints: 2,
  streak: 128,
  guardCount: 3,
  totalCollected: 37,
};

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  collection.data = undefined;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  if (!globalThis.ResizeObserver)
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  window.matchMedia ??= ((q: string) => ({
    matches: false,
    media: q,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
});
const text = () => document.body.textContent ?? "";

describe("NightSkyHero", () => {
  it('카드를 누르면 오늘의 목표 상세 시트가 열리고 도감이 없으면 수집 줄을 뺀다(거짓 "미수집" 방지)', () => {
    act(() => root.render(<NightSkyHero today={TODAY} doneToday={2} />));
    const card = container.querySelector<HTMLButtonElement>(
      "[data-slot=night-sky-hero]",
    )!;
    expect(card.getAttribute("aria-label")).toBe(
      "오늘의 목표 별자리 켄타우루스자리 12/16 별빛",
    );
    expect(document.querySelector("[role=dialog]")).toBeNull();
    act(() => card.click());
    expect(document.querySelector("[role=dialog]")).not.toBeNull();
    expect(text()).toContain("오늘 모은 별빛");
    expect(text()).toContain("별 개수");
    expect(text()).not.toContain("미수집");
    expect(text()).not.toContain("0번");
  });

  it('도감이 왔고 한 번도 못 모았으면 "미수집"이다', () => {
    collection.data = {
      entries: [
        { constellation: CON, collectCount: 0, lastCollectedDate: null },
      ],
      collectedKinds: 0,
      totalCollected: 0,
    };
    act(() => root.render(<NightSkyHero today={TODAY} doneToday={0} />));
    act(() =>
      container
        .querySelector<HTMLButtonElement>("[data-slot=night-sky-hero]")!
        .click(),
    );
    expect(text()).toContain("미수집");
  });

  it("누름은 2px 축소만(바탕 · 색 변화 없음) · 마지막 글자와 › 는 한 덩어리 · 설명 id 가 실제 글을 가리킨다", () => {
    act(() => root.render(<NightSkyHero today={TODAY} doneToday={2} />));
    const card = container.querySelector<HTMLButtonElement>(
      "[data-slot=night-sky-hero]",
    )!;
    expect(card.className).toContain(
      "active:[scale:calc(1-2/var(--press-basis",
    );
    expect(card.className).not.toMatch(/active:bg-/);
    const nowrap = [...card.querySelectorAll("span")].find(
      (e) =>
        e.className.includes("whitespace-nowrap") && e.querySelector("svg"),
    );
    expect(nowrap?.textContent).toBe("리");
    const ids = card.getAttribute("aria-describedby")!.split(" ");
    expect(ids).toHaveLength(2);
    const parts = ids.map((id) => document.getElementById(id)?.textContent);
    expect(parts[0]).toContain("오늘 2건 완료");
    expect(parts[1]).toContain("연속 관측 128일");
  });

  it("도감 줄이 있으면 수집 횟수를 쓴다", () => {
    collection.data = {
      entries: [
        { constellation: CON, collectCount: 4, lastCollectedDate: null },
      ],
      collectedKinds: 1,
      totalCollected: 4,
    };
    act(() => root.render(<NightSkyHero today={TODAY} doneToday={0} />));
    act(() =>
      container
        .querySelector<HTMLButtonElement>("[data-slot=night-sky-hero]")!
        .click(),
    );
    expect(text()).toContain("4번");
  });
});

describe("CollectionSection", () => {
  const entries: CollectionEntry[] = [
    { constellation: CON, collectCount: 0, lastCollectedDate: null },
    {
      constellation: {
        ...CON,
        rowId: 2,
        constellationKey: "oth",
        name: "독수리자리",
      },
      collectCount: 0,
      lastCollectedDate: null,
    },
  ];
  const render = () =>
    act(() =>
      root.render(
        <CollectionSection
          place="band"
          state="ready"
          onRetry={() => {}}
          collection={{ entries, collectedKinds: 0, totalCollected: 0 }}
          todayKey="cen"
          today={TODAY}
        />,
      ),
    );
  it("도감에서 오늘의 목표를 열면 하늘 카드와 같은 상세(진행 막대)다", () => {
    render();
    act(() =>
      [...container.querySelectorAll("button")]
        .find(
          (b) => b.getAttribute("aria-label") === "켄타우루스자리 미리보기",
        )!
        .click(),
    );
    expect(text()).toContain("오늘 모은 별빛");
  });
  it("다른 못 모은 별자리는 지금처럼 빈 고리 + 만나지 못한 안내다", () => {
    render();
    act(() =>
      [...container.querySelectorAll("button")]
        .find((b) => b.getAttribute("aria-label") === "독수리자리 미리보기")!
        .click(),
    );
    expect(text()).not.toContain("오늘 모은 별빛");
    expect(text()).toContain("아직 만나지 못한 별자리예요");
  });

  it("도감 줄 타일 그림은 30 이다(ListTile 이 직계 svg 를 20 으로 줄이지 않는다 — 앱 타일 40 · 그림 30)", () => {
    collection.data = undefined;
    act(() =>
      root.render(
        <CollectionSection
          place="band"
          state="ready"
          onRetry={() => {}}
          collection={{
            entries: [
              {
                constellation: CON,
                collectCount: 3,
                lastCollectedDate: "2026-10-01",
              },
            ],
            collectedKinds: 1,
            totalCollected: 3,
          }}
          todayKey="cen"
          today={TODAY}
        />,
      ),
    );
    const svg = container.querySelector("[data-slot=list-tile] svg")!;
    expect(svg.getAttribute("width")).toBe("30");
    expect(svg.parentElement?.getAttribute("data-slot")).not.toBe("list-tile");
  });
});
