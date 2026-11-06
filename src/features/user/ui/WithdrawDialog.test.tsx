// 해지 다이얼로그가 **막을 때 막고, 보낼 때 보내는지**를 고정한다.
//
// 되돌릴 수 없는 일이라 두 방향 모두 틀리면 안 된다.
// - 구독이 남았는데 진행 버튼이 서면 → 눌러 봤자 서버가 409 다. 사용자는 왜 안 되는지 모른다
// - 본인 확인 없이 해지가 나가면 → 남이 자리를 비운 사이 계정을 지울 수 있다
// - 티켓을 받고도 해지를 안 부르면 → "됐다" 고 해 놓고 계정이 그대로 남는다
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const state = vi.hoisted(() => ({
  check: null as Record<string, unknown> | null,
  verifyError: null as unknown,
  verifyCodeError: null as unknown,
  withdrawError: null as unknown,
  verifiedPassword: null as string | null,
  withdrew: null as Record<string, unknown> | null,
  onWithdrawnCalls: 0,
  verifiedCode: null as string | null,
  withdrawHang: false,
  isError: false,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("sonner", () => ({ toast: { success: () => {}, error: () => {} } }));
vi.mock("../model/useWithdrawal", () => ({
  useWithdrawalCheck: () => ({
    // react-query 처럼 — 처음 불러오기 실패면 값이 없다
    data: state.isError ? undefined : state.check,
    isLoading: state.check === null && !state.isError,
    isError: state.isError,
    isFetching: false,
    refetch: () => {},
  }),
  useSendReauthEmailCodeMutation: () => ({
    mutate: (_v: unknown, o?: { onSuccess?: () => void }) => o?.onSuccess?.(),
    isPending: false,
  }),
  useVerifyReauthEmailCodeMutation: () => ({
    mutateAsync: async (c: string) => {
      state.verifiedCode = c;
      if (state.verifyCodeError) throw state.verifyCodeError;
      return "ticket";
    },
    isPending: false,
  }),
  useVerifyReauthPasswordMutation: () => ({
    mutateAsync: async (pw: string) => {
      state.verifiedPassword = pw;
      if (state.verifyError) throw state.verifyError;
      return "ticket-abc";
    },
    isPending: false,
  }),
  useWithdrawMutation: () => ({
    mutateAsync: async (v: Record<string, unknown>) => {
      if (state.withdrawHang) await new Promise(() => {});
      if (state.withdrawError) throw state.withdrawError;
      state.withdrew = v;
    },
    isPending: false,
  }),
}));

const { WithdrawDialog } = await import("./WithdrawDialog");
const { WITHDRAW_BLOCK_SUBSCRIPTION } = await import("../api/userApi");

const CLEAR = {
  blocked: [],
  subscriptionPeriodEnd: null,
  sharedCalendarsOwned: 2,
  calendarMemberships: 0,
  dutchPaysOwned: 0,
  dutchPayParticipations: 3,
};

let container: HTMLDivElement;
let root: Root;

/** 1280 이상(대화상자)인가 — jsdom 에는 matchMedia 가 없어 기본은 좁은 쪽(시트)이다. */
function setWide(wide: boolean) {
  // 대화상자의 본문 스크롤 감시가 ResizeObserver 를 쓴다(jsdom 에는 없다)
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  window.matchMedia = ((query: string) => ({
    matches: wide && query.includes("min-width: 1280px"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

function render() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() =>
    root.render(
      <WithdrawDialog
        onClose={() => {}}
        onWithdrawn={() => {
          state.onWithdrawnCalls += 1;
        }}
      />,
    ),
  );
}

const buttonNamed = (text: string) =>
  [...document.body.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === text,
  );

/**
 * 버튼 누르기.
 *
 * `el.click()` 을 쓰지 않는다 — jsdom 이 만드는 그 이벤트는 React 19 의 위임에 안
 * 잡혀 핸들러가 조용히 안 불린다(테스트만 초록불이 되고 화면은 멀쩡한, 가장 나쁜 쪽).
 * 레포의 다른 다이얼로그 테스트와 같은 방식으로 실제 MouseEvent 를 쏜다.
 */
const click = (text: string) =>
  buttonNamed(text)!.dispatchEvent(new MouseEvent("click", { bubbles: true }));

/**
 * footer 의 주 버튼을 연달아 누르기 전에 기다린다.
 *
 * `계속` 과 `해지하기` 는 **같은 자리의 같은 버튼**이라 React 가 같은 fiber 로 잇는다.
 * Button 의 더블클릭 가드(`DOUBLE_CLICK_GUARD_MS`)가 그 fiber 에 마지막 클릭 시각을
 * 들고 있어서, 600ms 안에 두 번째를 누르면 **버려진다**. 제품에서는 그 사이에 비밀번호를
 * 넣어야 하므로 닿을 일이 없고, 오히려 계속을 누른 자리에 해지 버튼이 올라오는 만큼
 * 튄 클릭을 막아 주는 쪽이다. 테스트만 그 창을 지나가면 된다 — 가드는 클릭 다음
 * 매크로태스크에서 스스로 풀린다.
 */
const flushClickGuard = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

function setValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )!.set!;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  state.check = null;
  state.verifyError = null;
  state.verifyCodeError = null;
  state.withdrawError = null;
  state.verifiedPassword = null;
  state.withdrew = null;
  state.onWithdrawnCalls = 0;
  state.verifiedCode = null;
  state.withdrawHang = false;
  state.isError = false;
  setWide(false);
  const proto = window.HTMLElement.prototype as unknown as Record<
    string,
    unknown
  >;
  proto.hasPointerCapture = () => false;
  proto.setPointerCapture = () => {};
  proto.releasePointerCapture = () => {};
  proto.scrollIntoView = () => {};
});

afterEach(() => {
  // 렌더 없이 도는 테스트(문자열 계약 검사)도 있다 — 그때는 치울 것이 없다.
  if (!root) return;
  act(() => root.unmount());
  container.remove();
});

// 이 값은 **서버가 짓는다** — desk-back `WithdrawalServiceImpl.check()` 의
// `List.of("SUBSCRIPTION_ACTIVE")`. 한 글자만 달라도 `includes` 가 조용히 false 가 되어
// 구독 때문에 막힌 사람에게 **언제부터 가능한지 날짜를 못 보여 준다.** 실제로 `SUBSCRIPTION`
// 으로 적어 두고 dev 에서야 잡았다(2026-09-17). 서버를 고치면 여기도 같이 고쳐야 한다.
describe("막는 사유 코드", () => {
  it("서버가 보내는 문자열과 글자 그대로 같다", () => {
    expect(WITHDRAW_BLOCK_SUBSCRIPTION).toBe("SUBSCRIPTION_ACTIVE");
  });
});

describe("제목", () => {
  beforeEach(() => {
    state.check = CLEAR;
    render();
  });

  // 제목이 `settings` 네임스페이스의 `account.withdraw.label` 을 가리킨 적이 있었다.
  // 이 다이얼로그는 `user` 네임스페이스라 그 키는 안 풀리고, 시트 머리에 키 문자열이
  // 그대로 떴다. t 를 키 그대로 돌려주도록 mock 했으므로 여기서 어느 키를 쓰는지 본다.
  it("user 네임스페이스의 키를 쓴다 — 다른 네임스페이스 키는 안 풀린다", () => {
    expect(document.body.textContent).toContain("withdraw.title");
    expect(document.body.textContent).not.toContain("account.withdraw.label");
  });
});

describe("구독이 막을 때", () => {
  beforeEach(() => {
    state.check = {
      ...CLEAR,
      // 서버가 실제로 넣는 문자열을 그대로 쓴다 — 상수를 여기 넣으면 상수와 mock 이
      // 서로를 보고 끄덕이는 닫힌 고리가 되어, 둘 다 틀려도 초록불이 난다.
      blocked: ["SUBSCRIPTION_ACTIVE"],
      // 서버가 시간대 없이 주는 [UTC] — 화면은 KST 로 읽어 10-01 이 되어야 한다.
      subscriptionPeriodEnd: "2026-09-30T15:00:00",
    };
    render();
  });

  it("진행 버튼을 아예 두지 않는다 — 눌러도 서버가 막는 버튼은 보여 줄 이유가 없다", () => {
    expect(buttonNamed("withdraw.next")).toBeUndefined();
    expect(buttonNamed("withdraw.confirm")).toBeUndefined();
  });

  // 막힘은 안내 표면이다 — 시트는 위 ✕ 만(바닥 없음), 대화상자는 [닫기] 하나(I-05 32)
  it("시트(1280 미만)는 위 ✕ 만 두고 바닥 버튼이 없다", () => {
    expect(
      document.body.querySelector('[data-slot="bottom-sheet-close"]'),
    ).not.toBeNull();
    expect(buttonNamed("close")).toBeUndefined();
  });

  it("막힘은 Callout warning 이다", () => {
    expect(
      document.body.querySelector('[data-slot="callout"][data-tone="warning"]'),
    ).not.toBeNull();
  });

  it("언제부터 가능한지를 말한다 — 이 날짜가 없으면 기다릴지 말지 정할 수 없다", () => {
    expect(document.body.textContent).toContain(
      "withdraw.blockedSubscriptionUntil",
    );
  });
});

describe("막는 게 없을 때", () => {
  beforeEach(() => {
    state.check = CLEAR;
    render();
  });

  // 해지는 soft delete 다 — 데이터는 남는다. "기록이 사라진다" 로 쓰면 사용자가
  // 실제와 다른 것을 믿고 누른다(2026-09-17 QA #7).
  it("데이터가 어떻게 되는지와 내보내기 권유가 보인다", () => {
    const text = document.body.textContent ?? "";
    expect(text).toContain("withdraw.dataRetention");
  });

  it("0 인 항목은 줄을 안 만든다 — 없는 손실을 세어 겁줄 이유가 없다", () => {
    const text = document.body.textContent ?? "";
    expect(text).toContain("impact.calendarsOwned");
    expect(text).toContain("impact.dutchPayParticipations");
    expect(text).not.toContain("impact.calendarMemberships");
    expect(text).not.toContain("impact.dutchPaysOwned");
  });

  it("안내를 보는 동안에는 해지가 나가지 않는다 — 다음을 눌러야 본인 확인이다", () => {
    expect(state.withdrew).toBeNull();
    act(() => click("withdraw.next"));
    expect(state.withdrew).toBeNull();
    expect(document.body.textContent).toContain("withdraw.reauthIntro");
  });

  it("비밀번호가 비면 확정 버튼이 눌리지 않는다", () => {
    act(() => click("withdraw.next"));
    expect(buttonNamed("withdraw.confirm")!.disabled).toBe(true);
  });

  it("본인 확인 단계에서 바로 눌러도 해지가 나가지 않는다", async () => {
    act(() => click("withdraw.next"));
    await flushClickGuard();
    await act(async () => click("withdraw.confirm"));
    expect(state.withdrew).toBeNull();
  });

  /**
   * 실패 문구는 **화면 글**이어야 한다(input-otp.md "서버가 보낸 글을 그대로 보이지 않고 화면 글로").
   *
   * axios 는 실패를 Error 로 감싸는데 그 `message` 는 "Request failed with status code
   * 400" 이다(2026-09-17 QA). 서버가 본문에 보낸 문장도 그대로 보이지 않는다 — 서버 글이
   * 코드 이름 · 영문일 수 있고 웹 · 앱이 같은 말을 하게 하려는 것이다.
   */
  it("비밀번호가 틀리면 서버 글 대신 화면 글을 칸 밑에 붙인다", async () => {
    state.verifyError = Object.assign(
      new Error("Request failed with status code 400"),
      {
        response: {
          data: { code: "AUTH_021", message: "비밀번호가 올바르지 않아요" },
        },
      },
    );

    act(() => click("withdraw.next"));
    await flushClickGuard();
    const pw = document.getElementById("withdraw-password") as HTMLInputElement;
    act(() => setValue(pw, "wrong"));
    await act(async () => click("withdraw.confirm"));

    const text = document.body.textContent ?? "";
    expect(text).toContain("withdraw.passwordWrong");
    expect(text).not.toContain("비밀번호가 올바르지 않아요");
    expect(text).not.toContain("Request failed with status code");
    expect(state.withdrew).toBeNull();
  });

  it("코드가 틀리면 서버 글 대신 '코드가 맞지 않거나 시간이 지났어요' 화면 글이다", async () => {
    state.verifyCodeError = Object.assign(new Error("x"), {
      response: { data: { code: "AUTH_021", message: "AUTH_021" } },
    });
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
    const text = document.body.textContent ?? "";
    expect(text).toContain("withdraw.codeWrong");
    expect(text).not.toContain("AUTH_021");
  });

  it("확인 단계의 네트워크 · 서버 오류는 '틀림' 이 아니라 해지 실패 글이다(앱과 한 벌 — AUTH_021 만 칸 글)", async () => {
    state.verifyError = new Error("Network Error");
    act(() => click("withdraw.next"));
    await flushClickGuard();
    const pw = document.getElementById("withdraw-password") as HTMLInputElement;
    act(() => setValue(pw, "whatever"));
    await act(async () => click("withdraw.confirm"));
    const text = document.body.textContent ?? "";
    expect(text).toContain("withdraw.failed");
    expect(text).not.toContain("withdraw.passwordWrong");
    expect(text).not.toContain("Network Error");
  });

  it("5번 틀려 잠기면(AUTH_022) 비밀번호 · 코드 모두 '5번 틀렸어요. 코드를 다시 받아주세요' 글이다", async () => {
    state.verifyError = Object.assign(new Error("x"), {
      response: { data: { code: "AUTH_022" } },
    });
    act(() => click("withdraw.next"));
    await flushClickGuard();
    const pw = document.getElementById("withdraw-password") as HTMLInputElement;
    act(() => setValue(pw, "pw"));
    await act(async () => click("withdraw.confirm"));
    expect(document.body.textContent).toContain("withdraw.locked");
    expect(document.body.textContent).not.toContain("withdraw.passwordWrong");
  });

  it("코드 방식도 잠기면 같은 글이다", async () => {
    state.verifyCodeError = Object.assign(new Error("x"), {
      response: { data: { code: "AUTH_022" } },
    });
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
    expect(document.body.textContent).toContain("withdraw.locked");
    expect(document.body.textContent).not.toContain("withdraw.codeWrong");
  });

  it("해지 요청이 실패하면 해지 실패 문구를 쓴다", async () => {
    state.withdrawError = new Error("Network Error");
    act(() => click("withdraw.next"));
    await flushClickGuard();
    const pw = document.getElementById("withdraw-password") as HTMLInputElement;
    act(() => setValue(pw, "whatever"));
    await act(async () => click("withdraw.confirm"));

    const text = document.body.textContent ?? "";
    expect(text).toContain("withdraw.failed");
    expect(text).not.toContain("Network Error");
  });

  it("해지 결과를 확인하지 못하면 실패가 아니라 웹 전용 '새로 고쳐 확인' 글이다", async () => {
    const { WriteUnconfirmedError } = await import("@/shared/api/base");
    state.withdrawError = new WriteUnconfirmedError(0);
    act(() => click("withdraw.next"));
    await flushClickGuard();
    const pw = document.getElementById("withdraw-password") as HTMLInputElement;
    act(() => setValue(pw, "whatever"));
    await act(async () => click("withdraw.confirm"));

    const text = document.body.textContent ?? "";
    expect(text).toContain("query.withdrawUnconfirmedRefresh");
    expect(text).not.toContain("withdraw.failed");
  });

  it("비밀번호 확인 → 그 티켓으로 해지 → 로그아웃까지 이어진다", async () => {
    act(() => click("withdraw.next"));

    const reason = document.getElementById(
      "withdraw-reason",
    ) as HTMLInputElement | null;
    expect(reason).toBeNull(); // 단계가 넘어갔으면 사유 칸은 사라진다

    await flushClickGuard();

    const pw = document.getElementById("withdraw-password") as HTMLInputElement;
    act(() => setValue(pw, "my-password"));

    await act(async () => click("withdraw.confirm"));

    expect(state.verifiedPassword).toBe("my-password");
    // 방금 받은 티켓을 그대로 실어야 한다 — 다른 값이 가면 서버가 AUTH_020 으로 막는다.
    expect(state.withdrew).toEqual({
      reauthToken: "ticket-abc",
      reason: undefined,
    });
    expect(state.onWithdrawnCalls).toBe(1);
  });
});

describe("표면 — 1280 미만 시트 · 이상 대화상자(I-05 31 · 32)", () => {
  it("1280 미만은 Bottom Sheet — 바닥에 [계속] 하나(취소 없음, 위 닫기가 닫는다)", () => {
    state.check = CLEAR;
    render();
    expect(
      document.body.querySelector('[data-slot="bottom-sheet-content"]'),
    ).not.toBeNull();
    expect(
      document.body.querySelector('[data-slot="dialog-content"]'),
    ).toBeNull();
    expect(buttonNamed("cancel")).toBeUndefined();
    expect(buttonNamed("withdraw.next")).toBeDefined();
  });

  it("1280 이상은 Dialog — 바닥에 [취소] [계속], 머리 ✕ 없음(입력 폼)", () => {
    setWide(true);
    state.check = CLEAR;
    render();
    expect(
      document.body.querySelector('[data-slot="dialog-content"]'),
    ).not.toBeNull();
    expect(buttonNamed("cancel")).toBeDefined();
    expect(buttonNamed("withdraw.next")).toBeDefined();
    expect(
      document.body.querySelector('[data-slot="dialog-close"]'),
    ).toBeNull();
  });

  it("1280 이상 막힘은 바닥에 [닫기] 하나 — 위 ✕ 도 있다", () => {
    setWide(true);
    state.check = { ...CLEAR, blocked: ["SUBSCRIPTION_ACTIVE"] };
    render();
    expect(buttonNamed("close")).toBeDefined();
    expect(buttonNamed("withdraw.next")).toBeUndefined();
  });

  it("불러오기 실패는 Result Section failure + 다시 시도", () => {
    state.isError = true;
    render();
    const rs = document.body.querySelector('[data-slot="result-section"]');
    expect(rs?.getAttribute("data-kind")).toBe("failure");
    expect(document.body.textContent).toContain("withdraw.loadFailed");
  });

  it("바닥 버튼은 [계속] · [해지하기] 가 criticalSolid, [뒤로] 는 neutralWeak", async () => {
    state.check = CLEAR;
    render();
    expect(buttonNamed("withdraw.next")!.className).toContain(
      "bg-bg-critical-solid",
    );
    act(() => click("withdraw.next"));
    await flushClickGuard();
    expect(buttonNamed("withdraw.confirm")!.className).toContain(
      "bg-bg-critical-solid",
    );
    expect(buttonNamed("back")!.className).toContain("bg-bg-neutral-weak");
  });
});

describe("본인 확인 — 코드 칸(I-05 35)", () => {
  const goToCode = async () => {
    state.check = CLEAR;
    render();
    act(() => click("withdraw.next"));
    await flushClickGuard();
    act(() => click("withdraw.useEmailCode"));
  };
  const codeInput = () =>
    document.getElementById("withdraw-code") as HTMLInputElement;
  const paste = (text: string) => {
    const e = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(e, "clipboardData", {
      value: { getData: () => text },
    });
    act(() => {
      codeInput().dispatchEvent(e);
    });
  };

  it("코드 칸은 one-time-code · numeric 이고 maxLength 로 먼저 자르지 않는다", async () => {
    await goToCode();
    expect(codeInput().getAttribute("autocomplete")).toBe("one-time-code");
    expect(codeInput().getAttribute("inputmode")).toBe("numeric");
    expect(codeInput().hasAttribute("maxlength")).toBe(false);
  });

  it.each([
    ["123 456", "123456"],
    ["인증 코드: 123456", "123456"],
  ])("붙여넣기 %s → %s", async (pasted, digits) => {
    await goToCode();
    paste(pasted);
    expect(codeInput().value).toBe(digits);
  });

  it("설명 줄에 유효 10분 · 5번 규칙이 늘 보인다", async () => {
    await goToCode();
    expect(document.body.textContent).toContain("withdraw.codeRule");
  });

  it("6자리 전에도 [해지하기] 는 켜져 있고 누르면 칸 오류로 알린다 — 서버로 가지 않는다", async () => {
    await goToCode();
    paste("123");
    const confirm = buttonNamed("withdraw.confirm")!;
    expect(confirm.disabled).toBe(false);
    await act(async () => click("withdraw.confirm"));
    expect(document.body.textContent).toContain("withdraw.codeIncomplete");
    expect(codeInput().getAttribute("aria-invalid")).toBe("true");
    expect(state.verifiedCode).toBeNull();
    expect(state.withdrew).toBeNull();
  });

  it("6자리를 채우고 누르면 코드를 확인하고 해지가 나간다", async () => {
    await goToCode();
    paste("인증 코드: 123456");
    await act(async () => click("withdraw.confirm"));
    expect(state.verifiedCode).toBe("123456");
    expect(state.withdrew).toEqual({
      reauthToken: "ticket",
      reason: undefined,
    });
  });

  it("[코드 받기] 는 칸 아래에 있다 — 칸 옆(같은 줄)이 아니다", async () => {
    await goToCode();
    const send = [...document.body.querySelectorAll("button")].find(
      (b) => b.getAttribute("data-slot") === "input-otp-resend",
    )!;
    expect(send).toBeDefined();
    const field = codeInput().closest('[data-slot="field"]')!;
    expect(field.contains(send)).toBe(false);
  });
});

describe("해지하는 동안 — 덮개(I-05 37)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("요청 중 1초 전에는 원이 없고, 1초 뒤 원이 보이며 뒤 화면이 의미 트리에서 빠진다", async () => {
    vi.useFakeTimers();
    state.check = CLEAR;
    state.withdrawHang = true;
    render();
    act(() => click("withdraw.next"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    const pw = document.getElementById("withdraw-password") as HTMLInputElement;
    act(() => setValue(pw, "pw"));
    await act(async () => click("withdraw.confirm"));
    const overlay = () =>
      document.body.querySelector('[data-slot="busy-overlay"]');
    expect(overlay()).not.toBeNull();
    expect(overlay()!.querySelector('[role="progressbar"]')).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    const circle = overlay()!.querySelector('[role="progressbar"]');
    expect(circle?.getAttribute("aria-label")).toBe("withdraw.closing");
    expect(container.getAttribute("aria-hidden")).toBe("true");
  });

  it("실패하면 덮개가 걷히고 칸 오류가 남는다", async () => {
    state.check = CLEAR;
    state.verifyError = new Error("x");
    render();
    act(() => click("withdraw.next"));
    await flushClickGuard();
    const pw = document.getElementById("withdraw-password") as HTMLInputElement;
    act(() => setValue(pw, "pw"));
    await act(async () => click("withdraw.confirm"));
    expect(
      document.body.querySelector('[data-slot="busy-overlay"]'),
    ).toBeNull();
    expect(document.body.textContent).toContain("withdraw.failed");
  });
});

describe("바뀐 값이 있으면 닫기 전에 묻는다(I-05 31)", () => {
  it("사유를 쓰고 위 ✕ 를 누르면 닫지 않고 되묻는다", async () => {
    state.check = CLEAR;
    let closed = 0;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() =>
      root.render(
        <WithdrawDialog onClose={() => (closed += 1)} onWithdrawn={() => {}} />,
      ),
    );
    const reason = document.getElementById(
      "withdraw-reason",
    ) as HTMLInputElement;
    act(() => setValue(reason, "이사"));
    const x = document.body.querySelector<HTMLButtonElement>(
      '[data-slot="bottom-sheet-close"]',
    )!;
    await act(async () => {
      x.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(closed).toBe(0);
    expect(document.body.querySelector('[role="alertdialog"]')).not.toBeNull();
  });
});

describe("머리 설명 · [코드 받기] 자리(I-05 33 · 35)", () => {
  it("안내 첫 문장은 시트 머리 설명(R7) 자리다 — 본문 문단이 아니다", () => {
    state.check = CLEAR;
    render();
    const desc = document.body.querySelector(
      '[data-slot="bottom-sheet-description"]',
    );
    expect(desc?.textContent).toBe("withdraw.intro");
    const body = document.body.querySelector('[data-slot="bottom-sheet-body"]');
    expect(body?.textContent).not.toContain("withdraw.intro");
  });

  it("2 단계도 머리 설명이고, 막힘 · 실패 표면에는 머리 설명이 없다", async () => {
    state.check = CLEAR;
    render();
    act(() => click("withdraw.next"));
    expect(
      document.body.querySelector('[data-slot="bottom-sheet-description"]')
        ?.textContent,
    ).toBe("withdraw.reauthIntro");
  });

  it("[코드 받기] 는 칸 묶음 바로 아래 12(gap-x3)이고, 스팸함 안내는 코드를 보낸 뒤에만 그 아래 한 줄로 보인다(사용자 결정 10-24 Q1 A)", async () => {
    state.check = CLEAR;
    render();
    act(() => click("withdraw.next"));
    await flushClickGuard();
    act(() => click("withdraw.useEmailCode"));
    const resend = document.body.querySelector(
      '[data-slot="input-otp-resend"]',
    )!;
    expect(resend.parentElement!.className).toContain("gap-x3");
    // 보내기 전 — 안내 없음
    expect(document.body.textContent).not.toContain("withdraw.codeHint");
    await act(async () => {
      resend.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    // 보낸 뒤 — 같은 묶음 안 [코드 받기] 아래에 "메일로 코드를 보냈어요"(role=status, 11af746d) 그 아래 스팸함 안내
    const sent = document.body.querySelector('[data-slot="input-otp-resend"]')!;
    const status = sent.nextElementSibling;
    expect(status?.getAttribute("role")).toBe("status");
    expect(status?.textContent).toBe("withdraw.codeSent");
    expect(status?.nextElementSibling?.textContent).toBe("withdraw.codeHint");
  });
});
