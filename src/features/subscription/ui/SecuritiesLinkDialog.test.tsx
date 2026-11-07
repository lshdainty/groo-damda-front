// 증권사 연동 시트 · 대화상자(I-wrap-b1 β, 결정 B)를 고정한다.
// - 첫 단계는 증권사 줄 목록, 줄을 누르면 같은 표면 안 다음 단계(← 로 돌아온다)
// - 시트(1280 미만) ↔ 대화상자(1280 이상)가 바뀌어도 쓰던 키 · 눈 · 발급 직후 원문이 남는다
// - 토큰 원문은 발급 직후 한 번만 — 목록에 없고, 확인 · ← 로 치우면 사라진다
// - 연결 해제 · 토큰 폐기는 확인창 한 번 뒤에 나간다
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const RAW = "pdk_0123456789abcdefghijklmnopqrstuvwxyzABCDEFG";

const state = vi.hoisted(() => ({
  wide: false,
  connections: [] as Record<string, unknown>[],
  connectionsError: false,
  tokens: [] as Record<string, unknown>[],
  tokensError: false,
  registered: null as Record<string, string> | null,
  disconnected: null as string | null,
  revoked: null as number | null,
  issuedName: null as string | null,
  toasts: [] as string[],
  refetch: vi.fn(),
}));

vi.mock("react-i18next", () => ({
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
vi.mock("@/shared/config", () => ({ config: { apiBaseUrl: "/api" } }));
vi.mock("../model/useSubscription", () => ({
  useBrokerConnections: () => ({
    data: state.connectionsError ? undefined : state.connections,
    isLoading: false,
    isError: state.connectionsError,
    isRefetching: false,
    refetch: state.refetch,
  }),
  useApiTokens: () => ({
    data: state.tokensError ? undefined : state.tokens,
    isLoading: false,
    isError: state.tokensError,
    isRefetching: false,
    refetch: state.refetch,
  }),
  useRegisterBrokerCredential: () => ({
    mutate: (v: Record<string, string>, opts?: { onSuccess?: () => void }) => {
      state.registered = v;
      opts?.onSuccess?.();
    },
    reset: () => {},
    isPending: false,
    isError: false,
    error: null,
  }),
  useDisconnectBrokerCredential: () => ({
    mutateAsync: (b: string) => {
      state.disconnected = b;
      return Promise.resolve();
    },
    isPending: false,
  }),
  useSetPrimaryBroker: () => ({
    mutateAsync: () => Promise.resolve(),
    isPending: false,
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
    reset: () => {},
    isPending: false,
    isError: false,
  }),
  useRevokeApiToken: () => ({
    mutateAsync: (id: number) => {
      state.revoked = id;
      return Promise.resolve();
    },
    isPending: false,
    variables: undefined,
  }),
}));

const { SecuritiesLinkDialog } = await import("./SecuritiesLinkDialog");

const TOSS = {
  broker: "TOSS",
  displayName: "토스증권",
  issueUrl: "",
  keyLabel: "Client ID",
  secretLabel: "Client Secret",
  connected: true,
  verified: true,
  primary: true,
  verifiedAt: "2026-11-05T01:00:00Z",
};
const NAMU = {
  ...TOSS,
  broker: "NAMU",
  displayName: "나무증권",
  keyLabel: "App Key",
  secretLabel: "App Secret",
  connected: false,
  verified: false,
  primary: false,
  verifiedAt: null,
};

let container: HTMLDivElement;
let root: Root;
const render = (node: ReactNode) => act(() => root.render(node));
const closed = vi.fn();

function setWide(next: boolean) {
  state.wide = next;
  window.matchMedia = ((query: string) => ({
    matches: state.wide && query.includes("1280px"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  window.history.replaceState(null, "");
  setWide(false);
  state.connections = [TOSS, NAMU];
  state.connectionsError = false;
  state.tokens = [];
  state.tokensError = false;
  state.registered = state.disconnected = state.revoked = null;
  state.issuedName = null;
  state.toasts = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  closed.mockReset();
});

afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  document.body.removeAttribute("style");
  await new Promise((r) => setTimeout(r, 100));
});

const click = (el: Element) =>
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
const buttons = () => [...document.body.querySelectorAll("button")];
const buttonNamed = (text: string) =>
  buttons().find((b) => b.textContent?.trim() === text);
const rowNamed = (text: string) =>
  buttons().find((b) => b.textContent?.includes(text));
const back = () =>
  document.body.querySelector<HTMLButtonElement>("[data-slot=dialog-back]") ??
  document.body.querySelector<HTMLButtonElement>(
    "[data-slot=bottom-sheet-back]",
  ) ??
  buttons().find((b) => b.getAttribute("aria-label") === "뒤로");
function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const inputs = () => [
  ...document.body.querySelectorAll<HTMLInputElement>("input"),
];
const open = () => render(<SecuritiesLinkDialog onClose={closed} />);

describe("첫 단계 — 증권사 줄 목록", () => {
  it("증권사마다 줄 하나 · 연결 상태는 설명 글, 기본은 이름 옆 배지 하나", () => {
    open();
    const toss = rowNamed("토스증권")!;
    expect(toss.textContent).toContain("broker.rowConnected(11월 5일)");
    expect(toss.textContent).toContain("broker.primary");
    const namu = rowNamed("나무증권")!;
    expect(namu.textContent).toContain("broker.rowDisconnected");
    expect(namu.textContent).not.toContain("broker.primary");
    // 폼은 줄을 누르기 전에는 없다
    expect(inputs()).toHaveLength(0);
  });

  it("API 토큰 줄은 개수를, 0개면 없음을 보인다", () => {
    state.tokens = [
      {
        rowId: 1,
        name: "a",
        tokenPrefix: "p",
        createAt: "2026-09-30T03:00:00",
        lastUsedAt: null,
      },
    ];
    open();
    expect(rowNamed("apiToken.title")!.closest("li")!.textContent).toContain(
      "apiToken.count(1)",
    );
  });

  it("목록 실패는 그 자리 실패 + [다시 시도]", () => {
    state.connectionsError = true;
    open();
    expect(document.body.textContent).toContain("broker.loadFailed");
    click(
      buttonNamed("common.retry") ??
        buttons().find((b) => b.textContent?.includes("retry"))!,
    );
    expect(state.refetch).toHaveBeenCalled();
  });
});

describe("다음 단계 — 증권사", () => {
  it("미연결 줄을 누르면 키 폼, ← 로 첫 단계에 돌아온다", () => {
    open();
    click(rowNamed("나무증권")!);
    expect(inputs().map((i) => i.placeholder)).toEqual(["", ""]);
    expect(document.body.textContent).toContain("App Key");
    expect(document.body.textContent).toContain("App Secret");
    expect(buttonNamed("broker.connect")!.disabled).toBe(true);
    click(back()!);
    expect(inputs()).toHaveLength(0);
  });

  it("쓴 키로 연결하면 공백을 떼고 보낸다", () => {
    open();
    click(rowNamed("나무증권")!);
    const [key, secret] = inputs() as [HTMLInputElement, HTMLInputElement];
    type(key, " AK ");
    type(secret, "SK");
    click(buttonNamed("broker.connect")!);
    expect(state.registered).toEqual({
      broker: "NAMU",
      apiKey: "AK",
      apiSecret: "SK",
    });
    expect(state.toasts).toContain("broker.toastConnected(나무증권)");
  });

  it("눈 단추는 고정 이름 + aria-pressed, 켜면 보인다", () => {
    open();
    click(rowNamed("나무증권")!);
    const eye = document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="broker.toggleReveal(App Key)"]',
    )!;
    expect(eye.getAttribute("aria-pressed")).toBe("false");
    expect(inputs()[0]!.type).toBe("password");
    click(eye);
    expect(eye.getAttribute("aria-pressed")).toBe("true");
    expect(inputs()[0]!.type).toBe("text");
  });

  it("연결됨 — 연결 해제는 확인창 한 번 뒤에 나간다", async () => {
    open();
    click(rowNamed("토스증권")!);
    click(buttonNamed("broker.disconnect")!);
    expect(state.disconnected).toBeNull();
    expect(document.body.textContent).toContain("broker.disconnectDesc");
    const confirm = buttons().filter(
      (b) => b.textContent === "broker.disconnect",
    );
    await act(async () => click(confirm[confirm.length - 1]!));
    expect(state.disconnected).toBe("TOSS");
    // 해제가 끝나면 첫 단계로 — 스낵바는 증권사 이름 없이
    expect(state.toasts).toContain("broker.toastDisconnected");
    expect(
      document.body.querySelector("[data-slot=dialog-back]") ??
        document.body.querySelector("[data-slot=bottom-sheet-back]"),
    ).toBeNull();
    expect(rowNamed("나무증권")).toBeDefined();
  });

  it("이미 기본이면 [기본으로 쓰기] 버튼이 없다", () => {
    open();
    click(rowNamed("토스증권")!);
    expect(buttonNamed("broker.useAsPrimary")).toBeUndefined();
  });
});

describe("폭을 넘나들어도 남는다 (M3)", () => {
  it("390 → 1440 → 390: 쓰던 키 · 눈 · 단계가 남는다", () => {
    open();
    click(rowNamed("나무증권")!);
    type(inputs()[0]!, "AK-keep");
    click(
      document.body.querySelector(
        'button[aria-label="broker.toggleReveal(App Key)"]',
      )!,
    );
    setWide(true);
    open();
    act(() => window.dispatchEvent(new Event("resize")));
    // 표면이 바뀌어도 같은 단계 · 같은 값
    expect(inputs()[0]!.value).toBe("AK-keep");
    expect(inputs()[0]!.type).toBe("text");
    expect(
      document.body.querySelector("[data-slot=dialog-content]"),
    ).not.toBeNull();
  });
});

describe("API 토큰 단계", () => {
  const goTokens = () => click(rowNamed("apiToken.title")!);

  it("이름이 비면 만들 수 없고, 만들면 원문이 한 번 보인다", () => {
    open();
    goTokens();
    expect(buttonNamed("apiToken.issue")!.disabled).toBe(true);
    type(inputs()[0]!, "  보고서  ");
    click(buttonNamed("apiToken.issue")!);
    expect(state.issuedName).toBe("보고서");
    expect(inputs().find((i) => i.readOnly)!.value).toBe(RAW);
    expect(document.body.querySelector("textarea")!.value).toContain(
      `Bearer ${RAW}`,
    );
  });

  const copyIt = async () => {
    Object.assign(navigator, { clipboard: { writeText: async () => {} } });
    await act(async () => {
      document.body
        .querySelector('button[aria-label="apiToken.copy"]')!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  };

  it("복사한 뒤 확인을 누르면 원문이 사라진다", async () => {
    open();
    goTokens();
    type(inputs()[0]!, "보고서");
    click(buttonNamed("apiToken.issue")!);
    await copyIt();
    click(buttonNamed("apiToken.done")!);
    expect(document.body.innerHTML).not.toContain(RAW);
  });

  it("복사한 뒤 ← 로 나가면 원문이 남지 않는다", async () => {
    open();
    goTokens();
    type(inputs()[0]!, "보고서");
    click(buttonNamed("apiToken.issue")!);
    await copyIt();
    click(back()!);
    goTokens();
    expect(document.body.innerHTML).not.toContain(RAW);
  });

  it("목록에는 앞부분과 날짜만 — 원문은 없다", () => {
    state.tokens = [
      {
        rowId: 3,
        name: "보고서 차트",
        tokenPrefix: "pdk_01234567",
        createAt: "2026-09-30T03:00:00",
        lastUsedAt: null,
      },
    ];
    open();
    goTokens();
    expect(document.body.textContent).toContain("pdk_01234567…");
    expect(document.body.textContent).toContain("apiToken.neverUsed");
    expect(document.body.innerHTML).not.toContain(RAW);
  });

  it("폐기는 확인창 한 번 뒤에 그 번호로 나간다", async () => {
    state.tokens = [
      {
        rowId: 3,
        name: "보고서 차트",
        tokenPrefix: "pdk_01234567",
        createAt: "2026-09-30T03:00:00",
        lastUsedAt: null,
      },
    ];
    open();
    goTokens();
    click(
      document.body.querySelector(
        'button[aria-label="apiToken.revokeAria(보고서 차트)"]',
      )!,
    );
    expect(state.revoked).toBeNull();
    const confirm = buttons().filter(
      (b) => b.textContent === "apiToken.revoke",
    );
    await act(async () => click(confirm[confirm.length - 1]!));
    expect(state.revoked).toBe(3);
  });

  const issue = () => {
    goTokens();
    type(inputs()[0]!, "보고서");
    click(buttonNamed("apiToken.issue")!);
  };
  const confirmClose = () =>
    buttons()
      .filter((b) => b.textContent === "apiToken.copyAskClose")
      .pop();

  it("복사하지 않고 확인 · ← · ✕ 로 나가면 한 번 묻는다", () => {
    open();
    issue();
    click(buttonNamed("apiToken.done")!);
    expect(document.body.textContent).toContain("apiToken.copyAskTitle");
    expect(inputs().find((i) => i.readOnly)).toBeDefined();
    click(
      buttons()
        .filter((b) => b.textContent === "cancel")
        .pop()!,
    );
    click(back()!);
    expect(document.body.textContent).toContain("apiToken.copyAskTitle");
  });

  it("묻는 말에서 [닫기] 를 누르면 원문을 버리고 나간다", () => {
    open();
    issue();
    click(buttonNamed("apiToken.done")!);
    click(confirmClose()!);
    expect(document.body.innerHTML).not.toContain(RAW);
  });

  it("✕ 로 닫으려 해도 묻고, 닫기 전엔 onClose 가 안 불린다", () => {
    open();
    issue();
    click(
      document.body.querySelector<HTMLButtonElement>(
        "[data-slot=bottom-sheet-close], [data-slot=dialog-close]",
      )!,
    );
    expect(closed).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("apiToken.copyAskTitle");
    click(confirmClose()!);
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it("한 번이라도 복사했으면 묻지 않는다", async () => {
    Object.assign(navigator, {
      clipboard: { writeText: async () => {} },
    });
    open();
    issue();
    await act(async () => {
      document.body
        .querySelector('button[aria-label="apiToken.copy"]')!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    click(buttonNamed("apiToken.done")!);
    expect(document.body.textContent).not.toContain("apiToken.copyAskTitle");
    expect(document.body.innerHTML).not.toContain(RAW);
  });

  it("목록 실패는 [다시 시도] 를 둔다", () => {
    state.tokensError = true;
    open();
    goTokens();
    expect(document.body.textContent).toContain("apiToken.loadFailed");
  });
});
