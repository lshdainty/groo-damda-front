// 상세 관심 Toggle(I-13 18 · Q3) · 차트 기간 식별자 · 구성 비중
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
const wl = vi.hoisted(() => ({
  groups: [] as { rowId: number; groupName: string; items: unknown[] }[],
  watched: false,
  ready: true,
  failed: false,
  toggle: vi.fn(),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/features/stock/model/useWatchlist", () => ({
  useWatchlist: () => ({
    groups: wl.groups,
    ready: wl.ready,
    failed: wl.failed,
    isWatched: () => wl.watched,
    toggleWatch: wl.toggle,
  }),
}));
vi.mock("@/features/stock/model/useTossStocks", () => ({
  useTossOrderbook: () => ({}),
  useTossTrades: () => ({}),
}));
vi.mock("@/features/stock/model/useDailyCandles", () => ({
  useDailyCandles: () => ({}),
}));
vi.mock("@/features/stock/model/chart-range", async (orig) => ({
  ...(await orig<typeof import("@/features/stock/model/chart-range")>()),
}));

const { WatchToggle } = await import("./detail-parts");
const { RANGES, RANGE_LABEL_KEY } =
  await import("@/features/stock/model/chart-range");
const { CompositionBody } =
  await import("@/features/stock/ui/phone/composition");

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  wl.toggle.mockClear();
  host = document.createElement("div");
  document.body.appendChild(host);
});
// 뿌리를 내려놓지 않으면 시험이 끝난 뒤 남은 효과가 jsdom 이 정리된 다음 돌아 "window is not defined" 를 남긴다
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host.remove();
});
const mount = (n: React.ReactNode) =>
  act(() => {
    root = createRoot(host);
    root.render(<MemoryRouter>{n}</MemoryRouter>);
  });
const btn = () => host.querySelector<HTMLButtonElement>("button")!;

describe("관심 Toggle", () => {
  it("이름은 늘 '관심 등록'이고 눌림은 aria-pressed 로 말한다", () => {
    wl.groups = [{ rowId: 1, groupName: "관심", items: [] }];
    wl.watched = false;
    mount(<WatchToggle symbol="A" />);
    expect(btn().getAttribute("aria-label")).toBe("watch.add");
    expect(btn().getAttribute("aria-pressed")).toBe("false");
  });
  it("그룹이 하나면 바로 담고, 이미 담겼으면 바로 뺀다", () => {
    wl.groups = [{ rowId: 1, groupName: "관심", items: [] }];
    wl.watched = false;
    mount(<WatchToggle symbol="A" marketCode="KOSPI" />);
    act(() => btn().click());
    expect(wl.toggle).toHaveBeenCalledWith("A", "KOSPI");
  });
  it("그룹이 둘 이상이면 담기 전에 고르기 시트가 열린다", async () => {
    wl.groups = [
      { rowId: 1, groupName: "가", items: [] },
      { rowId: 2, groupName: "나", items: [] },
    ];
    wl.watched = false;
    mount(<WatchToggle symbol="A" marketCode="KOSPI" />);
    await act(async () => btn().click());
    expect(wl.toggle).not.toHaveBeenCalled();
    const rows = [...document.querySelectorAll("[data-slot=list-body]")];
    expect(rows.map((r) => r.textContent)).toEqual([
      "가unit.count",
      "나unit.count",
    ]);
    await act(async () => (rows[1] as HTMLButtonElement).click());
    expect(wl.toggle).toHaveBeenCalledWith("A", "KOSPI", 2);
  });
  it("담긴 종목은 그룹이 여럿이어도 바로 뺀다", () => {
    wl.groups = [
      { rowId: 1, groupName: "가", items: [] },
      { rowId: 2, groupName: "나", items: [] },
    ];
    wl.watched = true;
    mount(<WatchToggle symbol="A" />);
    act(() => btn().click());
    expect(wl.toggle).toHaveBeenCalledWith("A", undefined);
  });
});

describe("관심 Toggle — 그룹 질의가 아직이거나 실패했을 때(검수 M3)", () => {
  it("그룹을 아직 받는 중이면 눌림이 막혀 있다(aria-disabled)", () => {
    wl.groups = [];
    wl.ready = false;
    wl.failed = false;
    mount(<WatchToggle symbol="A" />);
    expect(btn().getAttribute("aria-disabled")).toBe("true");
    wl.ready = true;
  });
  it("그룹을 못 받았으면 막지 않고 눌러 실패를 알린다 — 훅이 새 그룹을 만들지 않고 안내한다", () => {
    wl.groups = [];
    wl.ready = false;
    wl.failed = true;
    mount(<WatchToggle symbol="A" marketCode="KOSPI" />);
    expect(btn().getAttribute("aria-disabled")).toBeNull();
    act(() => btn().click());
    // 그룹이 둘 이상인 시트로 가지 않고 훅의 toggleWatch 한 곳으로 간다
    expect(wl.toggle).toHaveBeenCalledWith("A", "KOSPI");
    wl.ready = true;
    wl.failed = false;
  });
});

describe("차트 기간", () => {
  it("글은 '1일' 이어도 식별자는 임베드 주소 값 1D 그대로", () => {
    expect(RANGES[0]).toBe("1D");
    expect(RANGE_LABEL_KEY["1D"]).toBe("range.1d");
  });
});

describe("포트폴리오 구성", () => {
  it("범례 줄 비중이 소수 한 자리로 나오고 도넛 가운데에 종목 수", () => {
    mount(
      <CompositionBody
        data={{
          items: [
            { key: "a", name: "가", pct: 98.949, krwValue: 123_456_789 },
            { key: "b", name: "나", pct: 1.051, krwValue: 1_311_689 },
          ],
        }}
      />,
    );
    expect(host.textContent).toContain("98.9%");
    expect(host.textContent).toContain("unit.stocksCount");
  });
  it("환율이 없으면 도넛 대신 안내", () => {
    mount(<CompositionBody data={{ items: [], notice: "환율 없음" }} />);
    expect(host.textContent).toContain("환율 없음");
    expect(host.querySelector("svg.recharts-surface")).toBeNull();
  });
});
