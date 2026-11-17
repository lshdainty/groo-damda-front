import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import {
  Route,
  Routes,
  unstable_HistoryRouter as HistoryRouter,
} from "react-router-dom";

import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
} from "@/shared/ds/bottom-sheet";
import { useBackClose } from "@/shared/ds/overlay";

import { createAppHistory } from "./app-history";

/*
 * QA(iPhone 17 Pro · Safari 26) — 시트를 [×] 로 닫고 곧바로 하단 탭을 누르면 Safari 뒤로 단추가 회색 · 앞으로 단추가
 * 켜진 채 남았다(web_dt_repro2). [×] 는 시트가 쌓은 히스토리 칸을 history.go(-1) 로 되돌리는데 이 이동은 비동기다 —
 * 끝나기 전에 탭 이동(pushState)이 끼어들면 되돌림이 엉뚱한 칸에 떨어진다. jsdom(크롬과 같은 셈법)에서는 되돌림이 방금 쌓은
 * 탭 이동을 무르고 홈으로 돌려보내 "탭이 씹힌다"(QA DW-03 ⚠️ 의 첫 탭 씹힘과 같은 꼴). 앱 히스토리는 되돌림이 끝난 뒤에
 * 이동을 넘긴다.
 */

function Sheet({ open }: { open: boolean }) {
  useBackClose(open, () => {});
  return open ? <div role="dialog">sheet</div> : null;
}

function Screen({ open }: { open: boolean }) {
  return (
    <>
      <Sheet open={open} />
      <Routes>
        <Route path="/desk" element={<h1>home</h1>} />
        <Route path="/desk/asset" element={<h1>asset</h1>} />
      </Routes>
    </>
  );
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

function setup() {
  // 새 칸으로 시작한다 — 앞 시험이 남긴 앞으로 칸을 잘라 길이로 칸 수를 셀 수 있게
  window.history.pushState(null, "", "/desk");
  const history = createAppHistory();
  host = document.createElement("div");
  document.body.appendChild(host);
  const r = createRoot(host);
  root = r;
  const show = (open: boolean) =>
    act(() =>
      r.render(
        <HistoryRouter history={history}>
          <Screen open={open} />
        </HistoryRouter>,
      ),
    );
  show(false);
  return { history, rerender: show };
}

const heading = () => document.querySelector("h1")?.textContent;
const dialog = () => document.querySelector('[role="dialog"]');
// jsdom 의 history.go 는 setTimeout 두 번 · popstate 는 또 한 번 뒤에 온다
const settle = () => act(() => new Promise((r) => setTimeout(r, 30)));

describe("앱 히스토리 — 시트 [×] 뒤 곧바로 이동", () => {
  // 되돌림이 걸리는 두 때 — 닫은 정리와 같은 틱(되돌림 예약 전) · 다음 틱(history.go 가 걸린 뒤, 끝나기 전)
  it.each([
    ["같은 틱", async () => {}],
    ["history.go 가 걸린 뒤", () => act(() => Promise.resolve())],
  ])(
    "[×] 로 닫자마자(%s) 탭으로 옮겨도 옮긴 화면에 머물고, 닫은 시트 칸은 남지 않는다",
    async (_when, between) => {
      const { history, rerender } = setup();
      const base = window.history.length;

      rerender(true); // 시트 열기 — 칸 하나
      expect(window.history.length).toBe(base + 1);
      expect(window.history.state?.grooOverlayBack).toBe(true);

      rerender(false); // [×] — 칸 되돌림(history.go(-1))이 걸린다
      await between();
      act(() => history.push("/desk/asset")); // 되돌림이 끝나기 전에 탭 이동

      await settle();
      expect(heading()).toBe("asset");
      expect(window.location.pathname).toBe("/desk/asset");
      // 닫은 시트 칸은 탭 이동이 덮었다 — 앞으로 가기로 되살아나지 않는다(홈 · 자산 두 칸뿐)
      expect(window.history.length).toBe(base + 1);
      expect(window.history.state?.grooOverlayBack).not.toBe(true);

      // Safari 뒤로 — 시트를 열기 전 화면(홈)으로
      act(() => window.history.back());
      await settle();
      expect(window.location.pathname).toBe("/desk");
      expect(heading()).toBe("home");
    },
  );

  it("[×] 로 닫자마자 다른 시트를 열어도 칸은 하나만 남고, 뒤로 가기는 새 시트를 닫는다", async () => {
    const { rerender } = setup();
    const base = window.history.length;

    rerender(true);
    rerender(false); // 닫고
    rerender(true); // 곧바로 다시 연다(되돌림이 끝나기 전)
    await settle();

    expect(window.history.length).toBe(base + 1);
    expect(window.history.state?.grooOverlayBack).toBe(true);
    expect(dialog()).toBeTruthy();
  });

  // [×] 뒤 앞으로 단추가 켜지는 것은 브라우저 표준이다(되돌린 칸은 앞으로 칸으로 남고, 다음 이동이 자른다).
  // 눌러도 같은 화면 · 같은 주소에 머물 뿐 닫은 시트가 되살아나지 않는다
  it("[×] 로 닫고 머문 뒤 앞으로 가기는 닫은 시트를 되살리지 않는다", async () => {
    const { rerender } = setup();
    rerender(true);
    rerender(false);
    await settle();
    expect(window.history.state?.grooOverlayBack).not.toBe(true);

    act(() => window.history.forward());
    await settle();
    expect(dialog()).toBeNull();
    expect(window.location.pathname).toBe("/desk");
    expect(heading()).toBe("home");
  });

  // 되돌림이 끝나기 전에는 화면이 아직 홈이라 같은 탭을 한 번 더 누를 수 있다 — 옮김은 한 번(같은 칸이 둘 쌓이지 않는다)
  it("[×] 뒤 되돌림을 기다리는 동안 같은 탭을 두 번 눌러도 한 번만 옮긴다", async () => {
    const { history, rerender } = setup();
    const base = window.history.length;
    rerender(true);
    rerender(false);
    act(() => history.push("/desk/asset"));
    act(() => history.push("/desk/asset"));
    await settle();
    expect(window.location.pathname).toBe("/desk/asset");
    expect(window.history.length).toBe(base + 1);
    act(() => window.history.back());
    await settle();
    expect(window.location.pathname).toBe("/desk");
  });

  it("되돌릴 칸이 없으면 이동은 그 자리에서 바로 일어난다", () => {
    const { history } = setup();
    act(() => history.push("/desk/asset"));
    expect(window.location.pathname).toBe("/desk/asset");
    expect(heading()).toBe("asset");
  });
});

/*
 * QA 2026-11-18(iPhone · Safari 26) — 키보드가 뜬 채 [×] 로 닫은 뒤에는 Safari 뒤로 단추가 회색 · 앞으로 단추가 켜졌다.
 * 키보드 없는 경로에서 맞았던 되돌림 대기(#621)가 빠진 것이 아니다 — 이어 누른 탭이 문서에 오지 않아(키보드가 내려가는 동안
 * iOS 가 버린다) 이동(pushState)이 없었고, 되돌린 칸이 앞으로 칸으로 남은 것이다(이동이 없으면 어느 경로든 앞으로 단추가 켜진다 —
 * 위 "머문 뒤 앞으로 가기" 시험). 키보드 경로에서도 시트는 키보드가 다 내려간 뒤에 닫히고(overlay/close-after-keyboard.ts),
 * 그 뒤 이어 누른 탭이 앞으로 칸을 잘라 뒤로는 켜지고 앞으로는 꺼진다. 키보드가 내려가며 오는 보이는 영역 resize · scroll
 * (스크롤 되돌림)을 함께 흉내 낸다.
 */
type FakeViewport = EventTarget & {
  height: number;
  offsetTop: number;
  scale: number;
};

function KeypadSheet() {
  const [open, setOpen] = React.useState(true);
  return (
    <BottomSheet form open={open} onOpenChange={setOpen}>
      <BottomSheetContent title="거래 추가">
        <BottomSheetBody>
          <input aria-label="금액" inputMode="decimal" />
        </BottomSheetBody>
      </BottomSheetContent>
    </BottomSheet>
  );
}

describe("앱 히스토리 — 키보드가 뜬 채 [×] 뒤 이동", () => {
  function setupKeypad() {
    if (!globalThis.ResizeObserver) {
      globalThis.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
    }
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    })) as unknown as typeof window.matchMedia;
    const vv: FakeViewport = Object.assign(new EventTarget(), {
      height: 844,
      offsetTop: 0,
      scale: 1,
    });
    Object.defineProperty(window, "visualViewport", {
      value: vv,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 844,
      configurable: true,
    });
    window.history.pushState(null, "", "/desk");
    const history = createAppHistory();
    host = document.createElement("div");
    document.body.appendChild(host);
    const r = createRoot(host);
    root = r;
    const base = window.history.length;
    act(() =>
      r.render(
        <HistoryRouter history={history}>
          <KeypadSheet />
          <Routes>
            <Route path="/desk" element={<h1>home</h1>} />
            <Route path="/desk/asset" element={<h1>asset</h1>} />
          </Routes>
        </HistoryRouter>,
      ),
    );
    /** 키보드 — 보이는 영역 resize 와 함께 iOS 가 스크롤을 되돌리며 보내는 scroll */
    const keyboard = async (up: boolean) => {
      vv.height = up ? 494 : 844;
      vv.offsetTop = up ? 120 : 0;
      await act(async () => {
        vv.dispatchEvent(new Event("scroll"));
        vv.dispatchEvent(new Event("resize"));
        window.dispatchEvent(new Event("scroll"));
      });
    };
    const input = document.querySelector<HTMLInputElement>("input")!;
    act(() => input.focus());
    return { history, base, keyboard };
  }

  const closeSheet = () =>
    act(() => {
      document
        .querySelector<HTMLButtonElement>("[data-slot=bottom-sheet-close]")!
        .dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true }),
        );
    });

  afterEach(() => {
    delete (document.documentElement as { clientHeight?: number }).clientHeight;
    delete (window as { visualViewport?: unknown }).visualViewport;
  });

  it.each([
    ["키보드가 다 내려가고 시트가 닫힌 뒤", true],
    ["시트가 닫히는 바로 그 틱(되돌림이 끝나기 전)", false],
  ])(
    "%s 누른 탭은 한 번에 옮기고 — 뒤로 켜짐 · 앞으로 꺼짐(닫은 시트 칸이 앞으로 칸으로 남지 않는다)",
    async (_when, settledFirst) => {
      const { history, base, keyboard } = setupKeypad();
      await keyboard(true);
      // 시트가 쌓은 칸 하나
      expect(window.history.length).toBe(base + 1);
      expect(window.history.state?.grooOverlayBack).toBe(true);

      closeSheet();
      // 키보드가 내려가는 동안 시트 · 칸은 그대로다
      expect(window.history.state?.grooOverlayBack).toBe(true);

      await keyboard(false); // 닫힌다 — 칸 되돌림(history.go(-1))이 걸린다
      if (settledFirst) await settle();
      act(() => history.push("/desk/asset"));
      await settle();

      expect(heading()).toBe("asset");
      expect(window.location.pathname).toBe("/desk/asset");
      // 홈 · 자산 두 칸뿐 — 앞으로 칸이 없다(앞으로 꺼짐)
      expect(window.history.length).toBe(base + 1);
      expect(window.history.state?.grooOverlayBack).not.toBe(true);

      // 뒤로 켜짐 — 시트를 열기 전 화면(홈)으로
      act(() => window.history.back());
      await settle();
      expect(window.location.pathname).toBe("/desk");
      expect(heading()).toBe("home");
    },
  );

  it("키보드가 내려가는 동안 온 뒤로 가기는 시트를 닫고(칸은 브라우저가 썼다) 화면은 그대로", async () => {
    const { base, keyboard } = setupKeypad();
    await keyboard(true);
    act(() => window.history.back());
    await settle();
    await keyboard(false);
    await settle();
    expect(window.location.pathname).toBe("/desk");
    expect(heading()).toBe("home");
    expect(window.history.state?.grooOverlayBack).not.toBe(true);
    expect(window.history.length).toBe(base + 1);
  });
});
