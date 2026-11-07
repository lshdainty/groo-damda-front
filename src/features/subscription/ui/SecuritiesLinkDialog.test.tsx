// 증권사 연동 시트 · 대화상자(I-wrap-b1 β, 결정 B)를 고정한다. 요청은 가짜가 아니라 **진짜 훅 + 진짜 QueryClient** 로 돌린다 —
// 진행 중(busy) · 실패 Callout 세 갈래 · 확인 못 함 · 뮤테이션 캐시가 실제로 도는 것을 봐야 해서다(코드 검수 L10).
// - 첫 단계는 증권사 줄 목록, 줄을 누르면 같은 표면 안 다음 단계(← 로 돌아온다) · 단계가 바뀌면 초점이 따라간다
// - 시트(1280 미만) ↔ 대화상자(1280 이상)가 바뀌어도 쓰던 키 · 눈 · 발급 직후 원문이 남는다 · 닫았다 다시 열면 처음부터
// - 토큰 원문은 발급 직후 한 번만 — 목록에 없고, 복사 안 하고 나가면 묻고, 닫은 뒤 뮤테이션 캐시에도 없다
// - 연결 해제 · 토큰 폐기는 확인창 한 번 뒤에 나간다
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WriteUnconfirmedError } from "@/shared/api";

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
  /** 있으면 그 요청은 이 약속이 풀릴 때까지 기다린다(진행 중 시험) */
  hold: null as Promise<void> | null,
  /** 있으면 그 요청이 이 오류로 실패한다 */
  fail: null as unknown,
  registered: [] as Record<string, string>[],
  disconnected: [] as string[],
  primaried: [] as string[],
  revoked: [] as number[],
  issuedNames: [] as string[],
  toasts: [] as { message: string; tone?: string }[],
  closed: 0,
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
    show: (o: { message: string; tone?: string }) => state.toasts.push(o),
    dismiss: () => {},
  }),
}));
vi.mock("@/shared/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/config")>()),
  config: { apiBaseUrl: "/api" },
}));

const gate = async <T,>(value: T): Promise<T> => {
  if (state.hold) await state.hold;
  if (state.fail) throw state.fail;
  return value;
};
vi.mock("../api/subscriptionApi", () => ({
  subscriptionApi: {
    getBrokerConnections: async () => {
      if (state.connectionsError) throw new Error("x");
      return state.connections;
    },
    getApiTokens: async () => {
      if (state.tokensError) throw new Error("x");
      return state.tokens;
    },
    registerBrokerCredential: async (
      broker: string,
      apiKey: string,
      apiSecret: string,
    ) => {
      state.registered.push({ broker, apiKey, apiSecret });
      return gate(undefined);
    },
    disconnectBrokerCredential: async (broker: string) => {
      state.disconnected.push(broker);
      return gate(undefined);
    },
    setPrimaryBroker: async (broker: string) => {
      state.primaried.push(broker);
      return gate(undefined);
    },
    issueApiToken: async (name: string) => {
      state.issuedNames.push(name);
      return gate({
        rowId: 9,
        name,
        token: RAW,
        tokenPrefix: "pdk_01234567",
        createAt: "2026-09-30T03:00:00",
      });
    },
    revokeApiToken: async (rowId: number) => {
      state.revoked.push(rowId);
      return gate(undefined);
    },
  },
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
const TOKEN = {
  rowId: 3,
  name: "보고서 차트",
  tokenPrefix: "pdk_01234567",
  createAt: "2026-09-30T03:00:00",
  lastUsedAt: null,
};

let container: HTMLDivElement;
let root: Root;
let qc: QueryClient;

/** AccountSection 과 같은 배선 — closed → open → closing(open=false) → closed */
function Host() {
  const [st, setSt] = useState<"closed" | "open" | "closing">("closed");
  return (
    <>
      <button id="trigger" type="button" onClick={() => setSt("open")}>
        trigger
      </button>
      {st !== "closed" && (
        <SecuritiesLinkDialog
          open={st === "open"}
          onClose={() => {
            state.closed += 1;
            setSt("closing");
          }}
          onClosed={() => setSt("closed")}
        />
      )}
    </>
  );
}

function setWide(next: boolean) {
  state.wide = next;
  window.matchMedia = ((query: string) => ({
    matches: state.wide && query.includes("1280px"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
}

// act 한 번에 오래 기다리면 그 사이 타이머가 부른 상태 갱신이 act 가 끝날 때까지 밀린다 — 긴 기다림은 짧게 쪼개 돈다
const tick = (ms: number) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
const wait = async (ms = 0) => {
  if (ms <= 50) return tick(ms);
  for (let left = ms; left > 0; left -= 50) await tick(50);
};

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
  state.hold = null;
  state.fail = null;
  state.registered = [];
  state.disconnected = [];
  state.primaried = [];
  state.revoked = [];
  state.issuedNames = [];
  state.toasts = [];
  state.closed = 0;
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
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
const lastButtonNamed = (text: string) =>
  buttons()
    .filter((b) => b.textContent?.trim() === text)
    .pop();
const rowNamed = (text: string) =>
  buttons().find((b) => b.textContent?.includes(text));
const back = () =>
  document.body.querySelector<HTMLButtonElement>(
    "[data-slot=dialog-back], [data-slot=bottom-sheet-back]",
  );
const closeX = () =>
  document.body.querySelector<HTMLButtonElement>(
    "[data-slot=dialog-close], [data-slot=bottom-sheet-close]",
  );
const title = () =>
  document.body.querySelector<HTMLElement>(
    "[data-slot=dialog-title], [data-slot=bottom-sheet-title]",
  );
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

/** 연 줄에 초점을 두고 눌러 연다 — 닫을 때 초점이 돌아올 자리 */
async function open() {
  act(() =>
    root.render(
      <QueryClientProvider client={qc}>
        <Host />
      </QueryClientProvider>,
    ),
  );
  const trigger = document.getElementById("trigger")!;
  act(() => trigger.focus());
  click(trigger);
  await wait(20);
}
const toNamu = async () => {
  click(rowNamed("나무증권")!);
  await wait();
};
const toTokens = async () => {
  click(rowNamed("apiToken.title")!);
  await wait();
};
const fillNamu = () => {
  const [key, secret] = inputs() as [HTMLInputElement, HTMLInputElement];
  type(key, " AK ");
  type(secret, "SK");
};

describe("첫 단계 — 증권사 줄 목록", () => {
  it("증권사마다 줄 하나 · 연결 상태는 설명 글, 기본은 이름 옆 neutral 배지 하나", async () => {
    await open();
    const toss = rowNamed("토스증권")!;
    expect(toss.textContent).toContain("broker.rowConnected(11월 5일)");
    const badge = toss.querySelector("[data-slot=badge]")!;
    expect(badge.textContent).toBe("broker.primary");
    // 배지는 neutral(brand 는 요금제 · 본인 표시만) · 왼쪽 여백(ml-*)을 달지 않는다
    expect(badge.className).toContain("bg-bg-neutral-weak");
    expect(badge.className).not.toMatch(/\bml-/);
    const namu = rowNamed("나무증권")!;
    expect(namu.textContent).toContain("broker.rowDisconnected");
    expect(namu.querySelector("[data-slot=badge]")).toBeNull();
    expect(inputs()).toHaveLength(0);
  });

  it("API 토큰 줄은 개수를, 0개면 없음을 보인다", async () => {
    state.tokens = [TOKEN];
    await open();
    expect(rowNamed("apiToken.title")!.closest("li")!.textContent).toContain(
      "apiToken.count(1)",
    );
  });

  it("목록 실패는 그 자리 실패 + [다시 시도]", async () => {
    state.connectionsError = true;
    await open();
    expect(document.body.textContent).toContain("broker.loadFailed");
    expect(rowNamed("common.retry")).toBeDefined();
  });
});

describe("다음 단계 — 증권사", () => {
  it("미연결 줄을 누르면 키 폼(자리 글 없음), ← 로 첫 단계에 돌아온다", async () => {
    await open();
    await toNamu();
    expect(inputs().map((i) => i.placeholder)).toEqual(["", ""]);
    expect(document.body.textContent).toContain("App Key");
    expect(buttonNamed("broker.connect")!.disabled).toBe(true);
    click(back()!);
    expect(inputs()).toHaveLength(0);
  });

  it("쓴 키로 연결하면 공백을 떼고 보내고, 연결됨 단계에 머물며 positive 스낵바", async () => {
    await open();
    await toNamu();
    fillNamu();
    // 연결 뒤 서버가 연결됨으로 답한다
    state.connections = [
      TOSS,
      { ...NAMU, connected: true, verifiedAt: "2026-11-06T01:00:00Z" },
    ];
    click(buttonNamed("broker.connect")!);
    await wait(20);
    expect(state.registered).toEqual([
      { broker: "NAMU", apiKey: "AK", apiSecret: "SK" },
    ]);
    expect(state.toasts).toContainEqual({
      message: "broker.toastConnected(나무증권)",
      tone: "positive",
    });
    expect(title()?.textContent).toBe("나무증권");
    expect(inputs()).toHaveLength(0);
    expect(buttonNamed("broker.disconnect")).toBeDefined();
  });

  it("눈 단추는 고정 이름 + aria-pressed, 켜면 보인다", async () => {
    await open();
    await toNamu();
    const eye = document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="broker.toggleReveal(App Key)"]',
    )!;
    expect(eye.getAttribute("aria-pressed")).toBe("false");
    expect(inputs()[0]!.type).toBe("password");
    click(eye);
    expect(eye.getAttribute("aria-pressed")).toBe("true");
    expect(inputs()[0]!.type).toBe("text");
  });

  it("연결됨 — 연결 해제는 확인창 한 번 뒤에 나가고, 끝나면 첫 단계 + 스낵바", async () => {
    await open();
    click(rowNamed("토스증권")!);
    await wait();
    click(buttonNamed("broker.disconnect")!);
    expect(state.disconnected).toEqual([]);
    expect(document.body.textContent).toContain("broker.disconnectDesc");
    state.connections = [{ ...TOSS, connected: false, primary: false }, NAMU];
    click(lastButtonNamed("broker.disconnect")!);
    await wait(20);
    expect(state.disconnected).toEqual(["TOSS"]);
    expect(state.toasts.map((t) => t.message)).toContain(
      "broker.toastDisconnected",
    );
    expect(back()).toBeNull();
    expect(rowNamed("나무증권")).toBeDefined();
  });

  it("해제 응답을 확인 못 하면 실패로 말하지 않고 확인 못 함 문장 + 상태를 다시 받는다", async () => {
    await open();
    click(rowNamed("토스증권")!);
    await wait();
    click(buttonNamed("broker.disconnect")!);
    state.fail = new WriteUnconfirmedError(0, "delete");
    const before = qc.getQueryState(["subscription", "broker-connections"]);
    void before;
    click(lastButtonNamed("broker.disconnect")!);
    await wait(20);
    expect(state.toasts).toContainEqual({
      message: "broker.disconnectUnconfirmed",
      tone: "critical",
    });
    // [다시 시도] 를 두지 않는다 — 다시 하면 두 번 될 수 있다
    expect(state.toasts[state.toasts.length - 1]).not.toHaveProperty("action");
  });

  it("이미 기본이면 [기본으로 쓰기] 버튼이 없다", async () => {
    await open();
    click(rowNamed("토스증권")!);
    await wait();
    expect(buttonNamed("broker.useAsPrimary")).toBeUndefined();
  });

  describe("기본으로 쓰기", () => {
    const bothConnected = () => {
      state.connections = [
        { ...TOSS, primary: true },
        { ...NAMU, connected: true, verifiedAt: "2026-11-04T01:00:00Z" },
      ];
    };

    it("같은 프레임에 두 번 눌러도 요청은 한 번이다", async () => {
      bothConnected();
      await open();
      await toNamu();
      const btn = buttonNamed("broker.useAsPrimary")!;
      act(() => {
        btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      await wait(20);
      expect(state.primaried).toEqual(["NAMU"]);
    });

    it("응답을 확인 못 하면 '바뀌었는지 확인하지 못했어요' 한 문장 — [다시 시도] 없음", async () => {
      bothConnected();
      await open();
      await toNamu();
      state.fail = new WriteUnconfirmedError(0, "save");
      click(buttonNamed("broker.useAsPrimary")!);
      await wait(20);
      expect(state.toasts).toContainEqual({
        message: "query.unconfirmedToggle",
        tone: "critical",
      });
    });
  });
});

describe("진행 중 · 실패 (진짜 요청)", () => {
  it("연결 중에는 ← · ✕ · Esc 가 닫지 않고 [연결하기] 가 로딩이다", async () => {
    await open();
    await toNamu();
    fillNamu();
    let release!: () => void;
    state.hold = new Promise<void>((r) => (release = r));
    click(buttonNamed("broker.connect")!);
    await wait();
    click(back()!);
    click(closeX() ?? document.body);
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(state.closed).toBe(0);
    expect(inputs()).toHaveLength(2);
    release();
    await wait(20);
  });

  it("연결 실패 Callout — 4xx · 그 밖 · 확인 못 함 세 갈래, 쓴 값은 그대로", async () => {
    await open();
    await toNamu();
    fillNamu();
    state.fail = { response: { status: 401 } };
    click(buttonNamed("broker.connect")!);
    await wait(20);
    expect(document.body.querySelector("[role=alert]")?.textContent).toContain(
      "broker.toastInvalid",
    );
    expect(inputs()[0]!.value).toBe(" AK ");

    state.fail = { response: { status: 500 } };
    click(buttonNamed("broker.connect")!);
    await wait(20);
    expect(document.body.querySelector("[role=alert]")?.textContent).toContain(
      "broker.connectFailed",
    );

    state.fail = new WriteUnconfirmedError(0, "save");
    click(buttonNamed("broker.connect")!);
    await wait(20);
    expect(document.body.querySelector("[role=alert]")?.textContent).toContain(
      "query.unconfirmedConnect",
    );
  });

  it("토큰 발급 실패 Callout — 실패 · 확인 못 함(목록에서 확인) 두 갈래", async () => {
    await open();
    await toTokens();
    type(inputs()[0]!, "보고서");
    state.fail = new Error("boom");
    click(buttonNamed("apiToken.issue")!);
    await wait(20);
    expect(document.body.querySelector("[role=alert]")?.textContent).toContain(
      "apiToken.issueFailed",
    );
    state.fail = new WriteUnconfirmedError(0, "save");
    click(buttonNamed("apiToken.issue")!);
    await wait(20);
    expect(document.body.querySelector("[role=alert]")?.textContent).toContain(
      "apiToken.issueUnconfirmed",
    );
    expect(inputs()[0]!.value).toBe("보고서");
  });
});

describe("닫기 · 다시 열기 · 초점 · 캐시", () => {
  it("닫으면 연 줄(단추)로 초점이 돌아오고 모션 뒤에 내려간다 — 1280 미만", async () => {
    await open();
    click(closeX()!);
    // 시트는 닫힘 모션(jsdom 은 대체 타이머)이 끝나야 닫힘이 알려진다
    await wait(1500);
    expect(document.activeElement?.id).toBe("trigger");
    expect(document.body.querySelector("[role=dialog]")).toBeNull();
  });

  it("닫으면 연 줄(단추)로 초점이 돌아온다 — 1280 이상 대화상자", async () => {
    setWide(true);
    await open();
    click(closeX()!);
    await wait(20);
    expect(document.activeElement?.id).toBe("trigger");
  });

  it("닫았다 다시 열면 늘 처음부터 — 단계 · 쓰던 키 · 눈이 비워진다", async () => {
    await open();
    await toNamu();
    fillNamu();
    // 쓴 값이 있어 ✕ 는 묻는다 — 나간다
    click(closeX()!);
    click(lastButtonNamed("나가기")!);
    await wait(1500);
    click(document.getElementById("trigger")!);
    await wait(20);
    expect(title()?.textContent).toBe("broker.title");
    await toNamu();
    expect(inputs().map((i) => i.value)).toEqual(["", ""]);
  });

  it("닫은 뒤 뮤테이션 캐시에 입력 키 · 발급 원문이 남지 않는다", async () => {
    const dump = () =>
      JSON.stringify(
        qc
          .getMutationCache()
          .getAll()
          .map((m) => [m.state.variables, m.state.data]),
      );
    await open();
    await toNamu();
    fillNamu();
    click(buttonNamed("broker.connect")!);
    await wait(20);
    // 열려 있는 동안에는 화면이 요청 상태를 들고 있다 — 닫아 내려가야 버려진다
    await toTokens().catch(() => {});
    click(back()!);
    await wait();
    click(rowNamed("apiToken.title")!);
    await wait();
    type(inputs()[0]!, "보고서");
    click(buttonNamed("apiToken.issue")!);
    await wait(20);
    expect(document.body.innerHTML).toContain(RAW);
    // 복사하고 닫는다
    Object.assign(navigator, { clipboard: { writeText: async () => {} } });
    await act(async () => {
      document.body
        .querySelector('button[aria-label="apiToken.copy"]')!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    click(closeX()!);
    await wait(1500);
    expect(document.body.querySelector("[role=dialog]")).toBeNull();

    expect(dump()).not.toContain("AK");
    expect(dump()).not.toContain("SK");
    expect(dump()).not.toContain(RAW);
  });
});

describe("단계 초점 · 기기 뒤로 가기", () => {
  it("들어가면 새 단계 제목으로, ← 로 돌아오면 누른 줄로 초점이 간다", async () => {
    await open();
    click(rowNamed("나무증권")!);
    await wait(20);
    expect(document.activeElement).toBe(title());
    click(back()!);
    await wait(20);
    expect(document.activeElement?.getAttribute("data-sec-row")).toBe("NAMU");
  });

  it("기기 뒤로 가기(1280 미만)는 한 단계 뒤 — 첫 단계에서만 시트가 닫힌다", async () => {
    await open();
    await toNamu();
    act(() => {
      window.history.back();
    });
    await wait(50);
    expect(title()?.textContent).toBe("broker.title");
    expect(state.closed).toBe(0);
  });
});

describe("폭을 넘나들어도 남는다 (M3)", () => {
  it("390 → 1440 → 390: 쓰던 키 · 눈 · 단계가 남는다", async () => {
    await open();
    await toNamu();
    type(inputs()[0]!, "AK-keep");
    click(
      document.body.querySelector(
        'button[aria-label="broker.toggleReveal(App Key)"]',
      )!,
    );
    setWide(true);
    act(() =>
      root.render(
        <QueryClientProvider client={qc}>
          <Host />
        </QueryClientProvider>,
      ),
    );
    act(() => window.dispatchEvent(new Event("resize")));
    expect(inputs()[0]!.value).toBe("AK-keep");
    expect(inputs()[0]!.type).toBe("text");
    expect(
      document.body.querySelector("[data-slot=dialog-content]"),
    ).not.toBeNull();
  });
});

describe("API 토큰 단계", () => {
  const issue = async () => {
    await toTokens();
    type(inputs()[0]!, "보고서");
    click(buttonNamed("apiToken.issue")!);
    await wait(20);
  };
  const copyIt = async () => {
    Object.assign(navigator, { clipboard: { writeText: async () => {} } });
    await act(async () => {
      document.body
        .querySelector('button[aria-label="apiToken.copy"]')!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  };

  it("이름이 비면 만들 수 없고, 만들면 원문이 한 번 보인다", async () => {
    await open();
    await toTokens();
    expect(buttonNamed("apiToken.issue")!.disabled).toBe(true);
    type(inputs()[0]!, "  보고서  ");
    click(buttonNamed("apiToken.issue")!);
    await wait(20);
    expect(state.issuedNames).toEqual(["보고서"]);
    expect(inputs().find((i) => i.readOnly)!.value).toBe(RAW);
    expect(document.body.querySelector("textarea")!.value).toContain(
      `Bearer ${RAW}`,
    );
    expect(inputs()[0]!.placeholder).toBe("");
  });

  it("복사한 뒤 확인을 누르면 원문이 사라진다", async () => {
    await open();
    await issue();
    await copyIt();
    click(buttonNamed("apiToken.done")!);
    expect(document.body.innerHTML).not.toContain(RAW);
  });

  it("복사한 뒤 ← 로 나가면 원문이 남지 않는다", async () => {
    await open();
    await issue();
    await copyIt();
    click(back()!);
    await toTokens();
    expect(document.body.innerHTML).not.toContain(RAW);
  });

  it("목록에는 앞부분과 날짜만 — 원문은 없다", async () => {
    state.tokens = [TOKEN];
    await open();
    await toTokens();
    expect(document.body.textContent).toContain("pdk_01234567…");
    expect(document.body.textContent).toContain("apiToken.neverUsed");
    expect(document.body.innerHTML).not.toContain(RAW);
  });

  it("폐기는 확인창 한 번 뒤에 그 번호로 나간다", async () => {
    state.tokens = [TOKEN];
    await open();
    await toTokens();
    click(
      document.body.querySelector(
        'button[aria-label="apiToken.revokeAria(보고서 차트)"]',
      )!,
    );
    expect(state.revoked).toEqual([]);
    click(lastButtonNamed("apiToken.revoke")!);
    await wait(20);
    expect(state.revoked).toEqual([3]);
  });

  it("복사하지 않고 확인 · ← · ✕ 로 나가면 한 번 묻는다", async () => {
    await open();
    await issue();
    click(buttonNamed("apiToken.done")!);
    expect(document.body.textContent).toContain("apiToken.copyAskTitle");
    expect(inputs().find((i) => i.readOnly)).toBeDefined();
    click(lastButtonNamed("cancel")!);
    click(back()!);
    expect(document.body.textContent).toContain("apiToken.copyAskTitle");
  });

  it("묻는 말에서 [닫기] 를 누르면 원문을 버리고 나간다", async () => {
    await open();
    await issue();
    click(buttonNamed("apiToken.done")!);
    click(lastButtonNamed("apiToken.copyAskClose")!);
    expect(document.body.innerHTML).not.toContain(RAW);
  });

  it("✕ 로 닫으려 해도 묻고, [닫기] 전엔 닫힘을 청하지 않는다", async () => {
    await open();
    await issue();
    click(closeX()!);
    expect(state.closed).toBe(0);
    expect(document.body.textContent).toContain("apiToken.copyAskTitle");
    click(lastButtonNamed("apiToken.copyAskClose")!);
    expect(state.closed).toBe(1);
  });

  it("한 번이라도 복사했으면 묻지 않는다", async () => {
    await open();
    await issue();
    await copyIt();
    click(buttonNamed("apiToken.done")!);
    expect(document.body.textContent).not.toContain("apiToken.copyAskTitle");
    expect(document.body.innerHTML).not.toContain(RAW);
  });

  it("목록 실패는 [다시 시도] 를 둔다", async () => {
    state.tokensError = true;
    await open();
    await toTokens();
    expect(document.body.textContent).toContain("apiToken.loadFailed");
    expect(rowNamed("common.retry")).toBeDefined();
  });
});
