// 새로 고침 · 탭 닫기 확인(I-wrap-b2b 판단 (3)) — 폼이 바뀐 값을 가졌거나 저장 중인 동안에만 beforeunload 를 건다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

describe("401 → 로그인 이동은 묻지 않는다(검수 3차 M3)", () => {
  it("저장 중 401 이면 beforeunload 확인을 끄고 이동한다 — 이동이 취소돼 남으면 표식을 되돌리고 다음 401 도 로그인으로 보낸다", async () => {
    const { apiClient, LOGIN_REDIRECT_SETTLE_MS } =
      await import("@/shared/api/base");
    const { AxiosError } = await import("axios");
    const original = apiClient.defaults.adapter;
    apiClient.defaults.adapter = async (config) => {
      throw new AxiosError(
        "401",
        "ERR_BAD_REQUEST",
        config as never,
        {},
        {
          status: 401,
          statusText: "",
          data: {},
          headers: {},
          config: config as never,
        },
      );
    };
    // jsdom 은 주소 이동을 하지 않는다 — 이동이 취소돼 페이지에 남은 경우와 같다
    const hrefSets: string[] = [];
    const loc = window.location;
    const fake = { ...loc, assign: () => {} } as unknown as Location;
    Object.defineProperty(fake, "href", {
      get: () => loc.href,
      set: (v: string) => void hrefSets.push(v),
    });
    const spy = vi.spyOn(window, "location", "get").mockReturnValue(fake);
    vi.useFakeTimers();
    try {
      act(() => root.render(<Form dirty={false} busy />));
      expect(asks()).toBe(true);
      await apiClient.post("/v1/memo", {}).catch(() => undefined);
      expect(hrefSets).toEqual(["/login?expired=1"]);
      // 이동 중에는 묻지 않는다 — 물으면 [취소] 로 갇힌다
      expect(asks()).toBe(false);
      vi.advanceTimersByTime(LOGIN_REDIRECT_SETTLE_MS);
      // 이동이 안 됐으면 되돌린다 — 다시 묻고, 다음 401 이 다시 로그인으로 보낸다
      expect(asks()).toBe(true);
      await apiClient.post("/v1/memo", {}).catch(() => undefined);
      expect(hrefSets).toEqual(["/login?expired=1", "/login?expired=1"]);
      vi.advanceTimersByTime(LOGIN_REDIRECT_SETTLE_MS);
    } finally {
      vi.useRealTimers();
      spy.mockRestore();
      apiClient.defaults.adapter = original;
    }
  });
});
