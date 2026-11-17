// 로그인 콜백의 교환 거절 처리(보안 점검 CLI-6) — 담다에서 로그아웃한 그 그루 계정 로그인으로 돌아오면 백엔드가
// 교환을 401 · AUTH_030 으로 거절한다. 표시를 남기고 비밀번호를 다시 받는 로그인(prompt=login)을 한 번 새로 시작하고,
// 그렇게 보낸 시도가 또 거절되면 맴돌지 않고 실패 화면에 머문다.
// 그 밖의 거절(담다를 쓸 수 없는 그루 계정 AUTH_003 등)은 저절로 다시 가지 않고 실패 화면 + 표시를 남겨,
// [다시 로그인하기] · 로그인 화면의 단추가 prompt=login 으로 비밀번호(계정 고르기)를 띄운다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { savePkce } from "@/features/auth/lib/pkce";
import {
  clearSignedOut,
  hasSignedOut,
} from "@/features/auth/lib/signed-out-mark";
import { startSsoLogin } from "@/features/auth/lib/sso-redirect";
import { captureLocationHref } from "@/features/auth/lib/test-utils";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const navigate = vi.hoisted(() => vi.fn());
const exchangeCode = vi.hoisted(() => vi.fn());
vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useNavigate: () => navigate,
}));
vi.mock("@/features/auth", () => ({
  useAuth: () => ({ exchangeCode }),
}));
vi.mock("@/shared/config", async (orig) => ({
  ...(await orig<typeof import("@/shared/config")>()),
  config: { ssoUrl: "https://account.example" },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const { AuthCallbackPage } = await import("./AuthCallbackPage");

const REJECTED = { ok: false, withdrawn: false, reloginRequired: true };

let container: HTMLDivElement;
let root: Root;
let location: ReturnType<typeof captureLocationHref>;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  navigate.mockReset();
  exchangeCode.mockReset();
  sessionStorage.clear();
  clearSignedOut();
  location = captureLocationHref();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  location.restore();
  clearSignedOut();
  window.history.replaceState({}, "", "/");
});

/** 콜백 주소로 돌아온다 — 화면을 새로 올린다(시도마다 한 번만 교환하는 가드가 화면에 붙어 있다) */
const arrive = async (search: string) => {
  act(() => root.unmount());
  root = createRoot(container);
  window.history.replaceState({}, "", `/auth/callback${search}`);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={["/auth/callback"]}>
        <AuthCallbackPage />
      </MemoryRouter>,
    );
  });
};
/** 그루 계정 로그인으로 다시 떠나려던 주소의 쿼리 — 주소를 만드는 데 해시 계산이 끼어 기다린다 */
const reloginQuery = async (count = 1) => {
  await vi.waitFor(() => expect(location.sets).toHaveLength(count));
  const url = location.last()!;
  expect(url.startsWith("https://account.example/login?")).toBe(true);
  return new URLSearchParams(url.slice(url.indexOf("?") + 1));
};
const settle = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
/** 실패 화면(Result Section)이 떠 있나 */
const failureScreen = () =>
  container.querySelector("[data-slot=auth-callback-failed]");
const retryButton = () =>
  Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent === "callback.retry",
  );

describe("교환이 AUTH_030 으로 거절되면", () => {
  it("표시를 남기고 prompt=login 으로 그루 계정 로그인을 다시 시작한다 — 새 PKCE 로", async () => {
    savePkce("verifier-1", "state-1");
    exchangeCode.mockResolvedValue(REJECTED);
    await arrive("?code=c1&state=state-1");
    const q = await reloginQuery();
    expect(q.get("prompt")).toBe("login");
    expect(hasSignedOut()).toBe(true);
    // 새 시도 — 옛 verifier · state 를 물려받지 않는다
    expect(q.get("state")).not.toBe("state-1");
    expect(q.get("state")).toBe(sessionStorage.getItem("pkce_state"));
    expect(sessionStorage.getItem("pkce_code_verifier")).not.toBe("verifier-1");
    expect(q.get("code_challenge_method")).toBe("S256");
    expect(q.get("redirect_uri")).toBe(
      `${window.location.origin}/auth/callback`,
    );
    // 로그인 화면으로 되돌리지 않는다 — 기다리는 화면 그대로 떠난다
    expect(navigate).not.toHaveBeenCalled();
    expect(container.firstElementChild?.getAttribute("aria-busy")).toBe("true");
    // 주소의 일회용 code 는 걷는다
    expect(window.location.search).toBe("");
  });

  it("보던 자리는 남겨 둔다 — 비밀번호를 넣고 돌아오면 그 화면으로 간다", async () => {
    sessionStorage.setItem("post_login_redirect", "/desk/memo?tag=3");
    savePkce("verifier-1", "state-1");
    exchangeCode.mockResolvedValue(REJECTED);
    await arrive("?code=c1&state=state-1");
    await reloginQuery();
    expect(sessionStorage.getItem("post_login_redirect")).toBe(
      "/desk/memo?tag=3",
    );
  });

  it("이미 prompt=login 으로 보낸 시도가 또 거절되면 다시 보내지 않고 실패 화면에 머문다", async () => {
    savePkce("verifier-2", "state-2", true);
    exchangeCode.mockResolvedValue(REJECTED);
    await arrive("?code=c2&state=state-2");
    await settle();
    expect(location.sets).toEqual([]);
    expect(navigate).not.toHaveBeenCalled();
    expect(failureScreen()).not.toBeNull();
    expect(sessionStorage.getItem("pkce_code_verifier")).toBeNull();
    expect(sessionStorage.getItem("pkce_prompt_login")).toBeNull();
  });

  it("재시도는 한 번뿐이다 — 거절 → 다시 로그인 → 또 거절이면 거기서 멈춘다", async () => {
    exchangeCode.mockResolvedValue(REJECTED);
    savePkce("verifier-1", "state-1");
    await arrive("?code=c1&state=state-1");
    const q = await reloginQuery();
    expect(navigate).not.toHaveBeenCalled();
    // 그루 계정이 비밀번호를 받고 새 code 로 돌려보냈는데 백엔드가 또 거절한다
    await arrive(`?code=c2&state=${q.get("state")}`);
    await settle();
    expect(exchangeCode).toHaveBeenCalledTimes(2);
    expect(location.sets).toHaveLength(1);
    expect(navigate).not.toHaveBeenCalled();
    expect(failureScreen()).not.toBeNull();
  });
});

describe("AUTH_030 이 아닌 결과는 그대로다", () => {
  it("다시 로그인한 뒤 교환이 성공하면 보던 자리(없으면 홈)로 간다", async () => {
    sessionStorage.setItem("post_login_redirect", "/desk/memo?tag=3");
    savePkce("verifier-2", "state-2", true);
    exchangeCode.mockResolvedValue({ ok: true });
    await arrive("?code=c2&state=state-2");
    expect(navigate).toHaveBeenCalledWith("/desk/memo?tag=3", {
      replace: true,
    });
    expect(location.sets).toEqual([]);
  });

  it("해지한 계정은 안내 화면으로 간다", async () => {
    savePkce("verifier-1", "state-1");
    exchangeCode.mockResolvedValue({
      ok: false,
      withdrawn: true,
      reloginRequired: false,
    });
    await arrive("?code=c1&state=state-1");
    expect(navigate).toHaveBeenCalledWith("/withdrawn", { replace: true });
    expect(location.sets).toEqual([]);
  });
});

// 담다를 쓸 수 없는 그루 계정(서버 403 AUTH_003 — 그루 계정의 서비스 목록에 desk 가 없다) 등으로 교환이 거절됐다.
// 그루 계정 로그인이 살아 있어 prompt 없이 다시 가면 그루 계정이 같은 계정으로 바로 code 를 내줘 같은 거절로 돌아온다.
describe("담다를 쓸 수 없는 계정 등으로 교환이 거절되면", () => {
  const DENIED = { ok: false, withdrawn: false, reloginRequired: false };

  it("저절로 떠나지 않고 실패 화면에 머문다 — 표시를 남긴다", async () => {
    savePkce("verifier-1", "state-1");
    exchangeCode.mockResolvedValue(DENIED);
    await arrive("?code=c1&state=state-1");
    await settle();
    expect(location.sets).toEqual([]);
    expect(navigate).not.toHaveBeenCalled();
    expect(hasSignedOut()).toBe(true);
    const screen = failureScreen()!;
    expect(screen).not.toBeNull();
    const result = screen.querySelector("[data-slot=result-section]")!;
    expect(result.getAttribute("data-kind")).toBe("failure");
    expect(result.getAttribute("data-size")).toBe("large");
    const h1s = screen.querySelectorAll("h1");
    expect(h1s).toHaveLength(1);
    expect(h1s[0]?.textContent).toBe("callback.failedTitle");
    expect(
      screen.querySelector("[data-slot=result-section-description]")
        ?.textContent,
    ).toBe("callback.exchangeFailed");
    // 버튼은 하나 — Bottom CTA large neutralSolid
    const buttons = screen.querySelectorAll("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.className).toContain("bg-bg-neutral-inverted");
    // 주소의 일회용 code 는 걷는다
    expect(window.location.search).toBe("");
    expect(sessionStorage.getItem("pkce_code_verifier")).toBeNull();
  });

  it("[다시 로그인하기] 는 prompt=login 으로 그루 계정 로그인을 바로 시작한다 — 새 PKCE · 보던 자리 유지", async () => {
    sessionStorage.setItem("post_login_redirect", "/desk/memo?tag=3");
    savePkce("verifier-1", "state-1");
    exchangeCode.mockResolvedValue(DENIED);
    await arrive("?code=c1&state=state-1");
    await settle();
    await act(async () => {
      retryButton()!.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });
    const q = await reloginQuery();
    expect(q.get("prompt")).toBe("login");
    expect(q.get("state")).not.toBe("state-1");
    expect(q.get("state")).toBe(sessionStorage.getItem("pkce_state"));
    expect(sessionStorage.getItem("pkce_prompt_login")).toBe("1");
    expect(navigate).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("post_login_redirect")).toBe(
      "/desk/memo?tag=3",
    );
  });

  it("거절된 뒤 로그인 화면의 단추(표시만 읽는 시작)도 prompt=login 이다", async () => {
    savePkce("verifier-1", "state-1");
    exchangeCode.mockResolvedValue(DENIED);
    await arrive("?code=c1&state=state-1");
    await settle();
    await startSsoLogin();
    const q = await reloginQuery();
    expect(q.get("prompt")).toBe("login");
  });

  it("표시가 없는 평소 로그인에는 prompt 를 붙이지 않는다", async () => {
    await startSsoLogin();
    const q = await reloginQuery();
    expect(q.has("prompt")).toBe(false);
  });

  it("prompt=login 으로 다른 계정을 골라도 또 거절되면 실패 화면에 머문다 — 맴돌지 않는다", async () => {
    savePkce("verifier-1", "state-1");
    exchangeCode.mockResolvedValue(DENIED);
    await arrive("?code=c1&state=state-1");
    await settle();
    await act(async () => {
      retryButton()!.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });
    const q = await reloginQuery();
    // 비밀번호를 넣고 돌아왔는데 그 계정도 담다를 쓸 수 없다
    await arrive(`?code=c2&state=${q.get("state")}`);
    await settle();
    expect(exchangeCode).toHaveBeenCalledTimes(2);
    expect(location.sets).toHaveLength(1);
    expect(navigate).not.toHaveBeenCalled();
    expect(failureScreen()).not.toBeNull();
  });

  it("다시 로그인한 뒤 교환이 성공하면 보던 자리로 간다", async () => {
    sessionStorage.setItem("post_login_redirect", "/desk/memo?tag=3");
    savePkce("verifier-1", "state-1");
    exchangeCode.mockResolvedValueOnce(DENIED).mockResolvedValueOnce({
      ok: true,
    });
    await arrive("?code=c1&state=state-1");
    await settle();
    await act(async () => {
      retryButton()!.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });
    const q = await reloginQuery();
    await arrive(`?code=c2&state=${q.get("state")}`);
    expect(navigate).toHaveBeenCalledWith("/desk/memo?tag=3", {
      replace: true,
    });
  });
});
