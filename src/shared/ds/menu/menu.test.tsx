// Menu 의 동작 — 모양 · 색은 scripts/check-ds-spec.mjs 가 크로미움에서 스펙 값과 맞춘다.
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  Menu,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuTrigger,
} from "./menu";
import {
  ResponsiveMenu,
  ResponsiveMenuContent,
  ResponsiveMenuGroup,
  ResponsiveMenuItem,
  ResponsiveMenuTrigger,
} from "./responsive-menu";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;
let wide = true;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // jsdom 에 없다 — Radix(자리 계산 · 스크롤)가 쓴다
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!Element.prototype.scrollIntoView)
    Element.prototype.scrollIntoView = () => {};
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.hasPointerCapture = () => false;
  }
  window.history.replaceState(null, "");
  wide = true;
  window.matchMedia = ((query: string) => ({
    matches: wide,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  document.body.removeAttribute("style");
  await new Promise((r) => setTimeout(r, 50));
  vi.restoreAllMocks();
});

const render = (node: ReactNode) => act(() => root.render(node));
const tick = (ms = 0) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });

const trigger = () =>
  document.querySelector<HTMLButtonElement>("[data-slot=menu-trigger]")!;
const menu = () =>
  document.querySelector<HTMLElement>("[data-slot=menu-content]");
const items = () =>
  Array.from(document.querySelectorAll<HTMLElement>("[data-slot=menu-item]"));
const item = (name: string) =>
  items().find((el) => el.textContent?.includes(name))!;

function key(el: Element, k: string, init: KeyboardEventInit = {}) {
  act(() => {
    el.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: k,
        bubbles: true,
        cancelable: true,
        ...init,
      }),
    );
  });
}
const click = (el: Element) =>
  act(async () => {
    el.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    await new Promise((r) => setTimeout(r, 0));
  });
// 열린 메뉴에서 키 — 초점이 있는 줄(없으면 메뉴)에 보낸다
const press = (k: string, init: KeyboardEventInit = {}) =>
  key(
    document.activeElement && menu()?.contains(document.activeElement)
      ? document.activeElement
      : menu()!,
    k,
    init,
  );

function Basic({
  onSelect = () => {},
  onOpenChange,
  open,
  defaultOpen,
}: {
  onSelect?: (name: string) => void;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  defaultOpen?: boolean;
}) {
  return (
    <>
      <Menu open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
        <MenuTrigger aria-label="김하늘 더보기">⋮</MenuTrigger>
        <MenuContent>
          <MenuGroup>
            <MenuGroupLabel>계정</MenuGroupLabel>
            <MenuItem label="수정" onSelect={() => onSelect("수정")} />
            <MenuItem
              label="비밀번호 초기화"
              description="새 비밀번호를 메일로 보내요."
              onSelect={() => onSelect("비밀번호 초기화")}
            />
            <MenuItem
              label="휴가 내역 내보내기"
              disabled
              onSelect={() => onSelect("내보내기")}
            />
          </MenuGroup>
          <MenuGroup>
            <MenuItem
              label="삭제"
              tone="critical"
              onSelect={() => onSelect("삭제")}
            />
          </MenuGroup>
        </MenuContent>
      </Menu>
      <button data-testid="after">다음 칸</button>
    </>
  );
}

const open = async () => {
  key(trigger(), "Enter");
  await tick();
};

describe("구조 · 접근성", () => {
  it("트리거는 aria-haspopup=menu · aria-expanded, 열리면 aria-controls", async () => {
    render(<Basic />);
    expect(trigger().getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    await open();
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    expect(trigger().getAttribute("aria-controls")).toBe(menu()!.id);
  });

  it("메뉴는 role=menu + 트리거로 aria-labelledby, 줄은 menuitem, 막히면 aria-disabled", async () => {
    render(<Basic />);
    await open();
    expect(menu()!.getAttribute("role")).toBe("menu");
    expect(menu()!.getAttribute("aria-labelledby")).toBe(trigger().id);
    expect(items().every((el) => el.getAttribute("role") === "menuitem")).toBe(
      true,
    );
    expect(item("휴가 내역").getAttribute("aria-disabled")).toBe("true");
    expect(item("수정").hasAttribute("aria-disabled")).toBe(false);
  });

  it("고른 표시 · 하위 메뉴가 없다 — 줄 역할은 menuitem 뿐", async () => {
    render(<Basic />);
    await open();
    expect(
      document.querySelector(
        '[role="menuitemcheckbox"], [role="menuitemradio"], [aria-haspopup="menu"][role="menuitem"]',
      ),
    ).toBeNull();
    expect(menu()!.querySelector("[data-state=checked]")).toBeNull();
  });

  it("묶음은 role=group, 이름이 있으면 그 이름으로 aria-labelledby", async () => {
    render(<Basic />);
    await open();
    const groups = Array.from(
      document.querySelectorAll<HTMLElement>("[data-slot=menu-group]"),
    );
    expect(groups).toHaveLength(2);
    expect(groups[0]!.getAttribute("role")).toBe("group");
    const label = document.querySelector("[data-slot=menu-group-label]")!;
    expect(groups[0]!.getAttribute("aria-labelledby")).toBe(label.id);
    expect(groups[1]!.hasAttribute("aria-labelledby")).toBe(false);
    // 묶음 이름은 누를 수 없다
    expect(label.getAttribute("role")).not.toBe("menuitem");
  });

  it("선은 둘째 묶음부터만 — 장식(의사 요소)이라 보조 기술에 없다", async () => {
    render(<Basic />);
    await open();
    const groups = Array.from(
      document.querySelectorAll<HTMLElement>("[data-slot=menu-group]"),
    );
    // 묶음 사이에만(앞 묶음이 있을 때) · 줄 사이에는 없다 — 클래스로 맞춘다
    expect(groups[0]!.className).toContain(
      "[[data-slot=menu-group]+&]:before:h-px",
    );
    expect(groups[0]!.className).toContain(
      "[[data-slot=menu-group]+&]:before:mx-x4",
    );
    expect(groups[0]!.className).toContain(
      "[[data-slot=menu-group]+&]:before:bg-stroke-neutral-subtle",
    );
    expect(items().every((el) => !el.className.includes("before:"))).toBe(true);
    expect(document.querySelector("[role=separator]")).toBeNull();
  });

  it("모양 값 — 폭 200 · 모서리 20 · z-floating · 오른쪽 끝에 맞춘다 · 위아래 8", async () => {
    render(<Basic />);
    await open();
    const cls = menu()!.className;
    expect(cls).toContain("w-[200px]");
    expect(cls).toContain("rounded-r5");
    expect(cls).toContain("z-(--z-floating)");
    expect(cls).toContain("bg-bg-layer-floating");
    expect(cls).toContain("shadow-[var(--shadow-s3)]");
    expect(menu()!.getAttribute("data-align")).toBe("end");
    expect(
      document.querySelector("[data-slot=menu-scroll]")!.className,
    ).toContain("py-x2");
  });

  it("align=start 를 줄 수 있다(왼쪽에 놓인 트리거)", async () => {
    render(
      <Menu defaultOpen>
        <MenuTrigger aria-label="더보기">⋮</MenuTrigger>
        <MenuContent align="start">
          <MenuGroup>
            <MenuItem label="수정" />
          </MenuGroup>
        </MenuContent>
      </Menu>,
    );
    await tick();
    expect(menu()!.getAttribute("data-align")).toBe("start");
  });

  it("설명 · 위험 · 막힘 · 뒤 아이콘 클래스", async () => {
    render(
      <Menu defaultOpen>
        <MenuTrigger aria-label="더보기">⋮</MenuTrigger>
        <MenuContent>
          <MenuGroup>
            <MenuItem
              label="도움말"
              description="새 탭에서 열려요."
              suffixIcon={<svg data-testid="suffix" />}
            />
            <MenuItem label="삭제" tone="critical" icon={<svg />} />
            <MenuItem label="막힘" disabled />
          </MenuGroup>
        </MenuContent>
      </Menu>,
    );
    await tick();
    const label = (name: string) =>
      item(name).querySelector("[data-slot=menu-item-label]")!;
    expect(label("도움말").className).toContain("text-t4");
    expect(label("도움말").className).toContain("text-fg-neutral");
    expect(
      item("도움말").querySelector("[data-slot=menu-item-description]")!
        .className,
    ).toContain("text-fg-neutral-subtle");
    expect(
      item("도움말")
        .querySelector("[data-slot=menu-item-suffix-icon]")!
        .getAttribute("aria-hidden"),
    ).toBe("true");
    // 위험 — 이름 · 아이콘만 빨갛다
    expect(label("삭제").className).toContain("text-fg-critical");
    expect(
      item("삭제").querySelector("[data-slot=menu-item-icon]")!.className,
    ).toContain("text-fg-critical");
    // 막힘 — 전용 색 · 알약 바탕 없음 · 축소 없음 · not-allowed
    expect(label("막힘").className).toContain("text-fg-disabled");
    const pill = item("막힘").querySelector("[data-slot=menu-item-pill]")!;
    expect(pill.className).not.toContain("group-hover/menu-item");
    expect(item("막힘").className).toContain(
      "data-[disabled]:cursor-not-allowed",
    );
    expect(
      item("막힘").querySelector("[data-slot=menu-item-content]")!.className,
    ).not.toContain("group-active");
  });

  it("알약은 쉴 때 줄 폭 전체 · 모서리 0, 호버 · 누름에 좌우 8 · 모서리 12 로 들어오며 칠한다 — 키보드 링은 줄의 ::after 에 알약 자리로 고정", async () => {
    render(<Basic />);
    await open();
    const row = item("수정");
    const pill = row.querySelector("[data-slot=menu-item-pill]")!;
    expect(pill.getAttribute("aria-hidden")).toBe("true");
    expect(pill.className).toContain("inset-x-0");
    expect(pill.className).toContain("rounded-none");
    expect(pill.className).toContain("bg-transparent");
    for (const on of ["hover", "active"]) {
      expect(pill.className).toContain(`group-${on}/menu-item:inset-x-x2`);
      expect(pill.className).toContain(`group-${on}/menu-item:rounded-r3`);
      expect(pill.className).toContain(
        `group-${on}/menu-item:bg-bg-layer-floating-pressed`,
      );
    }
    // 들임 · 모서리도 색과 함께 150ms 로 바뀐다
    expect(pill.className).toContain(
      "inset_var(--motion-duration-color-transition)",
    );
    expect(pill.className).toContain(
      "border-radius_var(--motion-duration-color-transition)",
    );
    // 키보드 링 — 줄의 ::after, 알약이 다 들어온 자리(8 · 12) 안쪽 2px
    expect(row.className).toContain("after:inset-x-x2");
    expect(row.className).toContain("after:rounded-r3");
    expect(row.className).toContain("focus-visible:after:outline-2");
    expect(row.className).toContain("focus-visible:after:-outline-offset-2");
    // 눌렀을 때만 콘텐츠가 2px 거리 축소 — 모션 줄이기면 하지 않는다
    const content = item("수정").querySelector(
      "[data-slot=menu-item-content]",
    )!;
    expect(content.className).toContain(
      "group-active/menu-item:[scale:calc(1-2/var(--press-basis))]",
    );
    expect(content.className).toContain(
      "motion-reduce:group-active/menu-item:[scale:1]",
    );
  });

  it("긴 이름은 말줄임 없이 단어 단위로 줄을 바꾼다", async () => {
    render(
      <Menu defaultOpen>
        <MenuTrigger aria-label="더보기">⋮</MenuTrigger>
        <MenuContent>
          <MenuGroup>
            <MenuItem label="아주 긴 동작 이름이 들어가도 줄을 바꿀 뿐 잘리지 않아요" />
          </MenuGroup>
        </MenuContent>
      </Menu>,
    );
    await tick();
    const text = menu()!.querySelector("[data-slot=menu-item-text]")!;
    expect(text.className).toContain("break-keep");
    expect(text.className).toContain("[overflow-wrap:break-word]");
    expect(menu()!.innerHTML).not.toContain("truncate");
    expect(menu()!.innerHTML).not.toContain("text-ellipsis");
  });
});

describe("키보드", () => {
  it("트리거에서 Enter · Space · ↓ 는 열고 첫 줄로", async () => {
    for (const k of ["Enter", " ", "ArrowDown"]) {
      render(<Basic />);
      key(trigger(), k);
      await tick();
      expect(menu()).not.toBeNull();
      expect(document.activeElement).toBe(item("수정"));
      key(menu()!, "Escape");
      await tick(150);
      render(null);
      await tick();
    }
  });

  it("↑ 로 열면 마지막(막히지 않은) 줄로", async () => {
    render(<Basic />);
    key(trigger(), "ArrowUp");
    await tick();
    expect(menu()).not.toBeNull();
    expect(document.activeElement).toBe(item("삭제"));
  });

  it("↓ ↑ 는 끝에서 처음으로 돌고 막힌 줄을 건너뛴다", async () => {
    render(<Basic />);
    await open();
    expect(document.activeElement).toBe(item("수정"));
    // Radix 의 초점 이동은 다음 틱에 일어난다
    press("ArrowDown");
    await tick();
    expect(document.activeElement).toBe(item("비밀번호 초기화"));
    press("ArrowDown"); // 막힌 "휴가 내역" 을 건너뛴다
    await tick();
    expect(document.activeElement).toBe(item("삭제"));
    press("ArrowDown"); // 끝 → 처음
    await tick();
    expect(document.activeElement).toBe(item("수정"));
    press("ArrowUp"); // 처음 → 끝
    await tick();
    expect(document.activeElement).toBe(item("삭제"));
  });

  it("Home · End 는 첫 줄 · 마지막 줄", async () => {
    render(<Basic />);
    await open();
    // Radix 는 Home · End 의 초점 이동을 다음 틱에 한다
    press("End");
    await tick();
    expect(document.activeElement).toBe(item("삭제"));
    press("Home");
    await tick();
    expect(document.activeElement).toBe(item("수정"));
  });

  it("글자는 그 글자로 시작하는 줄로 간다(한글은 첫 글자)", async () => {
    render(<Basic />);
    await open();
    press("삭");
    await tick();
    expect(document.activeElement).toBe(item("삭제"));
  });

  it("Enter 는 메뉴를 닫고 초점을 트리거로 돌린 뒤 실행한다", async () => {
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    render(<Basic onSelect={onSelect} onOpenChange={onOpenChange} />);
    await open();
    press("Enter");
    await tick();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    await tick(250);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("수정");
    expect(document.activeElement).toBe(trigger());
  });

  it("Esc 는 닫고 초점은 트리거로", async () => {
    const onSelect = vi.fn();
    render(<Basic onSelect={onSelect} />);
    await open();
    press("Escape");
    await tick(250);
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(trigger());
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("닫혔을 때 트리거가 문서에서 사라졌으면(지워진 줄) 초점은 body 가 아니라 목록 머리로 간다", async () => {
    render(
      <main>
        <h2>자주 쓰는 거래</h2>
        <ul>
          <li id="row">
            <Menu>
              <MenuTrigger aria-label="점심 더보기">⋮</MenuTrigger>
              <MenuContent>
                <MenuItem label="수정" onSelect={() => {}} />
              </MenuContent>
            </Menu>
          </li>
        </ul>
      </main>,
    );
    await open();
    expect(menu()).not.toBeNull();
    // 줄이 지워졌다(열린 동안 다른 곳에서 지움)
    act(() => document.getElementById("row")!.remove());
    press("Escape");
    await tick(250);
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(document.querySelector("h2"));
  });

  it("Tab 은 닫고 트리거 다음 칸으로(트리거에 초점을 두고 브라우저의 Tab 에 맡긴다)", async () => {
    const onOpenChange = vi.fn();
    render(<Basic onOpenChange={onOpenChange} />);
    await open();
    press("Tab");
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(document.activeElement).toBe(trigger());
    await tick(250);
    // 닫혀도 초점을 다시 가져가지 않는다 — Tab 이 옮긴 자리를 존중한다
    expect(menu()).toBeNull();
  });

  it("Shift+Tab 은 닫고 트리거로", async () => {
    const onOpenChange = vi.fn();
    render(<Basic onOpenChange={onOpenChange} />);
    await open();
    press("Tab", { shiftKey: true });
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(document.activeElement).toBe(trigger());
  });
});

describe("고르기 · 닫기", () => {
  it("줄을 누르면 닫고, 다 닫혀 초점이 트리거로 돌아온 뒤에 onSelect 를 부른다", async () => {
    // 부르는 순간의 모습을 적어 둔다 — 메뉴가 이미 없고 초점은 트리거에 있어야 한다(확인창이 메뉴와 겹치지 않게)
    const seen: { menuGone: boolean; onTrigger: boolean }[] = [];
    const onSelect = vi.fn(() =>
      seen.push({
        menuGone: menu() === null,
        onTrigger: document.activeElement === trigger(),
      }),
    );
    render(<Basic onSelect={onSelect} />);
    await open();
    await click(item("비밀번호 초기화"));
    await tick(250);
    expect(menu()).toBeNull();
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("비밀번호 초기화");
    expect(seen).toEqual([{ menuGone: true, onTrigger: true }]);
  });

  it("막힌 줄은 실행하지 않고 닫히지도 않는다", async () => {
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    render(<Basic onSelect={onSelect} onOpenChange={onOpenChange} />);
    await open();
    onOpenChange.mockClear();
    await click(item("휴가 내역"));
    await tick(250);
    expect(onSelect).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(menu()).not.toBeNull();
  });

  it("트리거를 다시 누르면 닫는다", async () => {
    render(<Basic />);
    await open();
    expect(menu()).not.toBeNull();
    await act(async () => {
      trigger().dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          button: 0,
          pointerType: "mouse",
        }),
      );
    });
    await tick(250);
    expect(menu()).toBeNull();
  });

  it("마우스를 올려도 키보드 위치(초점)는 옮기지 않는다", async () => {
    render(<Basic />);
    await open();
    expect(document.activeElement).toBe(item("수정"));
    act(() => {
      item("삭제").dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          cancelable: true,
          pointerType: "mouse",
        }),
      );
    });
    expect(document.activeElement).toBe(item("수정"));
  });

  it("바깥을 누르면 닫는다 — 비모달이라 뒤 화면을 잠그지 않는다", async () => {
    const onOpenChange = vi.fn();
    render(<Basic onOpenChange={onOpenChange} />);
    await open();
    expect(document.body.style.pointerEvents).not.toBe("none");
    expect(container.getAttribute("aria-hidden")).toBeNull();
    await act(async () => {
      document.body.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          button: 0,
          pointerType: "mouse",
        }),
      );
    });
    await tick(250);
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("제어하는 open 이면 값을 따른다", async () => {
    render(<Basic open={false} />);
    expect(menu()).toBeNull();
    render(<Basic open />);
    await tick();
    expect(menu()).not.toBeNull();
  });
});

describe("경계", () => {
  it("줄이 없는 메뉴도 그려진다(빈 목록)", async () => {
    render(
      <Menu defaultOpen>
        <MenuTrigger aria-label="더보기">⋮</MenuTrigger>
        <MenuContent>{null}</MenuContent>
      </Menu>,
    );
    await tick();
    expect(menu()).not.toBeNull();
    expect(items()).toHaveLength(0);
  });
});

describe("ResponsiveMenu — 1280 에서 Menu ↔ Menu Sheet", () => {
  function Both({ onSelect }: { onSelect?: (n: string) => void }) {
    return (
      <ResponsiveMenu>
        <ResponsiveMenuTrigger aria-label="주간 회의 메모 더보기">
          ⋮
        </ResponsiveMenuTrigger>
        <ResponsiveMenuContent title="주간 회의 메모">
          <ResponsiveMenuGroup>
            <ResponsiveMenuItem
              label="수정"
              onSelect={() => onSelect?.("수정")}
            />
            <ResponsiveMenuItem
              label="이동"
              disabled
              suffixIcon={<svg data-testid="suffix" />}
            />
          </ResponsiveMenuGroup>
          <ResponsiveMenuGroup>
            <ResponsiveMenuItem
              label="삭제"
              tone="critical"
              onSelect={() => onSelect?.("삭제")}
            />
          </ResponsiveMenuGroup>
        </ResponsiveMenuContent>
      </ResponsiveMenu>
    );
  }

  it("1280 이상이면 Menu 로 연다", async () => {
    wide = true;
    render(<Both />);
    key(document.querySelector("[data-slot=menu-trigger]")!, "Enter");
    await tick();
    expect(menu()).not.toBeNull();
    expect(document.querySelector("[data-slot=menu-sheet-content]")).toBeNull();
    // 메뉴에는 머리가 없다 — title 은 시트의 것
    expect(menu()!.textContent).not.toContain("주간 회의 메모");
    expect(items().map((el) => el.textContent)).toEqual([
      "수정",
      "이동",
      "삭제",
    ]);
  });

  it("1280 미만이면 Menu Sheet 로 연다 — 같은 줄 · 같은 순서 · 같은 막힘, 뒤 아이콘은 없다", async () => {
    wide = false;
    render(<Both />);
    const t = document.querySelector<HTMLElement>(
      "[data-slot=menu-sheet-trigger]",
    )!;
    expect(t).not.toBeNull();
    await click(t);
    await tick();
    const sheet = document.querySelector("[data-slot=menu-sheet-content]");
    expect(sheet).not.toBeNull();
    expect(menu()).toBeNull();
    expect(sheet!.textContent).toContain("주간 회의 메모");
    const rows = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        "[data-slot=menu-sheet-item]",
      ),
    );
    expect(rows.map((b) => b.textContent)).toEqual(["수정", "이동", "삭제"]);
    expect(rows[1]!.disabled).toBe(true);
    expect(document.querySelector("[data-testid=suffix]")).toBeNull();
  });

  it("고르면 두 표면 모두 닫힌 뒤 같은 onSelect 를 부른다", async () => {
    wide = false;
    const onSelect = vi.fn();
    render(<Both onSelect={onSelect} />);
    await click(document.querySelector("[data-slot=menu-sheet-trigger]")!);
    await tick();
    await click(
      Array.from(
        document.querySelectorAll<HTMLElement>("[data-slot=menu-sheet-item]"),
      ).find((b) => b.textContent === "수정")!,
    );
    await tick(1100);
    expect(onSelect).toHaveBeenCalledWith("수정");
  });
});
