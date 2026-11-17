// 로그아웃은 담다만 끝낸다(보안 점검 CLI-6, 사용자 결정) — 그루 계정 로그아웃 경유지로 보내지 않고 로그아웃한 뒤
// 화면으로 간다. 해지만 그루 계정까지 끝낸다. 다시 들어올 때 비밀번호를 받게 하는 표시의 남김 · 지움도 여기서 잠근다.
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAuthenticated,
  isAuthenticated,
  setAuthenticated,
} from "@/shared/api";
import { takeLoginRedirect } from "@/shared/lib/groo/login-redirect";
import {
  clearSignedOut,
  hasSignedOut,
  markSignedOut,
} from "../lib/signed-out-mark";
import { captureLocationHref } from "../lib/test-utils";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const api = vi.hoisted(() => ({
  logout: vi.fn<() => Promise<void>>(),
  exchangeCode: vi.fn<() => Promise<unknown>>(),
}));
vi.mock("../api/authApi", () => ({ authApi: api }));
vi.mock("@/shared/config", async (orig) => ({
  ...(await orig<typeof import("@/shared/config")>()),
  config: { ssoUrl: "https://account.example" },
}));

const { useAuth } = await import("./useAuth");

// 훅이 돌려준 것을 효과에서 꺼내 둔다 — 그리는 중에 바깥 변수에 쓰지 않는다
const holder: { auth: ReturnType<typeof useAuth> | null } = { auth: null };
function Harness() {
  const value = useAuth();
  useEffect(() => {
    holder.auth = value;
  });
  return null;
}
const auth = {
  logout: (...args: Parameters<ReturnType<typeof useAuth>["logout"]>) =>
    holder.auth!.logout(...args),
  exchangeCode: (
    ...args: Parameters<ReturnType<typeof useAuth>["exchangeCode"]>
  ) => holder.auth!.exchangeCode(...args),
};

let container: HTMLDivElement;
let root: Root;
let location: ReturnType<typeof captureLocationHref>;

const go = (path: string) => window.history.replaceState({}, "", path);
const SSO_LOGOUT = "https://account.example/logout?redirect_uri=";
const backTo = (path: string) =>
  `${SSO_LOGOUT}${encodeURIComponent(`${window.location.origin}${path}`)}`;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  api.logout.mockReset();
  api.logout.mockResolvedValue();
  api.exchangeCode.mockReset();
  sessionStorage.clear();
  clearSignedOut();
  setAuthenticated();
  go("/desk/memo?tag=3");
  location = captureLocationHref();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Harness />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  location.restore();
  clearSignedOut();
  clearAuthenticated();
  go("/");
});

describe("로그아웃 — 담다만(기본)", () => {
  it("백엔드 로그아웃 → 로그인 표식 정리 → /login?out=1 로 간다. 그루 계정 로그아웃 경유지로 보내지 않는다", async () => {
    await act(() => auth.logout());
    expect(api.logout).toHaveBeenCalledTimes(1);
    expect(isAuthenticated()).toBe(false);
    expect(location.sets).toEqual(["/login?out=1"]);
    expect(location.sets.join()).not.toContain("/logout");
  });

  it("보던 자리를 적어 둔다 — 다시 들어오면 그 화면으로 간다", async () => {
    await act(() => auth.logout());
    expect(takeLoginRedirect()).toBe("/desk/memo?tag=3");
  });

  it("직접 로그아웃했다는 표시를 남긴다 — 요청을 기다리기 전에", async () => {
    let finish!: () => void;
    api.logout.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    let pending!: Promise<void>;
    act(() => {
      pending = auth.logout();
    });
    // 아직 응답 전 — 표시는 이미 있고 이동은 아직이다
    expect(hasSignedOut()).toBe(true);
    expect(location.sets).toEqual([]);
    finish();
    await act(() => pending);
    expect(location.sets).toEqual(["/login?out=1"]);
  });

  it("로그아웃 요청이 실패해도 이 브라우저는 로그아웃한 뒤 화면으로 간다", async () => {
    api.logout.mockRejectedValue(new Error("Network Error"));
    await act(() => auth.logout());
    expect(isAuthenticated()).toBe(false);
    expect(hasSignedOut()).toBe(true);
    expect(location.sets).toEqual(["/login?out=1"]);
  });

  it("scope 를 service 로 적어도 같다", async () => {
    await act(() => auth.logout({ scope: "service" }));
    expect(location.sets).toEqual(["/login?out=1"]);
  });
});

describe("로그아웃 — 그루 계정까지(해지)", () => {
  it("그루 계정 로그아웃 경유지를 거쳐 returnTo 로 돌아온다. 보던 자리는 적지 않는다", async () => {
    await act(() =>
      auth.logout({
        scope: "grooAccount",
        returnTo: "/withdrawn",
        remember: false,
      }),
    );
    expect(api.logout).toHaveBeenCalledTimes(1);
    expect(isAuthenticated()).toBe(false);
    expect(location.sets).toEqual([backTo("/withdrawn")]);
    expect(takeLoginRedirect()).toBeNull();
  });

  it("returnTo 를 주지 않으면 /login?out=all 로 돌아온다", async () => {
    await act(() => auth.logout({ scope: "grooAccount" }));
    expect(location.sets).toEqual([backTo("/login?out=all")]);
  });
});

describe("인가 코드 교환과 표시", () => {
  const params = { code: "c", codeVerifier: "v", redirectUri: "r" };

  it("교환이 성공하면 표시를 지운다 — 다음 로그인은 평소대로 돈다", async () => {
    markSignedOut();
    api.exchangeCode.mockResolvedValue({ userId: "u" });
    let result!: Awaited<ReturnType<typeof auth.exchangeCode>>;
    await act(async () => {
      result = await auth.exchangeCode(params);
    });
    expect(result.ok).toBe(true);
    expect(isAuthenticated()).toBe(true);
    expect(hasSignedOut()).toBe(false);
  });

  it("AUTH_030 으로 거절되면 reloginRequired 로 알리고 표시는 건드리지 않는다", async () => {
    markSignedOut();
    api.exchangeCode.mockRejectedValue({
      response: { status: 401, data: { code: "AUTH_030" } },
    });
    let result!: Awaited<ReturnType<typeof auth.exchangeCode>>;
    await act(async () => {
      result = await auth.exchangeCode(params);
    });
    expect(result).toEqual({
      ok: false,
      withdrawn: false,
      reloginRequired: true,
    });
    expect(hasSignedOut()).toBe(true);
  });

  it("해지한 계정(USER_021) · 보통의 실패는 reloginRequired 가 아니다", async () => {
    api.exchangeCode.mockRejectedValue({
      response: { data: { code: "USER_021" } },
    });
    let result!: Awaited<ReturnType<typeof auth.exchangeCode>>;
    await act(async () => {
      result = await auth.exchangeCode(params);
    });
    expect(result).toEqual({
      ok: false,
      withdrawn: true,
      reloginRequired: false,
    });
    api.exchangeCode.mockRejectedValue({
      response: { status: 401, data: { code: "AUTH_004" } },
    });
    await act(async () => {
      result = await auth.exchangeCode(params);
    });
    expect(result).toEqual({
      ok: false,
      withdrawn: false,
      reloginRequired: false,
    });
  });
});
