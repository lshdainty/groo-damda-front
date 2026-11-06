// 설정 > 금액 가리기를 바꾼 채 떠나기(I-wrap-b2b 단계 5 · 검수 2차 H1 · H2 · H3) — 실제 SettingsPage + 라우터 + 진짜 금액 가리기.
// onBack 을 가짜로 넣은 시험은 세 결함을 모두 놓쳤다: 저장 성공 뒤 돌아가지 않음(H1) · 뒤로 → [나가기] 가 다시 묻고 남음(H2) ·
// 폰 ← · 뒤로 → [나가기] 로 떠나지 못함(H3). 1280(두 칸) · 768(태블릿) · 390(폰) 세 폭에서 본다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const env = vi.hoisted(() => ({
  size: "desktop" as "mobile" | "tablet" | "desktop",
}));
const store = vi.hoisted(() => ({
  saved: new Set<string>(),
  set: vi.fn(async (_cards?: Set<string>) => true),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "ko" } }),
  Trans: ({ children }: { children?: unknown }) => children ?? null,
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/shared/lib/groo/responsive", () => ({
  useDeviceSize: () => env.size,
}));
// 앞 화면이 있다 — 폰 ← 는 navigate(-1)(메모리 라우터의 앞 칸)
vi.mock("@/shared/ds/top-navigation/top-navigation-context", async (orig) => ({
  ...(await orig<
    typeof import("@/shared/ds/top-navigation/top-navigation-context")
  >()),
  hasPreviousEntry: () => true,
}));
vi.mock("@/shared/lib/groo/hide-amounts-core", async (orig) => ({
  ...(await orig<typeof import("@/shared/lib/groo/hide-amounts-core")>()),
  useHiddenCards: () => store.saved,
  setHiddenCards: async (cards: Set<string>) => {
    const ok = await store.set(cards);
    if (ok) store.saved = new Set(cards);
    return ok;
  },
}));
const stub = (name: string) => () => <div data-stub={name} />;
vi.mock("@/shared/ds/snackbar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/ds/snackbar")>()),
  useSnackbar: () => ({ show: () => {}, dismiss: () => {} }),
}));
vi.mock("@/widgets/category-manage", () => ({
  CategoryManager: stub("categories"),
}));
vi.mock("@/widgets/budget-manage", () => ({ BudgetManager: stub("budget") }));
vi.mock("@/widgets/preset-manage", () => ({ PresetManager: stub("presets") }));
vi.mock("@/widgets/recurring-manage", () => ({
  RecurringManager: stub("recurring"),
}));
vi.mock("@/widgets/calendar-manage", () => ({
  CalendarLabelsSection: stub("calendar-labels"),
  CalendarShareSection: stub("calendar-share"),
  TodoTagManager: stub("todo-tags"),
}));
vi.mock("@/widgets/memo-manage", () => ({ MemoTagManager: stub("memo-tags") }));
vi.mock("@/widgets/notification-manage", () => ({
  NotificationsManager: stub("notifications"),
}));
vi.mock("@/widgets/data-transfer", () => ({ DataExportSection: stub("data") }));
vi.mock("@/widgets/account-settings", async (orig) => ({
  ...(await orig<typeof import("@/widgets/account-settings")>()),
  AccountSection: stub("account"),
  AppearanceSection: stub("appearance"),
  DevicesSection: stub("devices"),
  SubscriptionSection: stub("subscription"),
}));
vi.mock("@/widgets/account-settings/ui/HideAmountsUnlockSurface", () => ({
  HideAmountsUnlockSurface: () => null,
}));
vi.mock("@/widgets/asset-full", () => ({
  AccountManager: stub("accounts"),
  SavingGoalManager: stub("goals"),
}));
vi.mock("@/features/user", () => ({
  useCurrentUser: () => ({ data: undefined }),
  WithdrawDialog: () => null,
  useVerifyPasswordMutation: () => ({ mutate: () => {}, isPending: false }),
}));
vi.mock("@/features/auth", () => ({ useAuth: () => ({ logout: () => {} }) }));
vi.mock("@/features/subscription/ui/SecuritiesLinkDialog", () => ({
  SecuritiesLinkDialog: () => null,
}));
vi.mock("@/features/subscription/model/useSubscription", () => ({
  useMyFeatures: () => ({ data: undefined }),
  useMySubscription: () => ({ data: undefined }),
}));
vi.mock("@/features/oauth-link", () => ({
  oauthLinkApi: {},
  useOAuthProviders: () => ({ data: undefined }),
  useUnlinkOAuth: () => ({ mutate: () => {} }),
}));
vi.mock("@/features/expense", () => ({ useExpenseTemplates: () => ({}) }));
vi.mock("@/features/recurring-transaction", () => ({
  useRecurringTransactions: () => ({}),
}));

const { SettingsPage } = await import("./SettingsPage");
const { TopNavigationProvider } = await import("@/shared/ds/top-navigation");
const { LeaveGuardProvider } = await import("@/shared/ui/groo/leave-guard");

const WIDTH = { desktop: 1280, tablet: 768, mobile: 390 } as const;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.matchMedia = ((query: string) => ({
    matches: env.size === "desktop" && query.includes("1280px"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  store.saved = new Set();
  store.set.mockReset();
  store.set.mockImplementation(async () => true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  window.history.replaceState(null, "", "/");
});
afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  document.body.removeAttribute("style");
  await settle();
});

/** 히스토리 되돌림(jsdom 의 history.go 는 작업 큐로 popstate 를 쏜다)과 이어진 이동이 끝날 때까지 */
async function settle() {
  for (let i = 0; i < 6; i++)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
}

function mount() {
  const mobile = env.size === "mobile";
  const router = createMemoryRouter(
    [
      {
        element: <Outlet context={{ onAddTx: () => {}, mobile }} />,
        children: [{ path: "/desk/settings", element: <SettingsPage /> }],
      },
    ],
    {
      initialEntries: [
        "/desk/settings?section=account",
        "/desk/settings?section=hide-amounts",
      ],
      initialIndex: 1,
    },
  );
  act(() =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <TopNavigationProvider product="그루 담다">
          <LeaveGuardProvider>
            <RouterProvider router={router} />
          </LeaveGuardProvider>
        </TopNavigationProvider>
      </QueryClientProvider>,
    ),
  );
  return router;
}
const where = (r: ReturnType<typeof mount>) => r.state.location.search;
const asked = () =>
  document.body.textContent?.includes("hideAmounts.discardTitle") ?? false;
const docBtn = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent?.trim() === text,
  );
const touch = () =>
  act(() => document.querySelector<HTMLElement>('[role="checkbox"]')!.click());
// 진짜 뒤로 가기 — 칸을 실제로 꺼낸다(jsdom 은 작업 큐로 popstate 를 쏜다). 가짜 PopStateEvent 는 칸을 꺼내지 않아
// "남은 칸" 을 거짓으로 만든다
const browserBack = () =>
  act(() => {
    window.history.back();
  });
const leftover = () => window.history.state?.grooOverlayBack === true;

for (const size of ["desktop", "tablet", "mobile"] as const) {
  describe(`${WIDTH[size]} — 금액 가리기를 바꾼 채 떠나기`, () => {
    beforeEach(() => {
      env.size = size;
    });

    it("저장에 성공하면 계정 구역으로 돌아간다 — 바뀐 값의 뒤로 칸이 남지 않는다(H1)", async () => {
      const r = mount();
      touch();
      await settle();
      act(() => docBtn("save")!.click());
      await settle();
      expect(store.set).toHaveBeenCalledTimes(1);
      expect(where(r)).toBe("?section=account");
      expect(asked()).toBe(false);
      expect(leftover()).toBe(false);
    });

    it("뒤로 가기 → [나가기] 면 계정 구역으로 간다 — 다시 묻지 않는다(H2 · H3)", async () => {
      const r = mount();
      touch();
      await settle();
      browserBack();
      await settle();
      expect(asked()).toBe(true);
      act(() => docBtn("hideAmounts.discardConfirm")!.click());
      await settle();
      expect(asked()).toBe(false);
      expect(where(r)).toBe("?section=account");
      expect(leftover()).toBe(false);
    });

    it("뒤로 가기 → [계속 작성] 이면 그대로 — 고른 값이 남고 다음 뒤로 가기도 묻는다", async () => {
      const r = mount();
      touch();
      await settle();
      browserBack();
      await settle();
      act(() => docBtn("cancel")!.click());
      await settle();
      expect(where(r)).toBe("?section=hide-amounts");
      expect(
        document
          .querySelector('[role="checkbox"]')!
          .getAttribute("aria-checked"),
      ).toBe("true");
      browserBack();
      await settle();
      expect(asked()).toBe(true);
    });

    if (size === "mobile")
      it("폰 ← → [나가기] 면 앞 화면으로 간다 — 그 뒤 뒤로 칸이 헛돌지 않는다(H3)", async () => {
        const r = mount();
        touch();
        await settle();
        act(() =>
          document
            .querySelector<HTMLElement>(
              '[data-slot="hide-amounts-page"] [data-slot="top-navigation-back"], [data-slot="hide-amounts-page"] a, [data-slot="hide-amounts-page"] button',
            )!
            .click(),
        );
        await settle();
        expect(asked()).toBe(true);
        act(() => docBtn("hideAmounts.discardConfirm")!.click());
        await settle();
        expect(where(r)).toBe("?section=account");
        expect(leftover()).toBe(false);
      });
  });
}
