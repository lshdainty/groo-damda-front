// 소셜 연결 전 본인 확인(보안 점검 S-2) — **본인 확인을 통과한 뒤에만 연동을 시작하는지**를 고정한다.
//
// - 확인 없이 연동 시작이 나가면 → 로그인 쿠키만 훔친 사람이 자기 구글을 붙여 계정을 가로챈다
// - 티켓을 `oauth-link` 로 안 받으면 → 서버는 해지용(withdraw)으로 보고 연동 시작에서 거절한다
// - 연동 시작이 실패했는데 같은 티켓 · 입력으로 다시 보내면 → 이미 쓴 티켓이라 또 거절당한다
//
// 요청 층(apiClient)만 바꿔 끼우고 훅 · API 함수는 실물을 돈다 — 본문의 purpose 와 헤더의 티켓을 실제로 잰다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

type Call = { url: string; body: unknown; config: unknown };
const net = vi.hoisted(() => ({
  calls: [] as Call[],
  /** 경로별 응답 — 함수가 던지면 그 요청은 실패한다 */
  reply: {} as Record<string, () => unknown>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: { name?: string }) => (o?.name ? `${k}|${o.name}` : k),
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/shared/api", async (orig) => ({
  ...(await orig<typeof import("@/shared/api")>()),
  apiClient: {
    post: async (url: string, body: unknown, config: unknown) => {
      net.calls.push({ url, body, config });
      const r = net.reply[url];
      if (!r) throw new Error(`no reply for ${url}`);
      return r();
    },
    delete: async (url: string, config: unknown) => {
      net.calls.push({ url: `DELETE ${url}`, body: undefined, config });
      const r = net.reply[`DELETE ${url}`];
      if (!r) throw new Error(`no reply for DELETE ${url}`);
      return r();
    },
  },
}));

const { LinkReauthDialog } = await import("./LinkReauthDialog");

const PW = "/v1/users/me/reauth/password";
const CODE_SEND = "/v1/users/me/reauth/email-code";
const CODE_VERIFY = "/v1/users/me/reauth/email-code/verify";
const LINK = "/v1/oauth/link/google";

const ok = (data?: unknown) => () => ({ success: true, data });
const fail = (code: string) => () => {
  throw Object.assign(new Error("Request failed with status code 400"), {
    response: { data: { code } },
  });
};

let container: HTMLDivElement;
let root: Root;
/** 연동 시작 주소로 떠나려 한 기록 — jsdom 은 실제 이동을 못 한다 */
let hrefSets: string[];

function render(
  mode: "link" | "unlink" = "link",
  onUnlinked?: () => void,
  onClose: () => void = () => {},
) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  act(() =>
    root.render(
      <QueryClientProvider client={qc}>
        <LinkReauthDialog
          provider="google"
          providerName="Google"
          mode={mode}
          onUnlinked={onUnlinked}
          onClose={onClose}
        />
      </QueryClientProvider>,
    ),
  );
}

const buttonNamed = (text: string) =>
  [...document.body.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === text,
  );
const click = (text: string) =>
  buttonNamed(text)!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
/** 같은 버튼을 연달아 누르기 전에 Button 의 더블클릭 가드가 풀리게 기다린다(WithdrawDialog.test 참고) */
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
const passwordInput = () =>
  document.getElementById("link-reauth-password") as HTMLInputElement;
const codeInput = () =>
  document.getElementById("link-reauth-code") as HTMLInputElement;
const paste = (text: string) => {
  const e = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(e, "clipboardData", {
    value: { getData: () => text },
  });
  act(() => {
    codeInput().dispatchEvent(e);
  });
};
const linkCalls = () => net.calls.filter((c) => c.url === LINK);

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  net.calls = [];
  net.reply = {
    [PW]: ok({ reauthToken: "ticket-pw" }),
    [CODE_SEND]: ok(),
    [CODE_VERIFY]: ok({ reauthToken: "ticket-code" }),
    [LINK]: ok({ startUrl: "https://sso.example/start" }),
  };
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  // jsdom 에는 matchMedia 가 없다 — 좁은 쪽(시트)
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
  // 연동 시작 주소로 떠나는 자리를 잰다 — 읽기는 실제 주소 그대로(시트의 뒤로 가기 처리가 history 를 쓴다)
  hrefSets = [];
  const loc = window.location;
  const fake = { ...loc, assign: () => {} } as unknown as Location;
  Object.defineProperty(fake, "href", {
    get: () => loc.href,
    set: (v: string) => void hrefSets.push(v),
  });
  vi.spyOn(window, "location", "get").mockReturnValue(fake);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("소셜 연결 전 본인 확인", () => {
  it("연결 이유를 머리 설명으로 말한다 — 'Google 계정을 연결하려면 본인 확인이 필요해요'", () => {
    render();
    expect(document.body.textContent).toContain(
      "account.linkReauth.intro|Google",
    );
  });

  it("열기만 해서는 연동 시작이 나가지 않는다 — 비밀번호가 비면 버튼도 눌리지 않는다", () => {
    render();
    expect(net.calls).toEqual([]);
    expect(buttonNamed("account.linkReauth.confirm")!.disabled).toBe(true);
  });

  it("비밀번호 확인(purpose=oauth-link) → 그 티켓을 X-Reauth-Token 헤더에 싣고 연동 시작 → 시작 주소로 떠난다", async () => {
    render();
    act(() => setValue(passwordInput(), "my-password"));
    await act(async () => click("account.linkReauth.confirm"));

    expect(net.calls.map((c) => c.url)).toEqual([PW, LINK]);
    expect(net.calls[0]!.body).toEqual({
      password: "my-password",
      purpose: "oauth-link",
    });
    expect(net.calls[1]!.body).toEqual({
      returnUrl: window.location.origin + window.location.pathname,
    });
    expect(net.calls[1]!.config).toMatchObject({
      headers: { "X-Reauth-Token": "ticket-pw" },
    });
    expect(hrefSets).toEqual(["https://sso.example/start"]);
  });

  it("비밀번호가 틀리면(AUTH_021) 연동 시작을 부르지 않고 칸 밑에 화면 글을 붙인다", async () => {
    net.reply[PW] = fail("AUTH_021");
    render();
    act(() => setValue(passwordInput(), "wrong"));
    await act(async () => click("account.linkReauth.confirm"));

    expect(linkCalls()).toEqual([]);
    expect(document.body.textContent).toContain("withdraw.passwordWrong");
    expect(passwordInput().getAttribute("aria-invalid")).toBe("true");
  });

  it("잠기면(AUTH_022) 잠김 글이고, 네트워크 오류는 '본인 확인 실패' 글이다 — 해지 글이 아니다", async () => {
    net.reply[PW] = fail("AUTH_022");
    render();
    act(() => setValue(passwordInput(), "pw"));
    await act(async () => click("account.linkReauth.confirm"));
    expect(document.body.textContent).toContain("withdraw.locked");

    net.reply[PW] = () => {
      throw new Error("Network Error");
    };
    await flushClickGuard();
    act(() => setValue(passwordInput(), "pw2"));
    await act(async () => click("account.linkReauth.confirm"));
    const text = document.body.textContent ?? "";
    expect(text).toContain("account.linkReauth.failed");
    expect(text).not.toContain("withdraw.failed");
    expect(text).not.toContain("Network Error");
    expect(linkCalls()).toEqual([]);
  });

  it("연동 시작이 실패하면(티켓 거절) 칸을 비우고 '본인 확인부터 다시' — 다음 확인은 새 티켓을 받는다", async () => {
    net.reply[LINK] = fail("OAUTH_LINK_FAILED");
    render();
    act(() => setValue(passwordInput(), "my-password"));
    await act(async () => click("account.linkReauth.confirm"));

    expect(document.body.textContent).toContain(
      "account.linkReauth.startFailed",
    );
    expect(passwordInput().value).toBe("");
    expect(hrefSets).toEqual([]);
    // 덮개가 걷혀 다시 할 수 있다
    expect(
      document.body.querySelector('[data-slot="busy-overlay"]'),
    ).toBeNull();

    net.reply[PW] = ok({ reauthToken: "ticket-2" });
    net.reply[LINK] = ok({ startUrl: "https://sso.example/again" });
    await flushClickGuard();
    act(() => setValue(passwordInput(), "my-password"));
    await act(async () => click("account.linkReauth.confirm"));

    // 확인부터 다시 — 같은 티켓을 들고 연동 시작만 다시 부르지 않는다
    expect(net.calls.map((c) => c.url)).toEqual([PW, LINK, PW, LINK]);
    expect(net.calls[3]!.config).toMatchObject({
      headers: { "X-Reauth-Token": "ticket-2" },
    });
    expect(hrefSets).toEqual(["https://sso.example/again"]);
  });

  it("메일 코드도 purpose=oauth-link 로 확인하고 그 티켓으로 연동을 시작한다", async () => {
    render();
    act(() => click("withdraw.useEmailCode"));
    const resend = document.body.querySelector(
      '[data-slot="input-otp-resend"]',
    )!;
    await act(async () => {
      resend.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    // 코드 발송에는 쓰임새가 없다 — 확인할 때 정한다
    expect(net.calls[0]!.url).toBe(CODE_SEND);
    expect(document.body.textContent).toContain("withdraw.codeSent");

    paste("인증 코드: 123456");
    await act(async () => click("account.linkReauth.confirm"));

    expect(net.calls.map((c) => c.url)).toEqual([CODE_SEND, CODE_VERIFY, LINK]);
    expect(net.calls[1]!.body).toEqual({
      code: "123456",
      purpose: "oauth-link",
    });
    expect(net.calls[2]!.config).toMatchObject({
      headers: { "X-Reauth-Token": "ticket-code" },
    });
  });

  it("코드가 6자리가 안 되면 서버에 보내지 않고 칸 오류로 알린다", async () => {
    render();
    act(() => click("withdraw.useEmailCode"));
    paste("123");
    await act(async () => click("account.linkReauth.confirm"));
    expect(net.calls).toEqual([]);
    expect(document.body.textContent).toContain("withdraw.codeIncomplete");
  });
});

// S-2 잔여 — 해제도 같은 본인 확인 뒤에만 나간다
describe("소셜 연결 해제 전 본인 확인", () => {
  const UNLINK = "DELETE /v1/oauth/link/google";

  it("비밀번호 확인(purpose=oauth-link) → 그 티켓을 X-Reauth-Token 헤더에 싣고 해제 → 알리고 닫는다", async () => {
    net.reply[UNLINK] = ok();
    let unlinked = 0;
    let closed = 0;
    render(
      "unlink",
      () => (unlinked += 1),
      () => (closed += 1),
    );
    expect(document.body.textContent).toContain(
      "account.unlinkReauth.intro|Google",
    );
    act(() => setValue(passwordInput(), "my-password"));
    await act(async () => click("account.unlinkReauth.confirm"));

    expect(net.calls.map((c) => c.url)).toEqual([PW, UNLINK]);
    expect(net.calls[0]!.body).toEqual({
      password: "my-password",
      purpose: "oauth-link",
    });
    expect(net.calls[1]!.config).toMatchObject({
      headers: { "X-Reauth-Token": "ticket-pw" },
    });
    expect(unlinked).toBe(1);
    expect(closed).toBe(1);
    expect(hrefSets).toEqual([]);
  });

  it("열기만 해서는 해제가 나가지 않는다", () => {
    render("unlink");
    expect(net.calls).toEqual([]);
  });

  it("해제가 실패하면 알리지 않고 본인 확인부터 다시 받는다", async () => {
    net.reply[UNLINK] = fail("DESK_OAUTH_LINK_FAILED");
    let unlinked = 0;
    render("unlink", () => (unlinked += 1));
    act(() => setValue(passwordInput(), "my-password"));
    await act(async () => click("account.unlinkReauth.confirm"));

    expect(unlinked).toBe(0);
    expect(document.body.textContent).toContain("account.unlinkReauth.failed");
  });
});
