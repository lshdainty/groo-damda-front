// API 토큰 카드가 **원문을 딱 한 번만** 보여 주는지를 고정한다.
//
// 토큰 원문은 서버에도 해시로만 남는다. 화면이 이걸 어기면 보안 장치가 통째로 무의미해진다.
// - 목록에 원문이 실리면 → 화면을 연 것만으로 토큰이 다시 노출된다
// - 발급 직후 원문을 못 보면 → 사용자는 쓸 수 없는 토큰을 만든 셈이다(다시 받아 올 길이 없다)
// - 닫은 뒤에도 원문이 남으면 → 자리를 비운 사이 어깨너머로 읽힌다
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const RAW = "pdk_0123456789abcdefghijklmnopqrstuvwxyzABCDEFG";

const state = vi.hoisted(() => ({
  tokens: [] as Record<string, unknown>[],
  issuedName: null as string | null,
  revoked: null as number | null,
  toasts: [] as string[],
  // dev·운영 빌드는 상대 경로(`/api`)다 — 화면과 API 가 같은 출처라서. 그 값을 기본으로 둔다.
  config: { apiBaseUrl: "/api" },
}));

vi.mock("react-i18next", () => ({
  // 보간값을 뒤에 붙여 돌려준다 — 날짜·이름이 실제로 넘어가는지 볼 수 있게.
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      o ? `${k}(${Object.values(o).join(",")})` : k,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/shared/ds/snackbar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/ds/snackbar")>()),
  useSnackbar: () => ({
    show: (o: { message: string }) => state.toasts.push(o.message),
    dismiss: () => {},
  }),
}));
vi.mock("@/shared/config", () => ({ config: state.config }));
vi.mock("../model/useSubscription", () => ({
  useApiTokens: () => ({
    data: state.tokens,
    isLoading: false,
    isError: false,
  }),
  useIssueApiToken: () => ({
    mutate: (
      name: string,
      opts?: { onSuccess?: (d: Record<string, unknown>) => void },
    ) => {
      state.issuedName = name;
      opts?.onSuccess?.({
        rowId: 9,
        name,
        token: RAW,
        tokenPrefix: "pdk_01234567",
        createAt: "2026-09-30T03:00:00",
      });
    },
    isPending: false,
    reset: () => {},
    isError: false,
  }),
  useRevokeApiToken: () => ({
    mutateAsync: (rowId: number) => {
      state.revoked = rowId;
      return Promise.resolve();
    },
    isPending: false,
    variables: undefined,
  }),
}));

const { ApiTokenCard } = await import("./ApiTokenCard");

let container: HTMLDivElement;
let root: Root;

function render() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<ApiTokenCard />));
}

const buttonNamed = (text: string) =>
  [...document.body.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === text,
  );

// `el.click()` 은 React 19 의 위임에 안 잡힌다 — 레포의 다른 테스트처럼 실제 MouseEvent 를 쏜다.
const click = (el: Element) =>
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

/** Button 의 더블클릭 가드는 클릭 다음 매크로태스크에서 풀린다 — 연달아 누르기 전에 넘긴다. */
const flushClickGuard = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

function typeName(value: string) {
  const input = document.body.querySelector(
    'input[placeholder="apiToken.namePlaceholder"]',
  ) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const tokenInput = () =>
  [...document.body.querySelectorAll("input")].find((i) => i.readOnly) as
    HTMLInputElement | undefined;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  state.tokens = [];
  state.config.apiBaseUrl = "/api";
  state.issuedName = null;
  state.revoked = null;
  state.toasts = [];
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("ApiTokenCard", () => {
  it("목록에는 앞부분만 나온다 — 원문은 어디에도 없다", () => {
    state.tokens = [
      {
        rowId: 3,
        name: "보고서 차트",
        tokenPrefix: "pdk_01234567",
        createAt: "2026-09-30T03:00:00",
        lastUsedAt: null,
      },
    ];

    render();

    expect(document.body.textContent).toContain("보고서 차트");
    expect(document.body.textContent).toContain("pdk_01234567…");
    expect(document.body.textContent).toContain("apiToken.neverUsed");
    expect(document.body.innerHTML).not.toContain(RAW);
    expect(tokenInput()).toBeUndefined();
  });

  it("마지막 사용 시각이 있으면 그 시각을 보여 준다", () => {
    state.tokens = [
      {
        rowId: 3,
        name: "보고서 차트",
        tokenPrefix: "pdk_01234567",
        createAt: "2026-09-30T03:00:00",
        lastUsedAt: "2026-09-30T04:30:00",
      },
    ];

    render();

    expect(document.body.textContent).toContain("apiToken.lastUsed(2026-09-30");
    expect(document.body.textContent).not.toContain("apiToken.neverUsed");
  });

  it("토큰이 없으면 없다고 말한다", () => {
    render();

    expect(document.body.textContent).toContain("apiToken.empty");
  });

  it("이름이 비어 있으면 만들 수 없다", () => {
    render();

    expect(buttonNamed("apiToken.issue")!.disabled).toBe(true);

    typeName("   ");
    expect(buttonNamed("apiToken.issue")!.disabled).toBe(true);

    typeName("보고서");
    expect(buttonNamed("apiToken.issue")!.disabled).toBe(false);
  });

  it("만들면 원문과 호출 예시가 보인다 — 이름은 앞뒤 공백을 떼고 보낸다", () => {
    render();
    typeName("  보고서 차트  ");

    click(buttonNamed("apiToken.issue")!);

    expect(state.issuedName).toBe("보고서 차트");
    expect(tokenInput()!.value).toBe(RAW);
    const example = document.body.querySelector("textarea")!.value;
    expect(example).toContain(`Authorization: Bearer ${RAW}`);
    // 원문을 보는 동안에는 새로 만드는 칸을 치운다 — 한 번에 하나만 본다
    expect(buttonNamed("apiToken.issue")).toBeUndefined();
    expect(document.body.textContent).toContain("apiToken.issuedDesc");
  });

  // 이 예시를 쓰는 건 사용자의 프로그램이다 — 거기에는 "지금 이 화면의 출처" 가 없다.
  // 상대 경로가 그대로 나가면(`"/api/v1/..."`) 어디로 부르라는 건지 알 수 없다. 처음에 그렇게 나갔다.
  it("호출 예시의 주소는 전체 주소다 — 빌드의 API 주소가 상대 경로여도", () => {
    render();
    typeName("보고서 차트");

    click(buttonNamed("apiToken.issue")!);

    const example = document.body.querySelector("textarea")!.value;
    expect(window.location.origin).toMatch(/^https?:\/\//);
    expect(example).toContain(
      `"${window.location.origin}/api/v1/securities/candles?symbol=005930&interval=1m"`,
    );
    expect(example).not.toContain('"/api/');
  });

  it("API 주소가 절대 주소로 설정된 빌드에서는 그 주소가 그대로 나온다", () => {
    state.config.apiBaseUrl = "https://api.desk.example/api";
    render();
    typeName("보고서 차트");

    click(buttonNamed("apiToken.issue")!);

    expect(document.body.querySelector("textarea")!.value).toContain(
      '"https://api.desk.example/api/v1/securities/candles?symbol=005930&interval=1m"',
    );
  });

  it("확인을 누르면 원문이 화면에서 사라진다", async () => {
    render();
    typeName("보고서 차트");
    click(buttonNamed("apiToken.issue")!);
    await flushClickGuard();

    click(buttonNamed("apiToken.done")!);

    expect(document.body.innerHTML).not.toContain(RAW);
    expect(tokenInput()).toBeUndefined();
    expect(document.body.querySelector("textarea")).toBeNull();
    expect(buttonNamed("apiToken.issue")).toBeDefined();
  });

  it("복사 버튼은 원문을 클립보드에 넣는다", async () => {
    const written: string[] = [];
    Object.assign(navigator, {
      clipboard: {
        writeText: async (text: string) => {
          written.push(text);
        },
      },
    });
    render();
    typeName("보고서 차트");
    click(buttonNamed("apiToken.issue")!);

    await act(async () => {
      document.body
        .querySelector('button[aria-label="apiToken.copy"]')!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(written).toEqual([RAW]);
    expect(state.toasts).toContain("apiToken.toastCopied");
  });

  it("폐기는 그 토큰 번호로 나간다", async () => {
    state.tokens = [
      {
        rowId: 3,
        name: "보고서 차트",
        tokenPrefix: "pdk_01234567",
        createAt: "2026-09-30T03:00:00",
        lastUsedAt: null,
      },
    ];
    render();

    await act(async () =>
      click(
        document.body.querySelector(
          'button[aria-label="apiToken.revokeAria(보고서 차트)"]',
        )!,
      ),
    );

    expect(state.revoked).toBe(3);
    expect(state.toasts).toContain("apiToken.toastRevoked");
  });

  it("방금 만든 토큰을 폐기하면 원문도 같이 치운다 — 이미 죽은 값이다", async () => {
    state.tokens = [
      {
        rowId: 9,
        name: "보고서 차트",
        tokenPrefix: "pdk_01234567",
        createAt: "2026-09-30T03:00:00",
        lastUsedAt: null,
      },
    ];
    render();
    typeName("보고서 차트");
    click(buttonNamed("apiToken.issue")!);
    expect(tokenInput()!.value).toBe(RAW);
    await flushClickGuard();

    click(
      document.body.querySelector(
        'button[aria-label="apiToken.revokeAria(보고서 차트)"]',
      )!,
    );

    expect(state.revoked).toBe(9);
    // 폐기는 mutateAsync().then(done) — 응답 뒤에 원문을 치운다
    await act(async () => {});
    expect(document.body.innerHTML).not.toContain(RAW);
  });
});
