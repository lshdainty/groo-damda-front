// 새로 고침 · 탭 닫기 확인(I-wrap-b2b 판단 (3)) — 폼이 바뀐 값을 가졌거나 저장 중인 동안에만 beforeunload 를 건다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
} from "@/shared/ds/dialog";
import { useRegisterLeaveGuard } from "@/shared/ui/groo/leave-guard-context";
import { useBeforeUnloadWhile } from "./before-unload";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  window.history.replaceState(null, "");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  document.body.removeAttribute("style");
  await new Promise((r) => setTimeout(r, 30));
});

/** 브라우저가 묻는가 — beforeunload 를 쏴 막혔는지 본다 */
const asks = () => {
  const e = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(e);
  return e.defaultPrevented;
};

function Form({ dirty, busy }: { dirty: boolean; busy: boolean }) {
  return (
    <ResponsiveDialog open form dirty={dirty} busy={busy}>
      <ResponsiveDialogContent title="메모">
        <ResponsiveDialogBody>본문</ResponsiveDialogBody>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

describe("beforeunload — dirty 거나 busy 인 동안만", () => {
  it("폼에 바뀐 값이 있으면 건다, 없애면 거둔다", () => {
    act(() => root.render(<Form dirty busy={false} />));
    expect(asks()).toBe(true);
    act(() => root.render(<Form dirty={false} busy={false} />));
    expect(asks()).toBe(false);
  });

  it("저장 중이면(busy) 바뀐 값이 없어도 건다", () => {
    act(() => root.render(<Form dirty={false} busy />));
    expect(asks()).toBe(true);
  });

  it("폼이 닫히면(내려가면) 거둔다", () => {
    act(() => root.render(<Form dirty busy={false} />));
    act(() => root.render(<p>없음</p>));
    expect(asks()).toBe(false);
  });

  it("셸 떠나기 가드가 맡겨진 동안(금액 가리기 dirty) 건다 — 같은 상태를 쓴다", () => {
    function Guarded({ on }: { on: boolean }) {
      useRegisterLeaveGuard(on ? () => {} : null);
      return null;
    }
    act(() => root.render(<Guarded on />));
    expect(asks()).toBe(true);
    act(() => root.render(<Guarded on={false} />));
    expect(asks()).toBe(false);
  });

  it("여러 자리가 함께 켜도 하나가 꺼지면 나머지는 남는다", () => {
    function Two({ a, b }: { a: boolean; b: boolean }) {
      useBeforeUnloadWhile(a);
      useBeforeUnloadWhile(b);
      return null;
    }
    act(() => root.render(<Two a b />));
    act(() => root.render(<Two a={false} b />));
    expect(asks()).toBe(true);
    act(() => root.render(<Two a={false} b={false} />));
    expect(asks()).toBe(false);
  });
});
