// 카드 지금 결제 — 저장(결제) 중에는 표면이 닫지 않는다(I-wrap-b2b 1). 예전에는 호출처 onOpenChange 에서 막아(close 가 isPending 이면 무시)
// 표면 안쪽은 이미 닫기로 진행했다: 시트의 뒤로 가기가 히스토리 칸을 써 버려 다음 뒤로 가기가 페이지를 떠났고,
// 바뀐 값이 있으면 확인창 [나가기] 를 눌러도 아무 일이 없었다. 지금은 ds busy 가 request() 앞에서 막는다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Asset } from "@/entities/asset";
import type { CardDetail } from "./use-card-detail";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "ko" } }),
  Trans: ({ i18nKey }: { i18nKey: string }) => <>{i18nKey}</>,
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const { CardOverlays } = await import("./CardOverlays");
const { SnackbarProvider } = await import("@/shared/ds/snackbar");

let container: HTMLDivElement;
let root: Root;
let wide = false;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.history.replaceState(null, "");
  window.matchMedia = ((query: string) => ({
    matches: wide && query.includes("1280px"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  document.body.removeAttribute("style");
  await new Promise((r) => setTimeout(r, 50));
});

const asset = { rowId: 1, isAmountHidden: "N" } as unknown as Asset;
const tick = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
const q = (sel: string) => document.querySelector<HTMLElement>(sel);
const back = () =>
  act(() => {
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

/** 결제 폼을 띄운다 — pending 이면 결제가 나가 있는 동안, payFailed 면 실패 뒤 */
function draw(o: {
  pending: boolean;
  payFailed?: boolean;
  payUnconfirmed?: boolean;
  payAmount?: string;
  setConfirmPay: (v: boolean) => void;
}) {
  const c = {
    confirmPay: true,
    payAmount: o.payAmount ?? "10000",
    payAmountNum: Number(o.payAmount ?? "10000"),
    upcoming: 10000,
    payAmountValid: true,
    payFailed: o.payFailed ?? false,
    payUnconfirmed: o.payUnconfirmed ?? false,
    payMoveNote: null,
    setPayAmount: () => {},
    setPayFailed: () => {},
    handlePay: () => {},
    setConfirmPay: o.setConfirmPay,
    payCard: { isPending: o.pending },
    st: null,
    billing: null,
    payoffTarget: null,
    confirmCancelPay: false,
    lastPayment: null,
    installmentPayoff: { isPending: false, mutateAsync: async () => {} },
    cancelPayment: { isPending: false, mutateAsync: async () => {} },
    setPayoffTarget: () => {},
    setConfirmCancelPay: () => {},
  } as unknown as CardDetail;
  act(() =>
    root.render(
      <SnackbarProvider>
        <CardOverlays asset={asset} c={c} />
      </SnackbarProvider>,
    ),
  );
}

describe("카드 지금 결제 — 결제 중에는 닫지 않는다", () => {
  it("시트: 결제 중 뒤로 가기는 닫지 않고 칸을 다시 쌓는다 — 실패 뒤 다음 뒤로 가기는 시트를 닫는다(페이지를 떠나지 않는다)", async () => {
    wide = false;
    const setConfirmPay = vi.fn();
    draw({ pending: true, setConfirmPay });
    await tick();
    back();
    await tick();
    expect(setConfirmPay).not.toHaveBeenCalled();
    // 실패 — Callout 이 폼 맨 위에, 값은 그대로
    draw({ pending: false, payFailed: true, setConfirmPay });
    await tick();
    expect(document.body.textContent).toContain("assetDetail.payFailed");
    back();
    await tick();
    expect(setConfirmPay).toHaveBeenLastCalledWith(false);
  });

  it("시트: 결제 중 닫기 X 는 아무 일 없고, 바뀐 값이 있어도 확인창이 뜨지 않는다 — 끝난 뒤 X → 확인창 [나가기] 는 닫는다", async () => {
    wide = false;
    const setConfirmPay = vi.fn();
    // 처음 값(10000)과 다르게 바꿔 놓은 채 결제 — dirty
    draw({ pending: false, setConfirmPay });
    draw({ pending: true, payAmount: "5000", setConfirmPay });
    await tick();
    act(() => q("[data-slot=bottom-sheet-close]")!.click());
    await tick();
    expect(setConfirmPay).not.toHaveBeenCalled();
    expect(q("[role=alertdialog]")).toBeNull();
    draw({
      pending: false,
      payFailed: true,
      payAmount: "5000",
      setConfirmPay,
    });
    await tick();
    act(() => q("[data-slot=bottom-sheet-close]")!.click());
    await tick();
    const leave = [
      ...document.querySelectorAll<HTMLButtonElement>(
        "[role=alertdialog] button",
      ),
    ].find((b) => b.textContent === "나가기");
    expect(leave).toBeDefined();
    act(() => leave!.click());
    await tick();
    // 예전에는 [나가기] 가 호출처 onOpenChange 에서 막혀 아무 일이 없었다
    expect(setConfirmPay).toHaveBeenLastCalledWith(false);
  });

  it("대화상자: 결제 중 바닥 [취소] · Esc 는 닫지 않는다", async () => {
    wide = true;
    const setConfirmPay = vi.fn();
    draw({ pending: true, setConfirmPay });
    await tick();
    const cancel = [
      ...document.querySelectorAll<HTMLButtonElement>("button"),
    ].find((b) => b.textContent === "cancel")!;
    act(() => cancel.click());
    act(() => {
      q("[data-slot=dialog-content]")!.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    await tick();
    expect(setConfirmPay).not.toHaveBeenCalled();
    expect(q("[data-slot=dialog-content]")).not.toBeNull();
  });

  it("결제 응답을 못 읽었으면(PARSE) '결제됐는지 확인하지 못했어요' — 결제 실패 글이 아니다, 폼은 연 채", async () => {
    wide = false;
    const setConfirmPay = vi.fn();
    draw({
      pending: false,
      payFailed: true,
      payUnconfirmed: true,
      setConfirmPay,
    });
    await tick();
    expect(document.body.textContent).toContain("query.payUnconfirmed");
    expect(document.body.textContent).not.toContain("assetDetail.payFailed");
    expect(setConfirmPay).not.toHaveBeenCalled();
  });
});
