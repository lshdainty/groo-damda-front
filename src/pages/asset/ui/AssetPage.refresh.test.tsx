// 자산 화면의 '새로고침' 은 자산 목록·요약 두 쿼리만 다시 받았다(QA #149).
// 같은 화면에 있는 순자산 추이 · 저축목표 · 예정 결제는 그대로라, 버튼을 눌러도
// 절반은 옛 값이었다 — 그런데 화면은 새로 받은 것처럼 보인다.
//
// 여기서 고정하는 건 "버튼이 이 화면이 읽는 캐시를 전부 무효로 만드느냐" 다.
// 호출 횟수나 인자 모양이 아니라 **캐시에 실제로 남는 흔적**(isInvalidated)을 본다 —
// 무효화 방식을 바꿔도(refetch → invalidate 등) 뜻이 같으면 통과해야 한다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  assetKeys,
  recurringTransactionKeys,
  savingGoalKeys,
} from "@/shared/config";
import type { Asset } from "@/entities/asset";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const account: Asset = {
  rowId: 1,
  userRowId: 1,
  assetName: "주거래",
  assetType: "BANK_ACCOUNT",
  balance: 1_000_000,
  cashBalance: 1_000_000,
  holdingBalance: 0,
  currency: "KRW",
  exchangeRate: 1,
  color: null,
  institution: null,
  memo: null,
  sortOrder: 0,
  isIncludedInTotal: "Y",
  isAmountHidden: "N",
  cardCatalog: null,
  createAt: "2026-01-01T00:00:00",
  modifyAt: "2026-01-01T00:00:00",
};

// 훅은 세워 둔다 — 여기서 보는 건 네트워크가 아니라 버튼이 캐시에 남기는 흔적이다.
// 대신 캐시에는 이 화면이 실제로 쓰는 키를 손으로 심어 두고(seed) 그것들이 비워지는지 본다.
const stub = <T,>(data: T) => ({
  data,
  isLoading: false,
  isFetching: false,
  refetch: vi.fn(),
});

vi.mock("@/features/asset", () => ({
  useAssets: () => stub({ assets: [account] }),
  useAssetSummary: () =>
    stub({
      netWorth: 1_000_000,
      changeAmount: 0,
      changePercent: 0,
      lastMonthNetWorth: 1_000_000,
    }),
  useNetWorthTrend: () => stub([]),
  useInvestValuation: () => new Map(),
  useInvestValuationState: () => ({
    map: new Map(),
    priceFailed: false,
    retryPrices: () => {},
  }),
  holdingsOf: () => [],
}));
vi.mock("@/features/recurring-transaction", () => ({
  useRecurringTransactions: () => stub([]),
}));
vi.mock("@/features/savingGoal", () => ({
  useSavingGoals: () => stub({ goals: [] }),
}));
vi.mock("@/features/stock/model/useStockMaster", () => ({
  useStockSymbolName: () => ({ data: undefined }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
// 동적 아이콘만 세운다 — 비동기 로드라 act 경고를 남기고, 버튼과는 무관하다.
vi.mock("lucide-react/dynamic", async (importOriginal) => ({
  ...(await importOriginal<typeof import("lucide-react/dynamic")>()),
  DynamicIcon: () => <span />,
}));

const { AssetPage } = await import("./AssetPage");

/** 이 화면이 읽는 쿼리 — 어느 카드가 읽는지까지 적어 둔다. */
const SCREEN_QUERIES = [
  ["자산 목록", assetKeys.list()],
  ["순자산 요약", assetKeys.summary()],
  ["순자산 추이", assetKeys.netWorthTrend(12)],
  ["예정 결제", recurringTransactionKeys.list({ upcoming: true, limit: 6 })],
  ["저축목표", savingGoalKeys.list()],
] as const;

let container: HTMLDivElement;
let root: Root;
let queryClient: QueryClient;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: () => ({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    });
  }
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  queryClient = new QueryClient();
  for (const [, key] of SCREEN_QUERIES) queryClient.setQueryData(key, []);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render() {
  act(() =>
    root.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/desk/asset"]}>
          <Routes>
            <Route
              path="/desk"
              element={
                <Outlet context={{ mobile: false, onAddTx: () => {} }} />
              }
            >
              <Route path="asset" element={<AssetPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
}

const refreshButton = () =>
  Array.from(container.querySelectorAll("button")).find((b) =>
    (b.textContent ?? "").includes("refresh"),
  );

const isStale = (key: readonly unknown[]) =>
  queryClient.getQueryState(key)?.isInvalidated === true;

describe("자산 화면 새로고침 (QA #149)", () => {
  it("화면이 읽는 다섯 쿼리가 전부 캐시에 있다 — seed 가 실제 키인지 먼저 확인", () => {
    render();
    // 화면에 저축목표·예정 결제 카드가 실제로 떠 있다는 것부터 못 박는다.
    // 이게 깨지면 아래 무효화 목록이 화면과 어긋난 것이다.
    expect(container.textContent).toContain("savingGoals");
    expect(container.textContent).toContain("upcomingBills");
    for (const [name, key] of SCREEN_QUERIES) {
      expect(queryClient.getQueryState(key), name).toBeDefined();
    }
  });

  it("누르기 전에는 아무것도 비워지지 않았다", () => {
    render();
    for (const [name, key] of SCREEN_QUERIES) {
      expect(isStale(key), name).toBe(false);
    }
  });

  it("누르면 화면이 읽는 쿼리를 하나도 빼놓지 않고 비운다", () => {
    render();
    act(() => refreshButton()!.click());
    for (const [name, key] of SCREEN_QUERIES) {
      expect(isStale(key), name).toBe(true);
    }
  });

  it("이 화면과 무관한 캐시까지 쓸어내지는 않는다", () => {
    const unrelated = ["todos", "list", undefined] as const;
    queryClient.setQueryData(unrelated, []);
    render();
    act(() => refreshButton()!.click());
    expect(isStale(unrelated)).toBe(false);
  });
});
