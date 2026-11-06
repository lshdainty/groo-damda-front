// 설정 데스크톱 두 칸 틀 · 태블릿 한 단계 틀(I-16 19 ~ 35) — 실제 틀을 띄운 채로 구조 · 접근성 · 이동을 잠근다.
// t() 는 키를 그대로 흘려보내므로 이 파일은 CSV 글이 바뀌어도 안 깨진다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: "ko" },
  }),
  Trans: ({ children }: { children?: unknown }) => children ?? null,
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const { SettingsDesktopFrame } = await import("./SettingsDesktopFrame");
const { SettingsTabletFrame } = await import("./SettingsTabletFrame");
const { MENU_GROUPS, SECTIONS } = await import("../model/sections");
const { ManagerHead } = await import("@/shared/ui/groo/manager-layout");
const { useSettingsLeaveGuard } =
  await import("@/shared/ui/groo/settings-frame-context");

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  // jsdom 은 링크 기본 동작(문서 이동)을 구현하지 않는다 — React 처리기가 본 뒤 막아 소음을 없앤다
  container.addEventListener("click", (e) => e.preventDefault());
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const sec = (id: string) => SECTIONS.find((s) => s.id === id)!;
const click = (el: Element) =>
  act(() => {
    el.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
    );
  });

function Where() {
  const l = useLocation();
  return <output data-testid="where">{l.pathname + l.search}</output>;
}

/** 위젯 흉내 — 자기 `ManagerHead` 를 그리는 본문 */
const widgetBody = () => (
  <div data-testid="widget">
    <ManagerHead
      title="위젯 제목"
      description="위젯 설명"
      actions={<button type="button">동작</button>}
    />
    <p data-testid="first">첫 내용</p>
  </div>
);

describe("데스크톱 두 칸 틀 (1280 이상)", () => {
  function mount(
    id: string,
    onSelect = vi.fn(),
    renderBody: (m: boolean) => React.ReactNode = widgetBody,
  ) {
    act(() =>
      root.render(
        <MemoryRouter initialEntries={[`/desk/settings?section=${id}`]}>
          <SettingsDesktopFrame
            section={sec(id).id}
            activeSection={sec(id)}
            onSelect={onSelect}
            renderBody={renderBody}
          />
          <Where />
        </MemoryRouter>,
      ),
    );
    return onSelect;
  }

  it("목록 이름 '설정' 은 제목 태그가 아니고, 목록은 그 이름을 쓰는 nav 하나 · 항목 열여섯이다", () => {
    mount("categories");
    const nav = container.querySelector("nav")!;
    const name = document.getElementById(nav.getAttribute("aria-labelledby")!)!;
    expect(name.textContent).toBe("page.title");
    expect(name.tagName).toBe("P");
    expect(container.querySelectorAll("nav").length).toBe(1);
    expect(
      container.querySelectorAll("[data-slot=side-navigation-item]").length,
    ).toBe(16);
  });

  it("묶음 이름 없이 묶음 사이 선만 — MENU_GROUPS 일곱 묶음이라 선 여섯, 차례가 폰 메뉴와 같다", () => {
    mount("categories");
    expect(container.querySelectorAll("li[aria-hidden]").length).toBe(
      MENU_GROUPS.length - 1,
    );
    const labels = [
      ...container.querySelectorAll("[data-slot=side-navigation-item-label]"),
    ].map((e) => e.textContent);
    const expected = MENU_GROUPS.flatMap((g) => g.sectionIds).map(
      (id) => sec(id).labelKey,
    );
    expect(labels).toEqual(expected);
    for (const g of MENU_GROUPS) {
      expect(container.textContent).not.toContain(g.labelKey);
    }
  });

  it("지금 항목은 aria-current 하나 — 숨은 구역(금액 가리기 · 기기)은 '계정' 이 켜진다", () => {
    for (const id of ["categories", "hide-amounts", "devices"]) {
      act(() => root.unmount());
      root = createRoot(container);
      mount(id);
      const cur = container.querySelectorAll("[aria-current=page]");
      expect(cur.length).toBe(1);
      const want = sec(id).parent ?? id;
      expect(
        cur[0]!.querySelector("[data-slot=side-navigation-item-label]")!
          .textContent,
      ).toBe(sec(want).labelKey);
    }
  });

  it("목록 줄 일반 클릭은 onSelect(기록을 남기는 이동), 수정 키 클릭은 가로채지 않는다, 바깥 주소는 새 탭 링크", () => {
    const onSelect = mount("categories");
    const item = (key: string) =>
      [...container.querySelectorAll("[data-slot=side-navigation-item]")].find(
        (a) => a.textContent?.includes(key),
      ) as HTMLAnchorElement;
    click(item("sections.budget.label"));
    expect(onSelect).toHaveBeenCalledWith("budget");
    expect(item("sections.budget.label").getAttribute("href")).toBe(
      "/desk/settings?section=budget",
    );
    onSelect.mockClear();
    act(() => {
      item("sections.budget.label").dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          button: 0,
          ctrlKey: true,
        }),
      );
    });
    expect(onSelect).not.toHaveBeenCalled();
    const ext = item("sections.guide.label");
    expect(ext.target).toBe("_blank");
    expect(ext.rel).toContain("noopener");
    expect(ext.getAttribute("aria-label")).toContain("newTab");
  });

  it("화면 제목 h1 은 하나 — 위젯의 ManagerHead 가 틀의 제목 줄 자리로 들어오고 첫 내용보다 앞이다", () => {
    mount("categories");
    const h1s = container.querySelectorAll("h1");
    expect(h1s.length).toBe(1);
    expect(h1s[0]!.textContent).toBe("위젯 제목");
    const widget = container.querySelector("[data-testid=widget]")!;
    // 위젯 안에는 제목 줄이 없고(틀 자리로 갔다), 제목 줄은 위젯보다 앞이다
    expect(widget.querySelector("h1")).toBeNull();
    const head = container.querySelector(".page__head")!;
    expect(
      head.compareDocumentPosition(widget) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(head.querySelector(".right button")!.textContent).toBe("동작");
  });

  it("위젯에 머리가 없는 섹션은 틀이 섹션 이름 · 설명으로 제목 줄을 그린다", () => {
    // 머리 없는 섹션은 NEEDS_DESKTOP_HEAD(sections.ts) — 반복 거래는 이제 제 ManagerHead 를 그려 빠졌다(527ea90f)
    mount("appearance", vi.fn(), () => <p>본문</p>);
    const h1 = container.querySelector("h1")!;
    expect(h1.textContent).toBe(sec("appearance").labelKey);
    expect(container.querySelector(".page__head .sub")!.textContent).toBe(
      sec("appearance").descKey,
    );
  });

  it("목록에 있는 섹션에는 '‹' 가 없고, 숨은 구역에는 '‹ 계정' 이 계정 주소의 링크로 선다(push)", () => {
    mount("categories");
    expect(
      [...container.querySelectorAll("a")].filter(
        (a) => !a.closest("nav") && a.querySelector("svg"),
      ).length,
    ).toBe(0);
    act(() => root.unmount());
    root = createRoot(container);
    mount("devices");
    const back = [...container.querySelectorAll("a")].find(
      (a) =>
        a.textContent === "sections.account.label" &&
        !a.closest("nav") &&
        a.querySelector("svg"),
    )!;
    expect(back).toBeTruthy();
    expect(back.getAttribute("href")).toBe("/desk/settings?section=account");
    click(back);
    expect(container.querySelector("[data-testid=where]")!.textContent).toBe(
      "/desk/settings?section=account",
    );
  });

  it("금액 가리기 가드 — 바꾼 채면 '‹ 계정' 이 이동 대신 가드를 먼저 부르고, 통과시키면 가려던 곳으로 간다", () => {
    let proceed: (() => void) | null = null;
    function Guarded() {
      useSettingsLeaveGuard((go) => {
        proceed = go;
      });
      return <p>본문</p>;
    }
    mount("hide-amounts", vi.fn(), () => <Guarded />);
    const back = [...container.querySelectorAll("a")].find(
      (a) => a.textContent === "sections.account.label" && !a.closest("nav"),
    )!;
    click(back);
    expect(container.querySelector("[data-testid=where]")!.textContent).toBe(
      "/desk/settings?section=hide-amounts",
    );
    expect(proceed).not.toBeNull();
    act(() => proceed!());
    expect(container.querySelector("[data-testid=where]")!.textContent).toBe(
      "/desk/settings?section=account",
    );
  });
});

describe("태블릿 한 단계 틀 (768 ~ 1279)", () => {
  function mount(id: string | null, onSelect = vi.fn()) {
    act(() =>
      root.render(
        <MemoryRouter
          initialEntries={[
            id ? `/desk/settings?section=${id}` : "/desk/settings",
          ]}
        >
          <SettingsTabletFrame
            activeSection={id ? sec(id) : null}
            onSelect={onSelect}
            renderBody={widgetBody}
          />
          <Where />
        </MemoryRouter>,
      ),
    );
    return onSelect;
  }

  it("섹션 없는 주소는 설정 메뉴 페이지 — h1 '설정' 하나 · 왼쪽 목록 없음 · 묶음 카드 일곱, 줄은 열여섯", () => {
    mount(null);
    expect(container.querySelectorAll("h1").length).toBe(1);
    expect(container.querySelector("h1")!.textContent).toBe("page.title");
    expect(container.querySelector("nav")).toBeNull();
    const cards = container.querySelectorAll("[data-slot=card]");
    expect(cards.length).toBe(MENU_GROUPS.length);
    expect(
      [...cards].map((c) => c.querySelector("[data-slot=card-title]")!.tagName),
    ).toEqual(MENU_GROUPS.map(() => "H2"));
    expect(container.querySelectorAll("[data-list-action]").length).toBe(16);
  });

  it("메뉴 줄을 누르면 onSelect, 바깥 주소 둘은 새 탭 링크이고 이름에 새 탭이 붙는다", () => {
    const onSelect = mount(null);
    const rows = [...container.querySelectorAll("a[data-list-action]")];
    const row = rows.find((a) =>
      a.textContent?.includes("sections.data.label"),
    )!;
    click(row);
    expect(onSelect).toHaveBeenCalledWith("data");
    const ext = rows.filter((a) => a.getAttribute("target") === "_blank");
    expect(ext.length).toBe(2);
    expect(ext.every((a) => a.textContent!.includes("newTab"))).toBe(true);
  });

  it("하위 페이지는 '‹ 설정'(push) → 제목 줄 → 본문, 왼쪽 목록 없음 · h1 하나", () => {
    mount("categories");
    expect(container.querySelector("nav")).toBeNull();
    expect(container.querySelectorAll("h1").length).toBe(1);
    const back = container.querySelector("a[href='/desk/settings']")!;
    expect(back.textContent).toBe("page.title");
    click(back);
    expect(container.querySelector("[data-testid=where]")!.textContent).toBe(
      "/desk/settings",
    );
  });

  it("숨은 구역(기기)의 '‹' 는 설정이 아니라 계정으로 간다", () => {
    mount("devices");
    const back = container.querySelector(
      "a[href='/desk/settings?section=account']",
    )!;
    expect(back.textContent).toBe("sections.account.label");
  });
});
