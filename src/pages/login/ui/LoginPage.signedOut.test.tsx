// 로그아웃한 뒤의 로그인 화면(보안 점검 CLI-6) — `out=1` 은 담다만 로그아웃했다는 안내와 "그루 계정에서도 로그아웃"
// 보조 단추, `out=all` 은 그루 계정까지 끝났다는 안내만. 직접 로그아웃한 브라우저는 그루 계정 로그인에 prompt=login 을 붙인다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSignedOut,
  hasSignedOut,
  markSignedOut,
} from "@/features/auth/lib/signed-out-mark";
import { captureLocationHref } from "@/features/auth/lib/test-utils";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("@/shared/api", () => ({ hasToken: () => false }));
vi.mock("@/shared/config", async (orig) => ({
  ...(await orig<typeof import("@/shared/config")>()),
  config: { ssoUrl: "https://account.example" },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const { LoginPage } = await import("./LoginPage");

let container: HTMLDivElement;
let root: Root;
let location: ReturnType<typeof captureLocationHref>;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
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
});

const visit = (entry: string) =>
  act(() =>
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <LoginPage />
      </MemoryRouter>,
    ),
  );
const callout = () => container.querySelector("[data-slot=callout]");
const buttons = () => [...container.querySelectorAll("button")];
const click = (button: HTMLButtonElement) =>
  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
/** 그루 계정 로그인으로 떠나려던 주소의 쿼리 — 주소를 만드는 데 해시 계산이 끼어 기다린다 */
const loginQuery = async () => {
  await vi.waitFor(() => expect(location.sets).toHaveLength(1));
  const url = location.last()!;
  expect(url.startsWith("https://account.example/login?")).toBe(true);
  return new URLSearchParams(url.slice(url.indexOf("?") + 1));
};

describe("담다만 로그아웃한 뒤(out=1)", () => {
  beforeEach(() => visit("/login?out=1"));

  it("안내는 ds Callout neutral 이다 — 제목 '로그아웃했어요.' + 그루 계정이 남아 있다는 본문", () => {
    const box = callout()!;
    expect(box).not.toBeNull();
    expect(box.getAttribute("data-tone")).toBe("neutral");
    expect(box.querySelector("[data-slot=callout-title]")?.textContent).toBe(
      "signedOut.title",
    );
    expect(
      box.querySelector("[data-slot=callout-description]")?.textContent,
    ).toBe("signedOut.grooAccountHint");
  });

  it("로그인 단추 아래에 보조 단추 '그루 계정에서도 로그아웃' 이 있다 — neutralWeak large 전체 폭, 강조(Solid)는 여전히 하나", () => {
    const [login, account] = buttons();
    expect(buttons()).toHaveLength(2);
    expect(login!.textContent).toBe("sso.login");
    expect(login!.className).toContain("bg-bg-neutral-inverted");
    expect(account!.textContent).toBe("signedOut.grooAccountLogout");
    expect(account!.className).toContain("bg-bg-neutral-weak");
    expect(account!.className).not.toContain("bg-bg-neutral-inverted");
    expect(account!.className).toContain("min-h-[48px]");
    expect(account!.className).toContain("w-full");
    // 두 단추는 한 묶음(사이 8)이다
    expect(account!.parentElement).toBe(login!.parentElement);
    expect(account!.parentElement!.className).toContain("gap-x2");
  });

  it("보조 단추를 누르면 그루 계정 로그아웃 경유지로 떠나고 /login?out=all 로 돌아오게 한다", () => {
    click(buttons()[1]!);
    expect(location.sets).toEqual([
      `https://account.example/logout?redirect_uri=${encodeURIComponent(
        `${window.location.origin}/login?out=all`,
      )}`,
    ]);
    expect(buttons()[1]!.getAttribute("aria-busy")).toBe("true");
  });

  it("스스로 그루 계정으로 넘어가지 않는다 — 단추를 눌러야 간다", async () => {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(location.sets).toEqual([]);
    expect(buttons()[0]!.getAttribute("aria-busy")).not.toBe("true");
  });

  it("화면 제목 h1 하나 · 간격은 px 토큰 그대로다", () => {
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(container.innerHTML).not.toMatch(
      /(?:^|[\s"])(?:gap|p|px|py|m|mx|my)-[1-9]/,
    );
  });
});

describe("그루 계정까지 로그아웃하고 돌아온 뒤(out=all)", () => {
  beforeEach(() => visit("/login?out=all"));

  it("'그루 계정에서도 로그아웃했어요.' 안내만 있다 — 제목 없이 본문 한 줄", () => {
    const box = callout()!;
    expect(box).not.toBeNull();
    expect(box.querySelector("[data-slot=callout-title]")).toBeNull();
    expect(
      box.querySelector("[data-slot=callout-description]")?.textContent,
    ).toBe("signedOut.grooAccountDone");
  });

  it("전체 로그아웃 단추는 다시 보이지 않는다 — 로그인 단추 하나", () => {
    expect(buttons().map((b) => b.textContent)).toEqual(["sso.login"]);
    expect(container.textContent).not.toContain("signedOut.grooAccountLogout");
  });
});

describe("out 이 없거나 모르는 값이면 안내가 없다", () => {
  it.each(["/login", "/login?out=0", "/login?out=yes"])("%s", (entry) => {
    visit(entry);
    expect(callout()).toBeNull();
    expect(buttons()).toHaveLength(1);
  });
});

describe("다시 들어올 때 비밀번호 받기(prompt=login)", () => {
  it("직접 로그아웃한 표시가 있으면 로그인 주소에 prompt=login 이 붙는다", async () => {
    markSignedOut();
    visit("/login?out=1");
    click(buttons()[0]!);
    const q = await loginQuery();
    expect(q.get("prompt")).toBe("login");
    expect(q.get("code_challenge_method")).toBe("S256");
    expect(q.get("state")).toBe(sessionStorage.getItem("pkce_state"));
  });

  it("표시가 없으면 붙지 않는다", async () => {
    visit("/login");
    click(buttons()[0]!);
    expect((await loginQuery()).has("prompt")).toBe(false);
  });

  it("세션 만료(expired=1)는 표시를 남기지 않는다 — 곧장 넘어가되 prompt 없이(무음 재인증)", async () => {
    visit("/login?expired=1");
    expect((await loginQuery()).has("prompt")).toBe(false);
    expect(hasSignedOut()).toBe(false);
  });

  it("세션 만료로 왔어도 직접 로그아웃한 표시가 있는 브라우저면 비밀번호를 받는다", async () => {
    markSignedOut();
    visit("/login?expired=1");
    expect((await loginQuery()).get("prompt")).toBe("login");
  });
});
