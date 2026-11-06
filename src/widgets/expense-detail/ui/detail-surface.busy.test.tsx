// 거래 · 이체 상세 안 수정 · 환불 단계 — 저장 중에는 표면도 단계도 닫지 않는다(I-wrap-b2b 1).
// 예전 closeBlocked 는 호출처 onOpenChange 에서 막아 표면 안쪽은 이미 닫기로 진행했고, 한 단계 뒤(← · Esc · 기기 뒤로)는 막지 않았다 —
// 수정 단계를 떠나면 실패 Callout 을 그릴 폼이 없어졌다. 지금은 busy 가 표면(ds)과 단계 확인(useLeaveConfirm) 둘 다에 걸린다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "ko" } }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const { DetailSurface } = await import("./detail-surface");

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

const tick = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
const q = (sel: string) => document.querySelector<HTMLElement>(sel);
const surface = () =>
  q("[data-slot=bottom-sheet-content]") ?? q("[data-slot=dialog-content]");
const back = () =>
  act(() => {
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
const esc = () =>
  act(() => {
    surface()!.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
  });

function draw(o: {
  busy: boolean;
  failed?: boolean;
  onClose: () => void;
  onStepBack: () => void;
}) {
  act(() =>
    root.render(
      <DetailSurface
        title="거래 수정"
        bodyKey="edit"
        subStep
        dirty
        busy={o.busy}
        onClose={o.onClose}
        onStepBack={o.onStepBack}
        footer={{
          cancelLabel: "취소",
          primary: { label: "저장", loading: o.busy, onClick: () => {} },
        }}
      >
        {o.failed && <div role="alert">저장하지 못했어요.</div>}
        <input aria-label="메모" defaultValue="점심" />
      </DetailSurface>,
    ),
  );
}

describe("상세 안 수정 단계 — 저장 중", () => {
  it("시트: 기기 뒤로 · Esc · 머리 ← · 닫기 X 를 받지 않고 확인창도 띄우지 않는다 — 실패 Callout 이 남는다", async () => {
    wide = false;
    const onClose = vi.fn();
    const onStepBack = vi.fn();
    draw({ busy: true, onClose, onStepBack });
    await tick();
    back();
    esc();
    act(() => q("[data-slot=bottom-sheet-back]")!.click());
    act(() => q("[data-slot=bottom-sheet-close]")!.click());
    await tick();
    expect(onClose).not.toHaveBeenCalled();
    expect(onStepBack).not.toHaveBeenCalled();
    expect(q("[role=alertdialog]")).toBeNull();
    // 칸이 남아 있다 — 다음 뒤로 가기도 이 단계로 온다
    expect(window.history.state?.grooOverlayBack).toBe(true);
    draw({ busy: false, failed: true, onClose, onStepBack });
    await tick();
    expect(q("[role=alert]")?.textContent).toBe("저장하지 못했어요.");
  });

  it("시트: 저장이 끝난 뒤 닫기 X → 확인창 [나가기] 는 시트를 닫는다(예전에는 호출처에서 막혀 아무 일이 없었다)", async () => {
    wide = false;
    const onClose = vi.fn();
    draw({ busy: false, failed: true, onClose, onStepBack: () => {} });
    await tick();
    act(() => q("[data-slot=bottom-sheet-close]")!.click());
    await tick();
    const leave = [
      ...document.querySelectorAll<HTMLButtonElement>(
        "[role=alertdialog] button",
      ),
    ].find((b) => b.textContent === "나가기");
    act(() => leave!.click());
    await tick();
    expect(onClose).toHaveBeenCalled();
  });

  it("대화상자: 바닥 [취소] · Esc 로도 단계를 떠나지 않는다", async () => {
    wide = true;
    const onClose = vi.fn();
    const onStepBack = vi.fn();
    draw({ busy: true, onClose, onStepBack });
    await tick();
    const cancel = [
      ...document.querySelectorAll<HTMLButtonElement>("button"),
    ].find((b) => b.textContent === "취소")!;
    act(() => cancel.click());
    esc();
    await tick();
    expect(onClose).not.toHaveBeenCalled();
    expect(onStepBack).not.toHaveBeenCalled();
    expect(q("[role=alertdialog]")).toBeNull();
  });
});
