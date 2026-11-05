// 구독 관리 구역(I-14 G 27 ~ 33) — 예전 구독 대화상자 시험(기능 비교표 · 해지 유예 날짜 · 유예에 '구독하기' 없음)의 뜻을 새 모양에서 잠근다.
//
// 잠그는 것: ① 기능 비교 — 768 미만은 List 줄 셋 · 768 이상은 Table(같은 줄 셋 · 증권은 Free 없음 · Pro 있음), 없는 제한을 광고하지 않는다
// ② 해지 유예 날짜 라벨(자동갱신이 꺼졌으면 종료일) ③ 유예에 Pro 시작하기가 안 뜨고 Free 에는 뜬다
// ④ 가격 · 할인율은 서버 값 ⑤ 연간을 고르면 연간 플랜 코드로 구독 ⑥ 연간 행이 없으면 주기 고르기 없음
// ⑦ 불러오는 중 Skeleton · 실패 Result Section · 둘 다 바닥 버튼 없음 ⑧ 해지 확인 실패는 useConfirmFail 로.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

// 키와 넘긴 값(날짜 · pct · 가격)을 그대로 흘려보낸다 — 화면이 어느 키로 무엇을 말했는지를 글로 읽는다.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, p?: Record<string, unknown>) =>
      p ? `${k}${JSON.stringify(p)}` : k,
    i18n: { language: "ko" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
const toasts = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: toasts }));
const confirmFail = vi.hoisted(() => vi.fn());
vi.mock("@/shared/lib/confirm-fail", () => ({
  useConfirmFail: () => confirmFail,
}));
vi.mock("@/shared/ds/top-navigation", () => ({
  TopNavigation: ({ children }: { children: React.ReactNode }) => (
    <header data-slot="top-navigation">{children}</header>
  ),
  TopNavigationBackButton: ({ onClick }: { onClick?: () => void }) => (
    <button type="button" aria-label="back" onClick={onClick} />
  ),
  TopNavigationTitle: ({ children }: { children: React.ReactNode }) => (
    <h1>{children}</h1>
  ),
}));
vi.mock("@/shared/ui/groo/manager-layout", () => ({
  ManagerHead: ({ title }: { title: string }) => (
    <h1 data-manager-head>{title}</h1>
  ),
}));

const server = vi.hoisted(() => ({
  features: { data: { features: [] as string[] } } as {
    data?: { features: string[] };
    isLoading?: boolean;
    isError?: boolean;
    isRefetching?: boolean;
    refetch: () => void;
  },
  sub: { data: undefined as unknown, refetch: () => {} } as {
    data?: unknown;
    isLoading?: boolean;
    isError?: boolean;
    isRefetching?: boolean;
    refetch: () => void;
  },
  plans: { data: [] as unknown[], refetch: () => {} } as {
    data?: unknown[];
    isLoading?: boolean;
    isError?: boolean;
    isRefetching?: boolean;
    refetch: () => void;
  },
  subscribe: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock("@/features/subscription/model/useSubscription", () => ({
  useMyFeatures: () => server.features,
  useMySubscription: () => server.sub,
  useSubscriptionPlans: () => server.plans,
  useSubscribe: () => ({ mutate: server.subscribe, isPending: false }),
  useCancelSubscription: () => ({
    mutateAsync: server.cancel,
    isPending: false,
  }),
}));

const { SubscriptionSection } = await import("./SubscriptionSection");

// groo-sql 시드 그대로 — 월간 9,900 / 연간 99,000(차례 그대로)
const MONTHLY = {
  planCode: "SECURITIES",
  planName: "담다 Pro",
  durationMonths: 1,
  price: 9_900,
};
const YEARLY = {
  planCode: "SECURITIES_YEARLY",
  planName: "담다 Pro 연간",
  durationMonths: 12,
  price: 99_000,
};

/** `currentPeriodEnd` 는 정오(UTC)로 둔다 — 로컬 달력으로 옮기는 자리라 자정이면 시간대에 따라 하루가 밀린다. */
const subscription = (over: Record<string, unknown> = {}) => ({
  planCode: "SECURITIES",
  planName: "담다 Pro",
  status: "ACTIVE",
  startedAt: "2026-09-11T12:00:00",
  currentPeriodEnd: "2026-10-11T12:00:00",
  autoRenew: true,
  price: 9_900,
  durationMonths: 1,
  ...over,
});

let container: HTMLDivElement;
let root: Root;

function setWide(wide: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: wide && query.includes("min-width: 768px"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  setWide(false);
  server.features = { data: { features: [] }, refetch: () => {} };
  server.sub = { data: null, refetch: () => {} };
  server.plans = { data: [MONTHLY, YEARLY], refetch: () => {} };
  server.subscribe = vi.fn();
  server.cancel = vi.fn().mockResolvedValue(undefined);
  confirmFail.mockClear();
  toasts.success.mockClear();
  toasts.error.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const mount = (mobile: boolean) =>
  act(() => root.render(<SubscriptionSection mobile={mobile} />));
const text = () => container.textContent ?? "";
const buttonLabels = () =>
  [...container.querySelectorAll("button")].map((b) => b.textContent ?? "");
const asPro = (sub: unknown = subscription()) => {
  server.features = { data: { features: ["SECURITIES"] }, refetch: () => {} };
  server.sub = { data: sub, refetch: () => {} };
};

describe("기능 비교 (30)", () => {
  const FEATURES = ["feature.core", "feature.budget", "feature.securities"];

  it("768 미만: 표를 그리지 않고 List 줄 셋 — 값 글은 그 기능이 있는 플랜", () => {
    mount(true);
    expect(container.querySelector("table")).toBeNull();
    const list = container.querySelector("[aria-labelledby]")!;
    const rows = [...list.querySelectorAll("[data-slot=list-item]")];
    expect(
      rows.map((r) => r.querySelector("[data-slot=list-title]")?.textContent),
    ).toEqual(FEATURES);
    expect(
      rows.map((r) => r.querySelector("[data-slot=list-suffix]")?.textContent),
    ).toEqual(["Free · Pro", "Free · Pro", "Pro"]);
  });

  it("768 이상: Table — 같은 줄 셋, 증권은 Free 없음(minus) · Pro 있음(check), 칸 이름 있음/없음", () => {
    setWide(true);
    mount(false);
    const rows = [...container.querySelectorAll("tbody tr")];
    expect(rows.map((r) => r.querySelector("th")?.textContent)).toEqual(
      FEATURES,
    );
    const icon = (td: Element) =>
      [...(td.querySelector("svg")?.classList ?? [])]
        .find((c) => c.startsWith("lucide-"))
        ?.slice(7);
    for (const r of rows) {
      for (const td of r.querySelectorAll("td"))
        expect(["check", "minus"]).toContain(icon(td));
    }
    const sec = rows.find(
      (r) => r.querySelector("th")?.textContent === "feature.securities",
    )!;
    expect([...sec.querySelectorAll("td")].map(icon)).toEqual([
      "minus",
      "check",
    ]);
    expect(sec.textContent).toContain("featureNo");
    expect(sec.textContent).toContain("featureYes");
  });

  it("없는 제한을 광고하지 않는다 — 거래 건수 · 가져오기/내보내기 · 캘린더 공유 · 카드 혜택 줄이 없다", () => {
    mount(true);
    for (const gone of [
      "feature.txLog",
      "feature.txFree",
      "feature.txUnlimited",
      "feature.importExport",
      "feature.multiCalendar",
      "feature.cardBenefit",
    ])
      expect(text()).not.toContain(gone);
  });
});

describe("지금 플랜 · 해지 유예 (28 · 31)", () => {
  it("자동갱신이 꺼졌으면 종료일로 말한다 — '다음 결제' 가 아니다", () => {
    asPro(subscription({ status: "CANCELLED", autoRenew: false }));
    mount(true);
    expect(text()).toContain('activeUntil{"date":"2026-10-11"}');
    expect(text()).not.toContain("nextBill");
  });

  it("자동갱신이 켜져 있으면 종전 '다음 결제' 문구 그대로다", () => {
    asPro();
    mount(true);
    expect(text()).toContain('nextBill{"date":"2026-10-11"}');
    expect(text()).not.toContain("activeUntil");
  });

  it("만료일이 없으면 날짜 라벨 없이 그냥 선다 — 안 터진다", () => {
    asPro(subscription({ autoRenew: false, currentPeriodEnd: null }));
    mount(true);
    expect(text()).toContain("proInUse");
    expect(text()).not.toContain("activeUntil");
    expect(text()).not.toContain("nextBill");
  });

  it("유예 기간에 'Pro 시작하기' 가 뜨지 않고 [구독 해지] 만 있다 — ghost critical", () => {
    asPro(subscription({ status: "CANCELLED", autoRenew: false }));
    mount(true);
    expect(buttonLabels()).toContain("cancelSub");
    expect(buttonLabels()).not.toContain("startPro");
    const cancel = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "cancelSub",
    )!;
    expect(cancel.className).toContain("text-fg-critical");
  });

  it("권한이 없으면 Free 안내와 [Pro 시작하기] 가 서고 [구독 해지] 는 없다", () => {
    mount(true);
    expect(text()).toContain("freeInUse");
    expect(text()).toContain("freeLocked");
    expect(buttonLabels()).toContain("startPro");
    expect(buttonLabels()).not.toContain("cancelSub");
  });
});

describe("가격 · 주기 (29 · 32)", () => {
  it("요금과 할인율은 서버 가격이다 — 박힌 9,900 · 99,000 · 17 이 아니다", () => {
    server.plans = {
      data: [
        { ...MONTHLY, price: 10_000 },
        { ...YEARLY, price: 96_000 },
      ],
      refetch: () => {},
    };
    mount(true);
    expect(text()).toContain("10,000");
    expect(text()).not.toContain("9,900");
    // round((1 − 96000 ÷ (10000 × 12)) × 100) = 20
    expect(text()).toContain('cycleYearly{"pct":20}');
    expect(text()).not.toContain('"pct":17');
  });

  it("연간을 고르면 연간 가격 · 월 환산 · 절약 %, 구독하면 연간 플랜 코드를 보낸다", () => {
    mount(true);
    const yearly = [
      ...container.querySelectorAll<HTMLElement>("[role=radio]"),
    ].find((r) => r.textContent?.includes("cycleYearly"))!;
    act(() => yearly.click());
    expect(text()).toContain("99,000");
    expect(text()).toContain('pricePerMonthNote{"price":"8,250","pct":17}');
    const start = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "startPro",
    )!;
    act(() => start.click());
    expect(server.subscribe).toHaveBeenCalledTimes(1);
    expect(server.subscribe.mock.calls[0]![0]).toBe("SECURITIES_YEARLY");
  });

  it("월간이 기본이고 월간 플랜 코드로 구독한다", () => {
    mount(true);
    const start = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "startPro",
    )!;
    act(() => start.click());
    expect(server.subscribe.mock.calls[0]![0]).toBe("SECURITIES");
  });

  it("구독 중인 주기가 처음 값이다 — 연간 구독이면 연간으로 열린다", () => {
    asPro(
      subscription({
        planCode: "SECURITIES_YEARLY",
        price: 99_000,
        durationMonths: 12,
      }),
    );
    mount(true);
    const checked = container.querySelector("[role=radio][aria-checked=true]");
    expect(checked?.textContent).toContain("cycleYearly");
  });

  it("연간 행이 없으면 주기 고르기를 그리지 않고 월간 하나로 보인다", () => {
    server.plans = { data: [MONTHLY], refetch: () => {} };
    mount(true);
    expect(container.querySelector("[role=radiogroup]")).toBeNull();
    expect(text()).toContain("9,900");
    expect(text()).not.toContain("cycleYearly");
  });

  it("구독 성공은 알림 · 실패는 고정 글 알림(서버 글이 아니다)", () => {
    mount(true);
    const start = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "startPro",
    )!;
    act(() => start.click());
    const opts = server.subscribe.mock.calls[0]![1] as {
      onSuccess: () => void;
      onError: () => void;
    };
    opts.onSuccess();
    expect(toasts.success).toHaveBeenCalledWith("toast.subscribed");
    opts.onError();
    expect(toasts.error).toHaveBeenCalledWith("toast.subscribeFailed");
  });
});

describe("불러오기 · 실패 (33)", () => {
  it("불러오는 중에는 줄 Skeleton · 주기 고르기 없음 · 바닥 버튼 없음, 안내와 기능 비교는 그린다", () => {
    server.plans = { data: undefined, isLoading: true, refetch: () => {} };
    mount(true);
    expect(
      container.querySelector("[data-subscription-skeleton]"),
    ).not.toBeNull();
    expect(container.querySelector("[role=radiogroup]")).toBeNull();
    expect(buttonLabels()).not.toContain("startPro");
    expect(buttonLabels()).not.toContain("cancelSub");
    expect(text()).toContain("spotlightTitle");
    expect(text()).toContain("feature.securities");
  });

  it("실패하면 Result Section + [다시 시도](셋을 다시 부른다), 바닥 버튼은 없다", () => {
    const refetch = vi.fn();
    server.sub = { data: undefined, isError: true, refetch };
    const plansRefetch = vi.fn();
    server.plans = { data: [MONTHLY, YEARLY], refetch: plansRefetch };
    mount(true);
    expect(text()).toContain("loadError");
    expect(text()).toContain("loadErrorHint");
    expect(buttonLabels()).not.toContain("startPro");
    expect(buttonLabels()).not.toContain("cancelSub");
    const retry = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("common.retry"),
    )!;
    act(() => retry.click());
    expect(refetch).toHaveBeenCalled();
    expect(plansRefetch).toHaveBeenCalled();
  });
});

describe("해지 확인 (46)", () => {
  const openConfirm = () => {
    const open = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "cancelSub",
    )!;
    act(() => open.click());
    const dialog = document.body.querySelector("[role=alertdialog]")!;
    return dialog;
  };

  it("[유지하기] · [구독 해지] 를 묻고, 확정하면 해지 요청 뒤 알림", async () => {
    asPro();
    mount(true);
    const dialog = openConfirm();
    expect(dialog.textContent).toContain("cancelConfirmTitle");
    expect(dialog.textContent).toContain("keepSub");
    const ok = [...dialog.querySelectorAll("button")].find(
      (b) => b.textContent === "cancelSub",
    )!;
    await act(async () => ok.click());
    expect(server.cancel).toHaveBeenCalledTimes(1);
    expect(toasts.success).toHaveBeenCalledWith("toast.canceled");
  });

  it("해지가 실패하면 확인창을 닫고 useConfirmFail 로 알린다(고정 글 · 다시 시도)", async () => {
    asPro();
    server.cancel = vi.fn().mockRejectedValue(new Error("x"));
    mount(true);
    const dialog = openConfirm();
    const ok = [...dialog.querySelectorAll("button")].find(
      (b) => b.textContent === "cancelSub",
    )!;
    await act(async () => ok.click());
    expect(confirmFail).toHaveBeenCalledTimes(1);
    const arg = confirmFail.mock.calls[0]![0] as {
      message: string;
      retry: () => Promise<unknown>;
    };
    expect(arg.message).toBe("toast.cancelFailed");
    expect(typeof arg.retry).toBe("function");
    expect(toasts.error).not.toHaveBeenCalled();
  });
});

describe("껍데기 (27)", () => {
  it("폰: 제 껍데기(Top Navigation 제목 + 흰 면 + 바닥 띠), 제목 줄(ManagerHead) 없음", () => {
    mount(true);
    expect(
      container.querySelector("[data-slot=subscription-page]"),
    ).not.toBeNull();
    expect(container.querySelector("header h1")?.textContent).toBe("title");
    expect(container.querySelector("[data-manager-head]")).toBeNull();
    expect(container.querySelector("[data-slot=card]")).toBeNull();
  });

  it("데스크톱 · 태블릿: ManagerHead 제목만 + 카드 하나 + 카드 바닥 줄에 버튼", () => {
    setWide(true);
    mount(false);
    expect(container.querySelector("[data-manager-head]")?.textContent).toBe(
      "title",
    );
    expect(container.querySelectorAll("[data-slot=card]")).toHaveLength(1);
    expect(container.querySelector("[data-slot=subscription-page]")).toBeNull();
    const card = container.querySelector("[data-slot=card]")!;
    expect(card.textContent).toContain("startPro");
  });
});
