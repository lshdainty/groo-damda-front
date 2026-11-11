// 해지의 본인 확인은 티켓을 **해지용(purpose=withdraw)** 으로 받는다.
//
// 본인 확인 칸 · 확인을 소셜 연동(purpose=oauth-link)과 함께 쓰게 되면서(보안 점검 S-2) 쓰임새를 부르는 쪽이
// 명시하게 됐다. 해지가 연동용 티켓을 받으면 해지 호출에서 서버가 막는다 — 맞는 비밀번호를 넣고도 해지가 안 된다.
// WithdrawDialog.test 는 훅을 통째로 바꿔 끼워 이 값을 못 본다. 여기서는 요청 층(apiClient)만 바꿔 끼우고
// 훅 · API 함수는 실물을 돌려 본문을 잰다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

type Call = { method: string; url: string; body: unknown; config: unknown };
const net = vi.hoisted(() => ({ calls: [] as Call[] }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/shared/api", async (orig) => ({
  ...(await orig<typeof import("@/shared/api")>()),
  apiClient: {
    get: async (url: string) => {
      net.calls.push({
        method: "get",
        url,
        body: undefined,
        config: undefined,
      });
      return {
        success: true,
        data: {
          blocked: [],
          subscriptionPeriodEnd: null,
          sharedCalendarsOwned: 0,
          calendarMemberships: 0,
          dutchPaysOwned: 0,
          dutchPayParticipations: 0,
        },
      };
    },
    post: async (url: string, body: unknown, config: unknown) => {
      net.calls.push({ method: "post", url, body, config });
      return { success: true, data: { reauthToken: "ticket-w" } };
    },
    delete: async (url: string, config: unknown) => {
      net.calls.push({ method: "delete", url, body: undefined, config });
      return { success: true };
    },
  },
}));

const { WithdrawDialog } = await import("./WithdrawDialog");

let container: HTMLDivElement;
let root: Root;
let withdrawn = 0;

const buttonNamed = (text: string) =>
  [...document.body.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === text,
  );
const click = (text: string) =>
  buttonNamed(text)!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
const flushClickGuard = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
function setValue(el: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )!.set!.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  net.calls = [];
  withdrawn = 0;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  const proto = window.HTMLElement.prototype as unknown as Record<
    string,
    unknown
  >;
  proto.hasPointerCapture = () => false;
  proto.setPointerCapture = () => {};
  proto.releasePointerCapture = () => {};
  proto.scrollIntoView = () => {};

  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  await act(async () =>
    root.render(
      <QueryClientProvider client={qc}>
        <WithdrawDialog
          onClose={() => {}}
          onWithdrawn={() => {
            withdrawn += 1;
          }}
        />
      </QueryClientProvider>,
    ),
  );
  // 해지 전 점검(GET)이 풀려 안내 단계가 서기까지
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("해지 본인 확인의 쓰임새", () => {
  it("비밀번호 확인 본문에 purpose=withdraw 를 싣고, 그 티켓으로 해지한다", async () => {
    act(() => click("withdraw.next"));
    await flushClickGuard();
    const pw = document.getElementById("withdraw-password") as HTMLInputElement;
    act(() => setValue(pw, "my-password"));
    await act(async () => click("withdraw.confirm"));

    const verify = net.calls.find(
      (c) => c.url === "/v1/users/me/reauth/password",
    );
    expect(verify?.body).toEqual({
      password: "my-password",
      purpose: "withdraw",
    });
    const del = net.calls.find((c) => c.method === "delete");
    expect(del?.config).toMatchObject({
      headers: { "X-Reauth-Token": "ticket-w" },
    });
    expect(withdrawn).toBe(1);
  });

  it("메일 코드 확인도 purpose=withdraw 다", async () => {
    act(() => click("withdraw.next"));
    await flushClickGuard();
    act(() => click("withdraw.useEmailCode"));
    const input = document.getElementById("withdraw-code") as HTMLInputElement;
    const e = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(e, "clipboardData", {
      value: { getData: () => "123456" },
    });
    act(() => {
      input.dispatchEvent(e);
    });
    await act(async () => click("withdraw.confirm"));

    const verify = net.calls.find(
      (c) => c.url === "/v1/users/me/reauth/email-code/verify",
    );
    expect(verify?.body).toEqual({ code: "123456", purpose: "withdraw" });
  });
});
