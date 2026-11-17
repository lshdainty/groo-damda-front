// 그루 계정으로 가는 최상위 이동 — 로그인 주소에 `prompt=login` 이 언제 붙는지와 로그아웃 경유지 주소(보안 점검 CLI-6).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getCodeVerifier, getSavedState, wasPromptLogin } from "./pkce";
import { clearSignedOut, hasSignedOut, markSignedOut } from "./signed-out-mark";
import { ssoLogoutUrl, startSsoLogin } from "./sso-redirect";
import { captureLocationHref } from "./test-utils";

let location: ReturnType<typeof captureLocationHref>;

beforeEach(() => {
  sessionStorage.clear();
  clearSignedOut();
  location = captureLocationHref();
});

afterEach(() => {
  location.restore();
  clearSignedOut();
});

/** 이동하려던 로그인 주소의 쿼리 */
const loginQuery = () => {
  const url = location.last()!;
  expect(url).toMatch(/\/login\?/);
  return new URLSearchParams(url.slice(url.indexOf("?") + 1));
};

describe("직접 로그아웃했다 표시", () => {
  it("남기면 있고, 지우면 없다 — localStorage 의 signed_out_by_user", () => {
    expect(hasSignedOut()).toBe(false);
    markSignedOut();
    expect(hasSignedOut()).toBe(true);
    expect(localStorage.getItem("signed_out_by_user")).toBe("1");
    clearSignedOut();
    expect(hasSignedOut()).toBe(false);
    expect(localStorage.getItem("signed_out_by_user")).toBeNull();
  });
});

describe("그루 계정 로그인으로 보내기", () => {
  it("표시가 없으면 prompt 를 붙이지 않는다 — 세션 만료 뒤의 무음 재인증이 그대로 돈다", async () => {
    await startSsoLogin();
    const q = loginQuery();
    expect(q.has("prompt")).toBe(false);
    expect(wasPromptLogin()).toBe(false);
    // PKCE 는 그대로 — S256 challenge · state 가 주소에, verifier · state 가 보관에
    expect(q.get("client_id")).toBe("desk");
    expect(q.get("code_challenge_method")).toBe("S256");
    expect(q.get("code_challenge")).toBeTruthy();
    expect(q.get("redirect_uri")).toBe(
      `${window.location.origin}/auth/callback`,
    );
    expect(q.get("state")).toBe(getSavedState());
    expect(getCodeVerifier()).toBeTruthy();
  });

  it("직접 로그아웃한 표시가 있으면 prompt=login 을 붙이고, 그렇게 보냈다고 적어 둔다", async () => {
    markSignedOut();
    await startSsoLogin();
    expect(loginQuery().get("prompt")).toBe("login");
    expect(wasPromptLogin()).toBe(true);
  });

  it("promptLogin 을 넘기면 표시가 없어도 붙인다 — AUTH_030 뒤의 재시도", async () => {
    await startSsoLogin({ promptLogin: true });
    expect(loginQuery().get("prompt")).toBe("login");
    expect(wasPromptLogin()).toBe(true);
  });

  it("지난 시도의 '그렇게 보냈다' 가 다음 시도로 넘어가지 않는다", async () => {
    await startSsoLogin({ promptLogin: true });
    await startSsoLogin();
    expect(loginQuery().has("prompt")).toBe(false);
    expect(wasPromptLogin()).toBe(false);
  });

  it("시도마다 PKCE 값이 새로 만들어진다", async () => {
    await startSsoLogin();
    const first = { verifier: getCodeVerifier(), state: getSavedState() };
    await startSsoLogin();
    expect(getCodeVerifier()).not.toBe(first.verifier);
    expect(getSavedState()).not.toBe(first.state);
  });
});

describe("그루 계정 로그아웃 경유지", () => {
  it("돌아올 자리를 이 출처의 주소로 만들어 redirect_uri 에 인코딩해 싣는다", () => {
    const url = ssoLogoutUrl("/login?out=all");
    expect(url).toMatch(/\/logout\?redirect_uri=/);
    expect(url.slice(url.indexOf("redirect_uri=") + 13)).toBe(
      encodeURIComponent(`${window.location.origin}/login?out=all`),
    );
  });
});
