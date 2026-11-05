// 거래를 지우거나·환불하거나·고치거나·고쳐 쓴 **뒤**의 토스트(D4 · D9).
//
// 잠그는 것 셋이다.
//   1) 열린 회차에서 미리 낸 돈이 돌아왔으면(`refundedAmount > 0`) 그 금액을 **단위까지**
//      말한다 — 미리보기로 예고하던 자리를 걷고 사후 토스트 하나만 남겼다. 단위 없이
//      "8,000이" 로 나가던 게 23·24차에 두 번 집혔다.
//   2) 결제가 끝난 회차의 거래였고 결제계좌가 있으면 [잔액 고치기]를 달고, 누르면 그
//      결제계좌의 수정 폼 주소로 간다. 결제계좌가 없으면 고칠 통장이 없어 버튼도 없다.
//   3) 둘 다 아니면 아무 말도 안 한다 — 평범한 저장·삭제마다 스낵바가 뜨면 소음이다.
// 띄우는 곳은 ds 스낵바다(28-5 가계부 A) — 톤은 늘 neutral(기본), 액션이 있으면 시간은 ds 가 6초로 잡는다.
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const st = vi.hoisted(() => ({
  toasts: [] as {
    message: string;
    tone?: string;
    action?: { label: string; onClick: () => void };
  }[],
  navigated: [] as string[],
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    // 값이 있으면 키 뒤에 붙인다 — 어떤 금액 문자열이 들어갔는지 본다.
    t: (k: string, o?: Record<string, unknown>) =>
      o?.amount != null ? `${k}|${String(o.amount)}` : k,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("react-router-dom", () => ({
  useNavigate: () => (to: string) => st.navigated.push(to),
}));
vi.mock("@/shared/ds/snackbar", () => ({
  useSnackbar: () => ({
    show: (o: (typeof st.toasts)[number]) => st.toasts.push(o),
    dismiss: () => {},
  }),
}));

const { useLedgerResultToast } = await import("./useLedgerResultToast");
const { money } = await import("@/shared/lib/groo/format");

let notify: ReturnType<typeof useLedgerResultToast> | null = null;
function Probe() {
  const fn = useLedgerResultToast();
  // 렌더 중에 바깥 변수를 건드리지 않는다 — effect 로 옮긴다(`act` 가 flush 한다).
  useEffect(() => {
    notify = fn;
  });
  return null;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  st.toasts = [];
  st.navigated = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Probe />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("미리 낸 돈이 돌아왔을 때(D4)", () => {
  it("금액을 단위까지 말한다", () => {
    notify!({ refundedAmount: 30_000 });

    expect(st.toasts).toHaveLength(1);
    // 통화 표기는 로케일을 따른다(ko `30,000원` · en `₩30,000`) — 숫자만 나가면 안 된다.
    expect(st.toasts[0]!.message).toBe(
      `closedCycle.prepaidRefunded|${money(30_000)}`,
    );
    expect(money(30_000)).toMatch(/원|₩/);
    // neutral(톤 생략) — 이정표가 아니다. 열린 회차의 환급이라 고칠 잔액이 없다 — 버튼 없음.
    expect(st.toasts[0]!.tone).toBeUndefined();
    expect(st.toasts[0]!.action).toBeUndefined();
  });

  it("0 이나 없음이면 말하지 않는다", () => {
    notify!({ refundedAmount: 0 });
    notify!({ refundedAmount: null });
    notify!(null);
    notify!(undefined);

    expect(st.toasts).toEqual([]);
  });
});

describe("결제가 끝난 회차의 거래였을 때(D9)", () => {
  it("통장은 그대로라고 말하고 [잔액 고치기]가 결제계좌 수정 폼으로 간다", () => {
    notify!({ refundedAmount: null }, { closed: true, paymentAssetRowId: 3 });

    expect(st.toasts).toHaveLength(1);
    const { message, action } = st.toasts[0]!;
    expect(message).toBe("closedCycle.noteToast");
    // 통장이 그대로라는 안내다 — neutral. 액션이 있으면 ds 가 6초 둔다.
    expect(st.toasts[0]!.tone).toBeUndefined();
    expect(action?.label).toBe("closedCycle.fixBalance");

    action!.onClick();
    expect(st.navigated).toEqual(["/desk/settings?section=accounts&edit=3"]);
  });

  it("결제계좌가 없는 카드는 고칠 통장이 없다 — 토스트도 없다", () => {
    notify!(
      { refundedAmount: null },
      { closed: true, paymentAssetRowId: null },
    );

    expect(st.toasts).toEqual([]);
  });

  it("열린 회차 거래에는 버튼이 없다", () => {
    notify!({ refundedAmount: null }, { closed: false, paymentAssetRowId: 3 });

    expect(st.toasts).toEqual([]);
  });

  it("환급과 겹치면 금액을 말하고 버튼은 그대로 단다(할부가 걸친 거래)", () => {
    notify!({ refundedAmount: 20_000 }, { closed: true, paymentAssetRowId: 3 });

    expect(st.toasts).toHaveLength(1);
    expect(st.toasts[0]!.message).toBe(
      `closedCycle.prepaidRefunded|${money(20_000)}`,
    );
    expect(st.toasts[0]!.action?.label).toBe("closedCycle.fixBalance");
    expect(st.toasts[0]!.tone).toBeUndefined();
  });
});
