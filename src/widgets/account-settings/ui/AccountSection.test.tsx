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
}));
const toasts = vi.hoisted(() => ({
  error: [] as string[],
  opts: [] as { action?: { label: string; onClick: () => void } }[],
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: "ko" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("sonner", () => ({
  toast: {
    success: () => {},
    error: (
      m: string,
      o?: { action?: { label: string; onClick: () => void } },
    ) => {
      toasts.error.push(m);
      toasts.opts.push(o ?? {});
    },
  },
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
vi.mock("@/features/subscription/ui/SubscriptionDialog", () => ({
  SubscriptionDialog: () => null,
}));
vi.mock("@/features/subscription/ui/SecuritiesLinkDialog", () => ({
  SecuritiesLinkDialog: () => null,
}));
vi.mock("@/features/subscription/model/useSubscription", () => ({
  useMyFeatures: () => ({ data: { features: state.features } }),
  useMySubscription: () => ({ data: undefined }),
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

const render = (mobile: boolean) =>
  act(() =>
    root.render(
      <AccountSection
        mobile={mobile}
        onOpenHideAmounts={() => {}}
        onOpenDevices={() => {}}
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
