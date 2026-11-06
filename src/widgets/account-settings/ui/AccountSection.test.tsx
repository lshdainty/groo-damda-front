// 계정 구역(I-14 6 ~ 10 · 46) — 줄 구성 · Google 한 줄 · 서버 글이 화면에 닿지 않는 것.
//
// 잠그는 것: ① 누를 수 없던 줄 넷(로그인 기록 · Apple · 카카오 · 네이버)이 없다 ② 연동 목록에 KAKAO · NAVER 가 있어도 줄은 Google 하나
// ③ 불러오는 중 버튼 막힘 · 실패는 고정 글 + 다시 시도 ④ 줄 사이 선이 없고 해지 줄 제목만 critical ⑤ 머리는 카드 없이(폰) · 가로 카드(데스크톱).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const state = vi.hoisted(() => ({
  providers: {
    data: undefined as unknown,
    isLoading: false,
    isError: false,
    isRefetching: false,
    refetch: () => {},
  },
  unlinkError: false,
  features: ["SECURITIES"] as string[],
  // 구독 조회 — 가격은 서버가 준다(I-14 34)
  sub: {
    data: undefined as unknown,
    isLoading: false,
  },
  // 기능 조회를 통째로 바꿔 끼우는 자리 — 대기 · 실패(null 이면 features 로)
  featuresQ: null as null | {
    data: unknown;
    isLoading?: boolean;
    isError?: boolean;
  },
  plans: { data: undefined as unknown, isLoading: false },
}));
const toasts = vi.hoisted(() => ({
  error: [] as string[],
  opts: [] as { action?: { label: string; onClick: () => void } }[],
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    // 날짜를 끼우는 글은 값을 이어 붙인다 — 화면 날짜 꼴로 넘기는지 잰다
    t: (k: string, p?: Record<string, unknown>) =>
      p && "date" in p ? `${k}:${String(p.date)}` : k,
    i18n: { language: "ko" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/shared/ds/snackbar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/ds/snackbar")>()),
  useSnackbar: () => ({
    show: (o: {
      message: string;
      tone?: string;
      action?: { label: string; onClick: () => void };
    }) => {
      if (o.tone !== "critical") return;
      toasts.error.push(o.message);
      toasts.opts.push(o);
    },
    dismiss: () => {},
  }),
}));
vi.mock("@/features/user", () => ({
  useCurrentUser: () => ({
    data: {
      userName: "남궁하늘별빛가람솔나래",
      userEmail: "namgung.haneul.byeolbit.garam.solnarae@example.com",
      joinedAt: "2026-01-05T00:00:00",
    },
  }),
  WithdrawDialog: () => null,
}));
vi.mock("@/features/auth", () => ({ useAuth: () => ({ logout: () => {} }) }));
const sec = vi.hoisted(() => ({
  wide: false,
  mounts: 0,
  mobile: [] as boolean[],
}));
vi.mock("@/shared/ds/overlay", async (orig) => ({
  ...(await orig<typeof import("@/shared/ds/overlay")>()),
  useWideSurface: () => sec.wide,
}));
vi.mock("@/features/subscription/ui/SecuritiesLinkDialog", async () => {
  const { useEffect } = await import("react");
  return {
    SecuritiesLinkDialog: ({ mobile }: { mobile: boolean }) => {
      sec.mobile.push(mobile);
      useEffect(() => {
        sec.mounts += 1;
      }, []);
      return <div data-sec-dialog />;
    },
  };
});
vi.mock("@/features/subscription/model/useSubscription", () => ({
  useMyFeatures: () =>
    state.featuresQ ?? { data: { features: state.features } },
  useSubscriptionPlans: () => state.plans,
  useMySubscription: () => state.sub,
}));
vi.mock("@/features/oauth-link", () => ({
  oauthLinkApi: { startLink: async () => ({ startUrl: "#" }) },
  useOAuthProviders: () => state.providers,
  useUnlinkOAuth: () => ({
    isPending: false,
    mutate: (
      _p: string,
      cb: { onError?: () => void; onSuccess?: () => void },
    ) => {
      if (state.unlinkError) cb.onError?.();
      else cb.onSuccess?.();
    },
  }),
}));
vi.mock("@/shared/lib/groo/hide-amounts-core", () => ({
  useHiddenCards: () => new Set<string>(),
}));
vi.mock("@/widgets/sidebar/ui/PasswordChangeDialog", () => ({
  PasswordChangeDialog: () => null,
}));

const { AccountSection } = await import("./AccountSection");

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  toasts.error.length = 0;
  toasts.opts.length = 0;
  state.unlinkError = false;
  state.features = ["SECURITIES"];
  state.sub = { data: undefined, isLoading: false };
  state.featuresQ = null;
  state.plans = { data: undefined, isLoading: false };
  state.providers = {
    data: [
      { type: "GOOGLE", name: "Google", authUrl: "", linked: true },
      { type: "KAKAO", name: "Kakao", authUrl: "", linked: false },
      { type: "NAVER", name: "Naver", authUrl: "", linked: false },
    ],
    isLoading: false,
    isError: false,
    isRefetching: false,
    refetch: () => {},
  };
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (mobile: boolean, onOpenSubscription: () => void = () => {}) =>
  act(() =>
    root.render(
      <AccountSection
        mobile={mobile}
        onOpenHideAmounts={() => {}}
        onOpenDevices={() => {}}
        onOpenSubscription={onOpenSubscription}
      />,
    ),
  );
const text = () => container.textContent ?? "";
const buttons = () => [...container.querySelectorAll("button")];

describe("계정 구역 줄", () => {
  it("누를 수 없던 줄 넷이 없다 — 로그인 기록 · Apple · 카카오 · 네이버", () => {
    render(true);
    expect(text()).not.toContain("account.loginHistory");
    expect(text()).not.toContain("Apple");
    expect(text()).not.toContain("account.provider.kakao");
    expect(text()).not.toContain("account.provider.naver");
  });

  it("연동 목록에 KAKAO · NAVER 가 있어도 연결된 계정 줄은 Google 하나다", () => {
    render(true);
    const group = container.querySelector(
      '[aria-label="account.group.connected"], ul[aria-labelledby]',
    );
    expect(group).not.toBeNull();
    expect(text()).toContain("Google");
    expect(text()).not.toMatch(/Kakao|Naver/);
    expect(text()).toContain("account.unlink");
  });

  it("Pro 가 아니면 증권 데이터 연동 묶음이 없다", () => {
    state.features = [];
    render(true);
    expect(text()).not.toContain("account.group.securities");
  });

  it("폰 머리는 카드 없이 흰 면 위, 데스크톱 머리는 카드 안 가로 한 줄이다", () => {
    render(true);
    const phoneHead = container.querySelector("[data-account-head]")!;
    expect(phoneHead.closest("[data-slot=card]")).toBeNull();
    act(() => root.unmount());
    root = createRoot(container);
    render(false);
    expect(
      container.querySelector("[data-account-head]")?.className,
    ).toBeDefined();
  });

  it("해지 줄은 제목만 critical 이고 줄 사이에 선을 그리지 않는다", () => {
    render(true);
    const crit = [...container.querySelectorAll(".text-fg-critical")].map(
      (e) => e.textContent,
    );
    expect(crit).toContain("account.withdraw.label");
    expect(
      container.querySelectorAll("hr, [data-slot=list-divider]"),
    ).toHaveLength(0);
  });

  it("긴 이름 · 이메일은 줄 끝에서 끊긴다(overflow-wrap: anywhere)", () => {
    render(true);
    const email = [...container.querySelectorAll("div")].find((d) =>
      d.textContent?.startsWith("namgung"),
    )!;
    expect(email.className).toContain("[overflow-wrap:anywhere]");
  });
});

describe("구독 줄 (I-14 34)", () => {
  const sub = (price: number | null, durationMonths: number | null) => ({
    data: {
      planCode: "SECURITIES",
      planName: "담다 Pro",
      status: "ACTIVE",
      startedAt: "2026-09-11T12:00:00",
      currentPeriodEnd: "2026-10-11T12:00:00",
      autoRenew: true,
      price,
      durationMonths,
    },
    isLoading: false,
  });
  // ds ListButtonItem 의 단추 안은 제목 · 설명뿐이고 값 · 꺾쇠는 줄(li)의 붙이개다 — 값은 줄에서, 누르기는 단추로
  const row = () =>
    [...container.querySelectorAll("button[data-list-action]")]
      .find((b) => b.textContent?.includes("담다 Pro"))!
      .closest("[data-slot=list-item]") as HTMLElement;
  const rowButton = () =>
    row().querySelector<HTMLButtonElement>("button[data-list-action]")!;

  it("값이 서버 가격이다 — 월간 12000 이면 '12,000원 / 월', 연간이면 '/ 년'(박힌 9,900 이 아니다)", () => {
    state.sub = sub(12_000, 1);
    render(true);
    expect(row().textContent).toContain("12,000");
    expect(row().textContent).toContain("account.sub.perMonth");
    expect(row().textContent).not.toContain("9,900");
    act(() => root.unmount());
    root = createRoot(container);
    state.sub = sub(120_000, 12);
    render(true);
    expect(row().textContent).toContain("120,000");
    expect(row().textContent).toContain("account.sub.perYear");
  });

  it("다음 결제 날짜는 화면 날짜 꼴이다 — 2026-10-11 을 그대로 보이지 않는다", async () => {
    const { formatDateSmart } = await import("@/shared/lib/date");
    state.sub = sub(9_900, 1);
    render(true);
    expect(row().textContent).toContain(formatDateSmart("2026-10-11"));
    expect(row().textContent).not.toContain("2026-10-11");
  });

  it("꺾쇠가 붙고, 누르면 구독 관리 페이지로 보낸다(대화상자를 열지 않는다)", () => {
    state.sub = sub(9_900, 1);
    const open = vi.fn();
    render(true, open);
    expect(row().querySelector("svg.lucide-chevron-right")).not.toBeNull();
    act(() => rowButton().click());
    expect(open).toHaveBeenCalledTimes(1);
    expect(container.querySelector("[role=dialog]")).toBeNull();
  });

  it("구독을 받는 중이면 값 자리가 Skeleton 이고, 가격이 없으면 값 없이 설명만 그린다", () => {
    state.sub = { data: undefined, isLoading: true };
    render(true);
    expect(row().querySelector("[data-slot=skeleton]")).not.toBeNull();
    act(() => root.unmount());
    root = createRoot(container);
    state.sub = sub(null, null);
    render(true);
    expect(row().querySelector("[data-slot=skeleton]")).toBeNull();
    expect(row().textContent).not.toContain("account.sub.per");
  });

  it("/me 에 가격이 없으면(옛 서버) planCode 로 요금제 목록에서 가격 · 주기를 찾아 쓴다", () => {
    state.sub = sub(null, null);
    state.plans = {
      data: [
        { planCode: "OTHER", planName: "x", durationMonths: 1, price: 1 },
        {
          planCode: "SECURITIES",
          planName: "담다 Pro",
          durationMonths: 12,
          price: 99_000,
        },
      ],
      isLoading: false,
    };
    render(true);
    expect(row().textContent).toContain("99,000");
    expect(row().textContent).toContain("account.sub.perYear");
  });

  it("기능 조회가 대기 중이면 Free 배지 · 권유 글을 그리지 않고 Skeleton 이다", () => {
    state.featuresQ = { data: undefined, isLoading: true };
    render(true);
    expect(text()).not.toContain("account.sub.proPromo");
    expect(text()).not.toContain("Free");
    expect(row().querySelector("[data-slot=skeleton]")).not.toBeNull();
  });

  it("기능 조회가 실패하면 Free 배지 · 권유 글 없이 '담다 Pro' 줄만 선다", () => {
    state.featuresQ = { data: undefined, isError: true };
    render(true);
    expect(text()).not.toContain("account.sub.proPromo");
    expect(text()).not.toContain("Free");
    expect(row().textContent).toContain("담다 Pro");
  });

  it("Pro 가 아니면 값 없이 권유 문구 + 꺾쇠", () => {
    state.features = [];
    state.sub = sub(9_900, 1);
    render(true);
    expect(row().textContent).toContain("account.sub.proPromo");
    expect(row().textContent).not.toContain("account.sub.per");
    expect(row().querySelector("svg.lucide-chevron-right")).not.toBeNull();
  });
});

describe("프로필 [수정] (D3 B)", () => {
  it("막은 단추 + 이유 Callout 이고, 단추의 설명이 Callout 이다", () => {
    for (const mobile of [true, false]) {
      act(() => root.unmount());
      root = createRoot(container);
      render(mobile);
      const edit = buttons().find((b) => b.textContent === "account.edit")!;
      expect(edit.disabled).toBe(true);
      const reason = container.querySelector(
        `#${CSS.escape(edit.getAttribute("aria-describedby")!)}`,
      );
      expect(reason?.textContent).toContain("account.editSoon");
    }
  });
});

describe("Google 줄 상태", () => {
  it("불러오는 중에는 버튼이 막힌다", () => {
    state.providers = { ...state.providers, data: undefined, isLoading: true };
    render(true);
    const btn = buttons().find((b) => b.textContent === "account.link")!;
    expect(btn.disabled).toBe(true);
  });

  it("실패하면 고정 글 + [다시 시도] — 서버 글이 아니다", () => {
    let refetched = 0;
    state.providers = {
      ...state.providers,
      data: undefined,
      isError: true,
      refetch: () => {
        refetched += 1;
      },
    };
    render(true);
    expect(text()).toContain("account.providersError");
    const retry = buttons().find((b) => b.textContent === "common.retry")!;
    act(() => retry.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(refetched).toBe(1);
  });

  it("해제가 실패하면 고정 글 하나만 알린다", () => {
    state.unlinkError = true;
    render(true);
    const unlink = buttons().find((b) => b.textContent === "account.unlink")!;
    act(() => unlink.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(toasts.error).toEqual(["account.toast.unlinkError"]);
    // 다시 하면 되는 실패라 "다시 시도" 를 붙인다 — 누르면 다시 해제한다
    expect(toasts.opts[0]?.action?.label).toBe("common.retry");
    act(() => toasts.opts[0]!.action!.onClick());
    expect(toasts.error).toHaveLength(2);
  });
});

describe("증권사 연동 시트의 표면 (I-wrap-b1 ε 9)", () => {
  it("표면은 1280 으로 가른다 — 폰 · 768 ~ 1279 모두 시트, 셸이 768 을 넘나들어도 다시 붙지 않는다", () => {
    sec.wide = false;
    sec.mounts = 0;
    sec.mobile.length = 0;
    render(true);
    const open = buttons().find((b) =>
      b.textContent?.includes("account.securities.label"),
    );
    if (!open) throw new Error("증권사 연동 줄을 찾지 못했다");
    act(() => open.click());
    expect(container.querySelector("[data-sec-dialog]")).not.toBeNull();
    render(false);
    expect(sec.mobile[sec.mobile.length - 1]).toBe(true);
    expect(sec.mounts).toBe(1);
  });
});
