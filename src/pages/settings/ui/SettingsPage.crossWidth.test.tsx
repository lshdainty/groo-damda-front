// 폭이 768 · 1280 을 넘나들어도 설정 본문이 다시 붙지 않는다 — "폼은 갈림 밖"(I-wrap-b1 ε 9).
//
// 종전엔 본문을 틀(폰 하위 화면 · 태블릿 · 두 칸) 안에서 그려, 틀이 바뀌면 본문이 내려갔다 다시 붙으며
// 열린 시트(증권사 연동 등)와 쓰던 값이 사라졌다(390 → 844 실행 확인). 지금은 본문을 틀 밖 포털에 한 번 그린다.
import { act, createContext, useContext, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router-dom";
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

const st = vi.hoisted(() => ({
  device: "mobile" as "mobile" | "tablet" | "desktop",
  mounts: 0,
  unmounts: 0,
}));
vi.mock("@/shared/lib/groo/responsive", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/lib/groo/responsive")>()),
  useDeviceSize: () => st.device,
}));
const stub = (name: string) => (props: { addRequest?: number }) => (
  <div data-stub={name} data-add={props.addRequest ?? 0} />
);
/** 계정 구역 — 제 안에 쓰던 값(시트 안 칸과 같은 자리)을 든다. 다시 붙으면 값이 비고 mounts 가 는다 */
function AccountStub({ mobile }: { mobile: boolean }) {
  const [value, setValue] = useState("");
  useEffect(() => {
    st.mounts += 1;
    return () => {
      st.unmounts += 1;
    };
  }, []);
  return (
    <div data-stub="account" data-mobile={String(mobile)}>
      <input
        data-key
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </div>
  );
}
vi.mock("@/shared/ds/snackbar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/ds/snackbar")>()),
  useSnackbar: () => ({ show: () => {}, dismiss: () => {} }),
}));
// 카테고리 구역은 위젯 머리(ManagerHead)를 그린다 — 넓은 화면에서는 틀의 제목 줄 자리로 가야 한다
vi.mock("@/widgets/category-manage", async () => {
  const { ManagerHead } = await import("@/shared/ui/groo/manager-layout");
  return {
    CategoryManager: () => (
      <div data-stub="categories">
        <ManagerHead title="카테고리 머리" />
      </div>
    ),
  };
});
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
  AccountSection: AccountStub,
  AppearanceSection: stub("appearance"),
  DevicesSection: stub("devices"),
  HideAmountsSection: stub("hide-amounts"),
  SubscriptionSection: stub("subscription"),
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

// 셸이 폭 칸을 알려 준다 — 칸이 바뀌면 셸이 다시 그려 페이지도 다시 그린다(실제로는 폭 훅이 깨운다)
const DeviceCtx = createContext<typeof st.device>("mobile");
function Shell() {
  const mobile = useContext(DeviceCtx) === "mobile";
  return <Outlet context={{ onAddTx: () => {}, mobile }} />;
}

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  Object.assign(st, { device: "mobile", mounts: 0, unmounts: 0 });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const router = () =>
  createMemoryRouter(
    [
      {
        element: <Shell />,
        children: [{ path: "/desk/settings", element: <SettingsPage /> }],
      },
    ],
    { initialEntries: ["/desk/settings?section=account"] },
  );
const client = new QueryClient();
function draw(r: ReturnType<typeof router>, device: typeof st.device) {
  st.device = device;
  act(() =>
    root.render(
      <QueryClientProvider client={client}>
        <TopNavigationProvider product="그루 담다">
          <DeviceCtx.Provider value={device}>
            <RouterProvider router={r} />
          </DeviceCtx.Provider>
        </TopNavigationProvider>
      </QueryClientProvider>,
    ),
  );
}
const keyInput = () => container.querySelector<HTMLInputElement>("[data-key]");
function type(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;
  act(() => {
    setter?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("폭이 바뀌어도 설정 본문이 다시 붙지 않는다 (I-wrap-b1 ε 9)", () => {
  it("폰 → 태블릿 → 두 칸 → 폰 — 쓰던 값이 남고 본문은 한 번만 붙는다", () => {
    const r = router();
    draw(r, "mobile");
    type(keyInput()!, "my-app-key-123");

    draw(r, "tablet");
    expect(
      container.querySelector("[data-slot=settings-tablet]"),
    ).not.toBeNull();
    expect(keyInput()?.value).toBe("my-app-key-123");
    draw(r, "desktop");
    expect(
      container.querySelector("[data-slot=settings-desktop]"),
    ).not.toBeNull();
    expect(keyInput()?.value).toBe("my-app-key-123");
    draw(r, "mobile");
    expect(keyInput()?.value).toBe("my-app-key-123");

    expect(st.mounts).toBe(1);
    expect(st.unmounts).toBe(0);
    // 본문은 그때 틀 안에 있다 — 폰 = 하위 화면 흰 면, 넓은 화면 = 틀의 본문 칸
    expect(
      container
        .querySelector("[data-slot=settings-body-slot] [data-stub=account]")
        ?.getAttribute("data-mobile"),
    ).toBe("true");
  });

  it("넓은 화면에서는 위젯 머리가 틀의 제목 줄 자리로 간다 — 본문이 틀 밖 포털에서 그려져도", () => {
    const r = createMemoryRouter(
      [
        {
          element: <Shell />,
          children: [{ path: "/desk/settings", element: <SettingsPage /> }],
        },
      ],
      { initialEntries: ["/desk/settings?section=categories"] },
    );
    draw(r, "desktop");
    const head = container.querySelector(".settings-head-slot");
    expect(head?.textContent).toContain("카테고리 머리");
    // 폰은 제목 줄 자리가 없다 — 머리는 본문 제자리
    draw(r, "mobile");
    expect(
      container.querySelector("[data-stub=categories]")?.textContent,
    ).toContain("카테고리 머리");
  });
});
