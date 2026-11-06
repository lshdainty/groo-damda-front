// 계좌·카드 관리 목록(I-17 25 ~ 31) — 탭 없이 묶음 넷, 대출은 제 묶음, 합계는 총액 포함만 · 외화는 원화로 · 빼기 U+2212,
// 줄 끝에 화살표 · ⋮ · 연필 · 휴지통이 없고, 실패는 빈 글이 아니라 Result Section 이다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// 저장 · 실패 알림이 useSnackbar 를 쓴다 — 앱 맨 위(src/app/index.tsx)처럼 공급자로 감싼다
import { SnackbarProvider } from "@/shared/ds/snackbar";
import type { Asset } from "@/entities/asset";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const state = vi.hoisted(() => ({
  assets: [] as unknown[],
  isLoading: false,
  isError: false,
  data: true,
  refetched: 0,
  opened: null as string | null,
  live: new Map<number, { value: number }>(),
  useAssetsOpts: undefined as { silent?: boolean } | undefined,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "ko" } }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/features/asset", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/asset")>()),
  // 라이브 평가는 이 시험 밖 — 빈 맵(연결 없음)
  useInvestValuation: () => state.live,
  useAssets: (opts?: { silent?: boolean }) => {
    state.useAssetsOpts = opts;
    return {
      data: state.data ? { assets: state.assets } : undefined,
      isLoading: state.isLoading,
      isError: state.isError,
      refetch: () => {
        state.refetched += 1;
      },
    };
  },
  useCreateAsset: () => ({ mutate: () => {}, isPending: false }),
  useUpdateAsset: () => ({ mutate: () => {}, isPending: false }),
  useDeleteAsset: () => ({ mutateAsync: async () => {}, isPending: false }),
}));
vi.mock("./AssetEditDialog", () => ({
  AssetEditDialog: (p: { item: { rowId: number } | null }) => {
    state.opened = p.item ? `edit-${p.item.rowId}` : "create";
    return null;
  },
}));

const { AccountManager } = await import("./AccountManager");

const asset = (
  rowId: number,
  assetType: string,
  assetName: string,
  balance: number,
  extra: Record<string, unknown> = {},
) =>
  ({
    rowId,
    assetName,
    assetType,
    balance,
    institution: null,
    color: null,
    memo: null,
    currency: "KRW",
    isIncludedInTotal: "Y",
    isAmountHidden: "N",
    createAt: "2026-01-01T00:00:00",
    modifyAt: "2026-01-01T00:00:00",
    ...extra,
  }) as unknown as Asset;

let container: HTMLDivElement;
let root: Root;

function render(mobile: boolean, addRequest = 0) {
  act(() =>
    root.render(
      <SnackbarProvider>
        <MemoryRouter initialEntries={["/desk/settings?section=accounts"]}>
          <AccountManager mobile={mobile} addRequest={addRequest} />
        </MemoryRouter>
      </SnackbarProvider>,
    ),
  );
}
const text = () => container.textContent ?? "";
const headings = () =>
  [...container.querySelectorAll("h2")].map((h) => h.textContent);

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  state.assets = [
    asset(1, "BANK_ACCOUNT", "주거래", 1_000_000),
    asset(2, "SAVINGS", "적금", 500_000, { isIncludedInTotal: "N" }),
    asset(3, "CREDIT_CARD", "생활 카드", -300_000),
    asset(4, "LOAN", "전세 대출", -2_000_000),
    asset(5, "INVESTMENT", "연금", 700_000),
  ];
  state.isLoading = false;
  state.isError = false;
  state.data = true;
  state.refetched = 0;
  state.opened = null;
  state.live = new Map();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("묶음 한 목록(I-17 25 · 27)", () => {
  it.each([true, false])(
    "탭 없이 계좌·예금 → 투자 → 카드 → 대출 차례로 그리고 대출이 제 묶음이다 (mobile=%s)",
    (mobile) => {
      render(mobile);
      expect(container.querySelector('[role="tab"]')).toBeNull();
      expect(headings()).toEqual([
        "accountDepositTitle",
        "group.invest",
        "group.card",
        "assetType.loan",
      ]);
    },
  );

  it("투자 · 대출은 있을 때만, 계좌 · 카드는 비어도 그리고 '없어요' 한 줄을 둔다", () => {
    state.assets = [asset(1, "BANK_ACCOUNT", "주거래", 1000)];
    render(true);
    expect(headings()).toEqual(["accountDepositTitle", "group.card"]);
    expect(text()).toContain("noItems");
  });

  it("합계 — 총액 제외는 빼고, 카드 · 대출은 U+2212 로 빼기", () => {
    render(true);
    const t = text();
    expect(t).toContain("1,000,000"); // 적금 500,000 은 총액 제외
    expect(t).not.toContain("1,500,000");
    expect(t).toMatch(/−\D*300,000/);
    expect(t).toMatch(/−\D*2,000,000/);
  });

  it("외화는 원화로 환산해 더한다 — USD 1,000 이 1,000원이 아니다", () => {
    state.assets = [
      asset(1, "BANK_ACCOUNT", "달러 통장", 1000, {
        currency: "USD",
        exchangeRate: 1400,
      }),
    ];
    render(true);
    expect(text()).toContain("1,400,000");
  });

  it("줄 끝에 화살표 · 더보기 · 연필 · 휴지통이 없다", () => {
    render(false);
    expect(container.querySelector("svg.lucide-chevron-right")).toBeNull();
    expect(container.querySelector('button[title="editAction"]')).toBeNull();
    expect(container.querySelector("svg.lucide-ellipsis-vertical")).toBeNull();
    expect(container.querySelector("svg.lucide-trash-2")).toBeNull();
  });

  it("설명에 영문 소문자 종류 이름이 없다", () => {
    state.assets = [asset(1, "CASH", "지갑", 1000)];
    render(true);
    expect(text()).not.toMatch(/\bcash\b/);
  });
});

describe("줄 설명 · 실패 호출 (I-17 후속)", () => {
  it("예금 · 적금은 둘 다 SAVINGS 라 종류 이름을 '예적금' 으로 쓴다(정기예금에 '적금' 이라 쓰지 않는다)", () => {
    state.assets = [asset(2, "SAVINGS", "정기예금", 10_000_000)];
    render(true);
    expect(text()).toContain("assetType.savingsDeposit");
    expect(text()).not.toContain("assetType.savings\n");
  });

  it("신용카드 결제일은 한 번만 — '{d}일 결제' 하나(매월 문구와 겹치지 않는다)", () => {
    state.assets = [
      asset(3, "CREDIT_CARD", "생활 카드", -300_000, {
        institution: "삼성카드",
        paymentDay: 14,
      }),
    ];
    render(true);
    const t = text();
    expect(t.split("paymentDayLabel").length - 1).toBe(1);
    expect(t).not.toContain("assetDetail.billedMonthly");
  });

  it("관리 화면의 자산 목록 호출은 silent — 전역 오류 토스트 없이 화면 안 실패 한 벌만", () => {
    render(true);
    expect(state.useAssetsOpts).toEqual({ silent: true });
  });
});

describe("투자 줄 — 자산 화면과 같은 라이브 평가", () => {
  it("연동 보유가 있는 투자 자산은 라이브 평가액 + 예수금으로 그린다", () => {
    state.assets = [
      asset(5, "INVESTMENT", "연금", 700_000, {
        cashBalance: 100_000,
        holdings: [{ linked: true, tossSymbol: "A005930", quantity: 1 }],
      }),
    ];
    state.live = new Map([[5, { value: 900_000 }]]);
    render(true);
    expect(text()).toContain("1,000,000"); // 900,000 + 예수금 100,000
    expect(text()).not.toContain("700,000");
  });
});

describe("실패 · 빈 · 추가", () => {
  it("실패하면 빈 글이 아니라 다시 시도가 있는 Result Section", () => {
    state.isError = true;
    state.data = false;
    render(false);
    expect(text()).toContain("manager.loadFailed");
    expect(text()).not.toContain("emptyTitle");
    const retry = [...container.querySelectorAll("button")].pop();
    expect(retry).toBeDefined();
    act(() => retry!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(state.refetched).toBe(1);
  });

  it("목록 실패 크기 — 폰은 화면 전체라 large, 데스크톱 카드 안은 medium", () => {
    state.isError = true;
    state.data = false;
    render(true);
    expect(
      container
        .querySelector('[data-slot="result-section"]')
        ?.getAttribute("data-size"),
    ).toBe("large");
    render(false);
    expect(
      container
        .querySelector('[data-slot="result-section"]')
        ?.getAttribute("data-size"),
    ).toBe("medium");
  });

  it("자산 0개 — 묶음 대신 빈 Result Section, 버튼은 없다", () => {
    state.assets = [];
    render(true);
    expect(text()).toContain("emptyTitle");
    // 이 화면 전용 글(자기 자신을 가리키는 asset 의 emptyDesc 가 아니다) — 상단 [추가] 를 가리킨다
    expect(text()).toContain("manager.emptyHint");
    expect(text()).not.toContain("emptyDesc");
    expect(headings()).not.toContain("accountDepositTitle");
    expect(container.querySelectorAll("button").length).toBe(0);
  });

  it("폰 addRequest 가 올라가면 폼 1단계(종류 없이)가 열린다", () => {
    render(true, 0);
    expect(state.opened).toBeNull();
    render(true, 1);
    expect(state.opened).toBe("create");
  });

  it("데스크톱 머리 [추가] 가 폼을 연다", () => {
    render(false);
    // ManagerHead 는 설정 틀 밖이면 제자리에 그린다
    const add = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "add",
    );
    expect(add).toBeDefined();
    act(() => add!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(state.opened).toBe("create");
  });
});
