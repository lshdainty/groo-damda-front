// 로그인 콜백의 state(CSRF) 검사 — 주소의 state 와 로그인 시작 때 저장해 둔 state 가
// 둘 다 있고 같을 때만 code 를 교환한다. 한쪽이라도 비면 거절한다(보안 점검 CLI-5).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { savePkce } from "@/features/auth/lib/pkce";

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
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const { AuthCallbackPage } = await import("./AuthCallbackPage");

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  navigate.mockReset();
  exchangeCode.mockReset();
  exchangeCode.mockResolvedValue({ ok: true });
  sessionStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.history.replaceState({}, "", "/");
});

const visit = async (search: string) => {
  window.history.replaceState({}, "", `/auth/callback${search}`);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={["/auth/callback"]}>
        <AuthCallbackPage />
      </MemoryRouter>,
    );
  });
};

const rejected = () => {
  expect(exchangeCode).not.toHaveBeenCalled();
  expect(navigate).toHaveBeenCalledWith("/login", { replace: true });
  // 거절해도 일회용 값은 지운다 — 다음 시도가 옛 verifier 를 물려받지 않게
  expect(sessionStorage.getItem("pkce_code_verifier")).toBeNull();
  expect(sessionStorage.getItem("pkce_state")).toBeNull();
};

describe("로그인 콜백 state 검사(CLI-5)", () => {
  it("저장한 state 와 주소의 state 가 같으면 code 를 교환한다", async () => {
    savePkce("verifier-1", "state-1");
    await visit("?code=c1&state=state-1");
    expect(exchangeCode).toHaveBeenCalledWith({
      code: "c1",
      codeVerifier: "verifier-1",
      redirectUri: `${window.location.origin}/auth/callback`,
    });
  });

  it("주소에 state 가 없으면 거절한다", async () => {
    savePkce("verifier-1", "state-1");
    await visit("?code=c1");
    rejected();
  });

  it("주소의 state 가 비어 있으면 거절한다", async () => {
    savePkce("verifier-1", "state-1");
    await visit("?code=c1&state=");
    rejected();
  });

  it("저장해 둔 state 가 없으면 거절한다", async () => {
    sessionStorage.setItem("pkce_code_verifier", "verifier-1");
    await visit("?code=c1&state=state-1");
    rejected();
  });

  it("state 가 다르면 거절한다", async () => {
    savePkce("verifier-1", "state-1");
    await visit("?code=c1&state=attacker");
    rejected();
  });

  it("verifier 가 없으면 거절한다", async () => {
    sessionStorage.setItem("pkce_state", "state-1");
    await visit("?code=c1&state=state-1");
    rejected();
  });
});
