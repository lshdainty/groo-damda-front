import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import {
  Route,
  Routes,
  unstable_HistoryRouter as HistoryRouter,
} from "react-router-dom";

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
