// 섹션 이동 = 기록(Q1-A · I-16 4 · 5 · 8) · 폰 머리 "추가" · 문서 제목 — 실제 SettingsPage 를 라우터 안에 띄워 잠근다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  createBrowserRouter,
  createMemoryRouter,
  Outlet,
  RouterProvider,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "ko" } }),
  Trans: ({ children }: { children?: unknown }) => children ?? null,
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const stub = (name: string) => (props: { addRequest?: number }) => (
  <div data-stub={name} data-add={props.addRequest ?? 0} />
);
vi.mock("sonner", () => ({ toast: { success: () => {}, error: () => {} } }));
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
vi.mock("@/widgets/account-settings", () => ({
  AccountSection: stub("account"),
  AppearanceSection: stub("appearance"),
  DevicesSection: stub("devices"),
  HideAmountsSection: stub("hide-amounts"),
}));
vi.mock("@/widgets/asset-full", () => ({
  AccountManager: stub("accounts"),
  SavingGoalManager: stub("goals"),
}));
vi.mock("@/features/user", () => ({
  useCurrentUser: () => ({ data: undefined }),
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
  useMyFeatures: () => ({ data: undefined }),
  useMySubscription: () => ({ data: undefined }),
}));
vi.mock("@/features/oauth-link", () => ({
  oauthLinkApi: {},
  useOAuthProviders: () => ({ data: undefined }),
  useUnlinkOAuth: () => ({ mutate: () => {} }),
}));
// 실제 목록 조회는 하지 않는다(머리 "추가" 의 빈 화면 조건은 SettingsSubpageMobile 몫)
vi.mock("@/features/expense", () => ({ useExpenseTemplates: () => ({}) }));
vi.mock("@/features/recurring-transaction", () => ({
  useRecurringTransactions: () => ({}),
}));

const { SettingsPage } = await import("./SettingsPage");
const { TopNavigationProvider } = await import("@/shared/ds/top-navigation");

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  window.history.replaceState({ idx: 0 }, "", "/");
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function mount(path: string, mobile: boolean) {
  const router = createMemoryRouter(
    [
      {
        element: <Outlet context={{ onAddTx: () => {}, mobile }} />,
        children: [{ path: "/desk/settings", element: <SettingsPage /> }],
      },
    ],
    { initialEntries: [path] },
  );
  act(() =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <TopNavigationProvider product="그루 담다">
          <RouterProvider router={router} />
        </TopNavigationProvider>
      </QueryClientProvider>,
    ),
  );
  return router;
}

const where = (r: ReturnType<typeof mount>) =>
  r.state.location.pathname + r.state.location.search;

const pressByText = (text: string) => {
  // 폰 메뉴 줄은 버튼, 데스크톱 목록 줄은 링크(I-16 23)
  const el = [...container.querySelectorAll("button, nav a")].find((b) =>
    b.textContent?.includes(text),
  ) as HTMLElement | undefined;
  if (!el) throw new Error(`버튼 없음: ${text}`);
  act(() => el.click());
};

describe("설정 섹션 이동 기록", () => {
  it("폰 메뉴에서 섹션을 누르면 기록을 남긴다(push) — 문서 제목도 섹션 이름", () => {
    const router = mount("/desk/settings", true);
    expect(document.title).toBe("page.title - 그루 담다");
    pressByText("sections.categories.label");
    expect(where(router)).toBe("/desk/settings?section=categories");
    expect(router.state.historyAction).toBe("PUSH");
    expect(document.title).toBe("sections.categories.label - 그루 담다");
    // 뒤로 가기는 기록대로 메뉴로
    act(() => {
      void router.navigate(-1);
    });
    expect(where(router)).toBe("/desk/settings");
    expect(document.title).toBe("page.title - 그루 담다");
  });

  it("지금 켜진 섹션을 다시 누르면 기록이 늘지 않는다(데스크톱 목록)", () => {
    const router = mount("/desk/settings?section=budget", false);
    const before = window.history.length;
    pressByText("sections.budget.label");
    expect(where(router)).toBe("/desk/settings?section=budget");
    expect(router.state.historyAction).toBe("POP");
    expect(window.history.length).toBe(before);
    // 다른 섹션은 push
    pressByText("sections.notifications.label");
    expect(where(router)).toBe("/desk/settings?section=notifications");
    expect(router.state.historyAction).toBe("PUSH");
  });

  it('폰 머리 "추가" — 카테고리 본문에 추가 요청이 올라간다', () => {
    mount("/desk/settings?section=categories", true);
    const stubEl = () => container.querySelector("[data-stub=categories]")!;
    expect(stubEl().getAttribute("data-add")).toBe("0");
    const header = container.querySelector("header")!;
    const add = [...header.querySelectorAll("button")].find(
      (b) => b.textContent === "add",
    )!;
    act(() => add.click());
    expect(stubEl().getAttribute("data-add")).toBe("1");
  });

  it("섹션 주소가 없는 폰은 메뉴, 모르는 섹션도 메뉴", () => {
    const router = mount("/desk/settings?section=nope", true);
    expect(where(router)).toBe("/desk/settings?section=nope");
    expect(container.querySelector("[data-stub]")).toBeNull();
  });

  it("OAuth 복귀 ?linked 를 지워도 기록이 늘지 않고 history.state 가 남는다(replace)", () => {
    window.history.replaceState(
      { idx: 0 },
      "",
      "/desk/settings?section=account&linked=google",
    );
    const lengthBefore = window.history.length;
    const router = createBrowserRouter([
      {
        element: <Outlet context={{ onAddTx: () => {}, mobile: true }} />,
        children: [{ path: "/desk/settings", element: <SettingsPage /> }],
      },
    ]);
    act(() =>
      root.render(
        <QueryClientProvider client={new QueryClient()}>
          <TopNavigationProvider product="그루 담다">
            <RouterProvider router={router} />
          </TopNavigationProvider>
        </QueryClientProvider>,
      ),
    );
    expect(window.location.search).toBe("?section=account");
    expect(window.history.length).toBe(lengthBefore);
    expect((window.history.state as { idx?: number } | null)?.idx).toBe(0);
    router.dispose();
  });
});
