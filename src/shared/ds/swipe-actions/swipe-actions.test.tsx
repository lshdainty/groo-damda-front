// Swipe Actions 의 동작 — 모양 · 색은 scripts/check-ds-spec.mjs 가 크로미움에서 스펙 값과 맞춘다.
// 가짜 포인터(pointerdown · pointermove · pointerup)로 문턱 · 축 · 한 번에 한 줄 · 스크롤 · 클릭 삼키기를 잠근다.
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SwipeActions,
  SwipeActionsProvider,
  type SwipeAction,
} from "./swipe-actions";
import {
  SWIPE_AXIS_RATIO,
  SWIPE_CLOSE_THRESHOLD,
  SWIPE_DEAD_ZONE,
  SWIPE_OPEN_THRESHOLD,
  clampOffset,
  resolveAxis,
  settleOpen,
  swipeActionVariants,
  swipeBadgeVariants,
  swipeLabelWidth,
  swipeTextScale,
  swipeSlotWidth,
  swipeTrayWidth,
} from "./swipe-actions-variants";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
  }
  // 1280 미만 — jsdom 에는 matchMedia 가 없다
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
  await new Promise((r) => setTimeout(r, 100));
});

const render = (node: ReactNode) => act(() => root.render(node));
const noop = () => {};

const pin = (onSelect = noop): SwipeAction => ({
  kind: "neutral",
  label: "고정",
  onSelect,
});
const edit = (onSelect = noop): SwipeAction => ({
  kind: "primary",
  label: "수정",
  onSelect,
});
const del = (onSelect = noop): SwipeAction => ({
  kind: "destructive",
  label: "삭제",
  onSelect,
});

const wrappers = () =>
  Array.from(
    container.querySelectorAll<HTMLElement>("[data-slot=swipe-actions]"),
  );
const rowOf = (w: HTMLElement) =>
  w.querySelector<HTMLElement>("[data-slot=swipe-actions-row]")!;
const trayOf = (w: HTMLElement) =>
  w.querySelector<HTMLElement>("[data-slot=swipe-actions-tray]")!;
const cellsOf = (w: HTMLElement) =>
  Array.from(w.querySelectorAll<HTMLButtonElement>("[data-slot=swipe-action]"));
const stateOf = (w: HTMLElement) => w.dataset.state;
const offsetOf = (w: HTMLElement) =>
  /\*\s*(-?[\d.]+)px/.exec(rowOf(w).style.transform)?.[1];

// 가짜 포인터 — jsdom 의 MouseEvent 에 포인터 이름을 붙인다(clientX · clientY 만 쓴다)
const fire = (el: Element, type: string, x: number, y: number) =>
  el.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
    }),
  );

/** 줄을 (dx, dy) 만큼 끌었다 놓는다 — 여러 걸음으로 나눠 움직인다(데드존 · 축 판정이 처음 몇 걸음에 걸린다) */
const drag = (w: HTMLElement, dx: number, dy = 0, { release = true } = {}) =>
  act(() => {
    const row = rowOf(w);
    fire(row, "pointerdown", 200, 200);
    for (let i = 1; i <= 10; i++) {
      fire(row, "pointermove", 200 + (dx * i) / 10, 200 + (dy * i) / 10);
    }
    if (release) fire(row, "pointerup", 200 + dx, 200 + dy);
  });

/** 손가락으로 톡 — 새 제스처가 시작되고(이전 끌기의 삼키기가 풀린다) 놓은 뒤 click */
const tap = (w: HTMLElement, target: Element) =>
  act(() => {
    const row = rowOf(w);
    fire(row, "pointerdown", 200, 200);
    fire(row, "pointerup", 200, 200);
    target.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  });

function List({
  actions = [edit(), del()],
  enabled = true,
  rows = ["스타벅스"],
  onRowClick = noop,
}: {
  actions?: SwipeAction[];
  enabled?: boolean;
  rows?: string[];
  onRowClick?: (title: string) => void;
}) {
  return (
    <SwipeActionsProvider>
      {rows.map((title) => (
        <SwipeActions
          key={title}
          actions={actions}
          enabled={enabled}
          rowLabel={title}
        >
          <button type="button" onClick={() => onRowClick(title)}>
            {title}
          </button>
        </SwipeActions>
      ))}
    </SwipeActionsProvider>
  );
}

describe("크기 · 판정 값(스펙)", () => {
  it("칸 폭은 첫 칸 56 · 다음부터 48, 트레이는 56 · 104 · 152", () => {
    expect([0, 1, 2].map((i) => swipeSlotWidth(i))).toEqual([56, 48, 48]);
    expect([1, 2, 3].map(swipeTrayWidth)).toEqual([56, 104, 152]);
  });

  it("데드존 8 · 축 1.5배 · 열기 40% · 닫기 25%", () => {
    expect(SWIPE_DEAD_ZONE).toBe(8);
    expect(SWIPE_AXIS_RATIO).toBe(1.5);
    expect(SWIPE_OPEN_THRESHOLD).toBe(0.4);
    expect(SWIPE_CLOSE_THRESHOLD).toBe(0.25);
  });

  it("데드존 안(8 미만)에서는 축을 정하지 않는다", () => {
    expect(resolveAxis(5, 5)).toBe("none");
    expect(resolveAxis(-7, 0)).toBe("none");
    expect(resolveAxis(-8, 0)).toBe("x");
  });

  it("축 경계 — 1.5배를 넘어야 가로(같으면 세로)", () => {
    expect(resolveAxis(30, 20)).toBe("y");
    expect(resolveAxis(31, 20)).toBe("x");
    expect(resolveAxis(20, 20)).toBe("y");
    expect(resolveAxis(3, 40)).toBe("y");
  });

  it("끄는 거리는 0 ~ 트레이 폭에서 멈춘다 — 더 밀어도 움직이지 않고 반대로 밀면 0", () => {
    expect(clampOffset(500, 104)).toBe(104);
    expect(clampOffset(-30, 104)).toBe(0);
    expect(clampOffset(50, 104)).toBe(50);
  });

  it("닫힌 줄은 트레이 폭의 40% 이상에서 열린다(둘이면 41.6)", () => {
    expect(settleOpen(false, 41.5, 104)).toBe(false);
    expect(settleOpen(false, 41.6, 104)).toBe(true);
  });

  it("열린 줄은 되돌려 민 거리가 25% 이상이면 닫힌다(둘이면 26) — 여는 문턱을 같이 걸지 않는다", () => {
    expect(settleOpen(true, 104 - 25, 104)).toBe(true);
    expect(settleOpen(true, 104 - 26, 104)).toBe(false);
    // 40% 만 되돌려도 닫힌다 — 같은 문턱이면 이 범위가 맞물려 열리지 않는다
    expect(settleOpen(true, 104 * 0.6, 104)).toBe(false);
  });
});

describe("밀기", () => {
  it("40% 이상 밀고 놓으면 열린 채로 자리를 잡는다 — 트레이 폭만큼 물러난다", async () => {
    await render(<List />);
    const [w] = wrappers();
    await drag(w!, -60);
    expect(stateOf(w!)).toBe("open");
    expect(offsetOf(w!)).toBe("104");
  });

  it("40% 미만이면 닫힌다", async () => {
    await render(<List />);
    const [w] = wrappers();
    await drag(w!, -30);
    expect(stateOf(w!)).toBe("closed");
    expect(offsetOf(w!)).toBe("0");
  });

  it("끄는 동안은 손가락을 1:1 로 따라가고 모션이 없다", async () => {
    await render(<List />);
    const [w] = wrappers();
    await drag(w!, -50, 0, { release: false });
    expect(offsetOf(w!)).toBe("50");
    expect(rowOf(w!).className).not.toContain("transition");
    // 놓으면 자리를 잡는 전환(150ms · 감속)이 붙는다 — 모션 줄이기면 바로
    await act(() => fire(rowOf(w!), "pointerup", 150, 200));
    expect(rowOf(w!).className).toContain("--motion-duration-d3");
    expect(rowOf(w!).className).toContain("--motion-ease-enter");
    expect(rowOf(w!).className).toContain("motion-reduce:[transition:none]");
  });

  it("최대 이동은 트레이 폭이다 — 끝까지 밀어도 동작은 실행하지 않고 열릴 뿐", async () => {
    const onSelect = vi.fn();
    await render(<List actions={[edit(onSelect), del(onSelect)]} />);
    const [w] = wrappers();
    await drag(w!, -400);
    expect(offsetOf(w!)).toBe("104");
    expect(stateOf(w!)).toBe("open");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("오른쪽으로 끌면 아무 일도 없다", async () => {
    await render(<List />);
    const [w] = wrappers();
    await drag(w!, 80);
    expect(stateOf(w!)).toBe("closed");
    expect(offsetOf(w!)).toBe("0");
  });

  it("데드존(8) 안의 움직임은 누르기다", async () => {
    await render(<List />);
    const [w] = wrappers();
    await drag(w!, -6);
    expect(stateOf(w!)).toBe("closed");
    expect(offsetOf(w!)).toBe("0");
  });

  it("세로로 확정되면 이번 제스처는 포기한다 — 도중에 가로가 돼도 줄이 흔들리지 않는다", async () => {
    await render(<List />);
    const [w] = wrappers();
    await act(() => {
      const row = rowOf(w!);
      fire(row, "pointerdown", 200, 200);
      fire(row, "pointermove", 200, 240); // 세로로 확정
      fire(row, "pointermove", 80, 240); // 가로로 길게 끌어도
      fire(row, "pointerup", 80, 240);
    });
    expect(stateOf(w!)).toBe("closed");
    expect(offsetOf(w!)).toBe("0");
  });

  it("비스듬히(기울기 1.5배 안) 밀어도 가로로 받아 연다", async () => {
    await render(<List />);
    const [w] = wrappers();
    await drag(w!, -75, 40); // 75 > 60
    expect(stateOf(w!)).toBe("open");
  });

  it("열린 줄은 되돌려 25% 이상 밀면 닫히고, 그보다 적으면 열린 채로 있다", async () => {
    await render(<List />);
    const [w] = wrappers();
    await drag(w!, -80);
    expect(stateOf(w!)).toBe("open");
    await drag(w!, 20); // 되돌린 거리 20 < 26
    expect(stateOf(w!)).toBe("open");
    await drag(w!, 30); // 30 ≥ 26
    expect(stateOf(w!)).toBe("closed");
  });

  it("RTL 은 반대 — 오른쪽으로 밀어 연다(줄이 움직이는 쪽의 부호가 뒤집힌다)", async () => {
    container.setAttribute("dir", "rtl");
    container.style.direction = "rtl";
    await render(<List />);
    const [w] = wrappers();
    expect(w!.className).toContain("rtl:[--swipe-dir:1]");
    expect(w!.className).toContain("[--swipe-dir:-1]");
    await drag(w!, 60);
    // jsdom 이 direction 을 물려 주면 RTL 로 읽어 열리고, 아니면 LTR 로 읽어 오른쪽 끌기는 아무 일이 없다 — 클래스는 위에서 잠겼다
    const rtl = getComputedStyle(rowOf(w!)).direction === "rtl";
    expect(stateOf(w!)).toBe(rtl ? "open" : "closed");
  });
});

describe("한 번에 한 줄 · 스크롤", () => {
  it("다른 줄을 끌기 시작하면 열려 있던 줄이 닫힌다", async () => {
    await render(<List rows={["스타벅스", "쿠팡"]} />);
    const [a, b] = wrappers();
    await drag(a!, -80);
    expect(stateOf(a!)).toBe("open");
    await drag(b!, -80, 0, { release: false });
    expect(stateOf(a!)).toBe("closed");
    expect(offsetOf(a!)).toBe("0");
  });

  it("열린 줄은 둘이 될 수 없다", async () => {
    await render(<List rows={["스타벅스", "쿠팡", "지하철"]} />);
    const ws = wrappers();
    for (const w of ws) await drag(w, -80);
    expect(ws.map(stateOf)).toEqual(["closed", "closed", "open"]);
  });

  it("목록을 스크롤하면 열린 줄이 닫힌다", async () => {
    await render(<List />);
    const [w] = wrappers();
    await drag(w!, -80);
    expect(stateOf(w!)).toBe("open");
    await act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(stateOf(w!)).toBe("closed");
  });

  it("안쪽 목록의 스크롤도(캡처) 닫는다", async () => {
    await render(<List />);
    const [w] = wrappers();
    await drag(w!, -80);
    await act(() => {
      document.body.dispatchEvent(new Event("scroll", { bubbles: false }));
    });
    expect(stateOf(w!)).toBe("closed");
  });

  it("조상(Provider) 없이도 한 줄은 열고 닫힌다", async () => {
    await render(
      <SwipeActions actions={[del()]} rowLabel="스타벅스">
        <span>줄</span>
      </SwipeActions>,
    );
    const [w] = wrappers();
    await drag(w!, -30); // 56 의 40% = 22.4
    expect(stateOf(w!)).toBe("open");
  });
});

describe("누르기", () => {
  it("닫힌 줄을 누르면 원래 동작(상세)으로 간다", async () => {
    const onRowClick = vi.fn();
    await render(<List onRowClick={onRowClick} />);
    const [w] = wrappers();
    await act(() =>
      w!
        .querySelector("button[type=button]:not([data-slot])")!
        .dispatchEvent(new MouseEvent("click", { bubbles: true })),
    );
    expect(onRowClick).toHaveBeenCalledWith("스타벅스");
  });

  it("열린 채 줄을 누르면 닫기만 한다 — 상세로 들어가지 않는다", async () => {
    const onRowClick = vi.fn();
    await render(<List onRowClick={onRowClick} />);
    const [w] = wrappers();
    await drag(w!, -80);
    await tap(w!, w!.querySelector("button[type=button]:not([data-slot])")!);
    expect(stateOf(w!)).toBe("closed");
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("밀고 난 뒤 따라오는 click 은 삼킨다 — 밀고서 상세로 들어가지 않고, 열린 줄이 바로 닫히지도 않는다", async () => {
    const onRowClick = vi.fn();
    await render(<List onRowClick={onRowClick} />);
    const [w] = wrappers();
    const target = w!.querySelector("button[type=button]:not([data-slot])")!;
    await drag(w!, -80);
    await act(() =>
      target.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      ),
    );
    expect(stateOf(w!)).toBe("open");
    expect(onRowClick).not.toHaveBeenCalled();
    // 삼킨 건 그 끌기 뒤 한 번뿐 — 다음 누르기(새 제스처)는 닫기다
    await tap(w!, target);
    expect(stateOf(w!)).toBe("closed");
    expect(onRowClick).not.toHaveBeenCalled();
    // 닫힌 뒤 누르기는 원래 동작이다
    await tap(w!, target);
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it("밀다가 닫힌 채 놓아도 click 은 상세로 가지 않는다", async () => {
    const onRowClick = vi.fn();
    await render(<List onRowClick={onRowClick} />);
    const [w] = wrappers();
    await drag(w!, -20);
    await act(() =>
      w!
        .querySelector("button[type=button]:not([data-slot])")!
        .dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true }),
        ),
    );
    expect(onRowClick).not.toHaveBeenCalled();
  });
});

describe("동작 칸 · 접근성", () => {
  it("뒤집어 그린다 — 가장 안쪽(화면에서 가장 왼쪽)이 삭제, 부르는 쪽은 뜻의 차례 그대로", async () => {
    await render(<List actions={[pin(), edit(), del()]} />);
    const [w] = wrappers();
    expect(cellsOf(w!).map((c) => c.textContent)).toEqual([
      "삭제",
      "수정",
      "고정",
    ]);
  });

  it('동작 이름은 "라벨: 줄 제목" — 줄 제목이 없으면 라벨만', async () => {
    await render(
      <>
        <List />
        <SwipeActions actions={[del()]}>
          <span>줄</span>
        </SwipeActions>
      </>,
    );
    const [a, b] = wrappers();
    expect(cellsOf(a!).map((c) => c.getAttribute("aria-label"))).toEqual([
      "삭제: 스타벅스",
      "수정: 스타벅스",
    ]);
    expect(cellsOf(b!)[0]!.getAttribute("aria-label")).toBe("삭제");
  });

  it("닫힌 트레이는 aria-hidden · 버튼 tabindex -1, 열리면 보이고 초점을 받는다", async () => {
    await render(<List />);
    const [w] = wrappers();
    expect(trayOf(w!).getAttribute("aria-hidden")).toBe("true");
    expect(cellsOf(w!).every((c) => c.tabIndex === -1)).toBe(true);
    await drag(w!, -80);
    expect(trayOf(w!).getAttribute("aria-hidden")).toBe("false");
    expect(cellsOf(w!).every((c) => c.tabIndex === 0)).toBe(true);
  });

  it("줄은 초점을 받을 수 있다(tabindex -1) — Esc 로 돌아올 자리", async () => {
    await render(<List />);
    const [w] = wrappers();
    expect(rowOf(w!).tabIndex).toBe(-1);
  });

  it("동작을 누르면 트레이를 닫고 onSelect 를 한 번 부른다", async () => {
    const onSelect = vi.fn();
    await render(<List actions={[edit(), del(onSelect)]} />);
    const [w] = wrappers();
    await drag(w!, -80);
    await act(() =>
      cellsOf(w!)[0]!.dispatchEvent(new MouseEvent("click", { bubbles: true })),
    );
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(stateOf(w!)).toBe("closed");
  });

  it("막힌 동작은 눌리지 않는다", async () => {
    const onSelect = vi.fn();
    await render(<List actions={[{ ...del(onSelect), disabled: true }]} />);
    const [w] = wrappers();
    await drag(w!, -40);
    const cell = cellsOf(w!)[0]!;
    expect(cell.disabled).toBe(true);
    await act(() => cell.click());
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("열린 트레이를 Esc 로 닫으면 초점이 줄로 간다 — 숨긴 트레이 버튼에 남지 않는다", async () => {
    await render(<List />);
    const [w] = wrappers();
    await drag(w!, -80);
    await act(() => cellsOf(w!)[0]!.focus());
    await act(() => {
      cellsOf(w!)[0]!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(stateOf(w!)).toBe("closed");
    expect(document.activeElement).toBe(rowOf(w!));
  });

  it("닫혀 있을 때의 Esc 는 건드리지 않는다", async () => {
    await render(<List />);
    const [w] = wrappers();
    const spy = vi.spyOn(rowOf(w!), "focus");
    await act(() => {
      w!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("통과 — enabled · 빈 동작", () => {
  it("enabled={false}(768 이상)는 감싸기를 걷어 줄만 그린다", async () => {
    await render(<List enabled={false} />);
    expect(wrappers()).toHaveLength(0);
    expect(container.textContent).toBe("스타벅스");
  });

  it("actions 가 비면(행 단위로 동작이 성립하지 않는 줄) 트레이 없이 줄만 그린다", async () => {
    await render(<List actions={[]} />);
    expect(wrappers()).toHaveLength(0);
    expect(container.textContent).toBe("스타벅스");
  });
});

describe("모양 클래스(스펙) — 잴 수 없는 값", () => {
  it("라벨 12 / 700 / 1.3, 칸 최소 높이 56, 호버 · 누름은 밝기 88% 뿐(움직이지 않는다)", () => {
    const cls = swipeActionVariants({ kind: "neutral" });
    expect(cls).toContain("text-t2");
    expect(cls).toContain("font-bold");
    expect(cls).toContain("leading-[1.3]");
    expect(cls).toContain("min-h-[56px]");
    expect(cls).toContain("hover:brightness-[0.88]");
    expect(cls).toContain("active:brightness-[0.88]");
    expect(cls).not.toMatch(/scale|translate/);
  });

  it("라벨 색 — neutral · primary 는 fg-neutral-muted, destructive 만 fg-critical", () => {
    expect(swipeActionVariants({ kind: "neutral" })).toContain(
      "text-fg-neutral-muted",
    );
    expect(swipeActionVariants({ kind: "primary" })).toContain(
      "text-fg-neutral-muted",
    );
    expect(swipeActionVariants({ kind: "destructive" })).toContain(
      "text-fg-critical",
    );
  });

  it("키보드 링은 칸 안쪽 2px(트레이 바깥으로 나가면 줄 경계에서 잘린다)", () => {
    const cls = swipeActionVariants({});
    expect(cls).toContain("focus-visible:outline-2");
    expect(cls).toContain("focus-visible:-outline-offset-2");
  });

  it("배지 색 — primary · destructive 는 글자색 채움 + 반전 아이콘, neutral 은 옅은 바탕 + 안쪽 1px 테두리, 막힘은 전용 색(neutral 테두리는 남는다)", () => {
    expect(swipeBadgeVariants({ kind: "primary" })).toContain(
      "bg-fg-informative",
    );
    expect(swipeBadgeVariants({ kind: "primary" })).toContain(
      "text-fg-neutral-inverted",
    );
    expect(swipeBadgeVariants({ kind: "destructive" })).toContain(
      "bg-fg-critical",
    );
    expect(swipeBadgeVariants({ kind: "neutral" })).toContain(
      "bg-bg-neutral-weak",
    );
    const ring = "inset_0_0_0_1px_var(--color-stroke-neutral-weak)";
    expect(swipeBadgeVariants({ kind: "neutral" })).toContain(ring);
    // 막히면 바탕 · 아이콘만 전용 색 — 채움 색은 걷고, neutral 의 안쪽 1px 은 남긴다
    for (const kind of ["neutral", "primary", "destructive"] as const) {
      const off = swipeBadgeVariants({ kind, disabled: true });
      expect(off).toContain("bg-bg-disabled");
      expect(off).toContain("text-fg-disabled");
      expect(off).not.toContain("bg-fg-informative");
      expect(off).not.toContain("bg-fg-critical");
      expect(off).not.toContain("bg-bg-neutral-weak");
      expect(off.includes(ring)).toBe(kind === "neutral");
    }
    // 짙은 채움(다크에서 줄 바탕과 2.51)을 쓰지 않는다
    expect(swipeBadgeVariants({ kind: "destructive" })).not.toContain(
      "bg-critical-solid",
    );
    expect(swipeBadgeVariants({ kind: "primary" })).not.toContain(
      "bg-informative-solid",
    );
  });

  it("칸 폭 — 첫 칸 56(앞 20 + 배지 36) · 다음부터 48, 칸 안쪽 간격은 앞에만", async () => {
    await render(<List actions={[pin(), edit(), del()]} />);
    const [w] = wrappers();
    const cells = cellsOf(w!);
    expect(cells.map((c) => c.style.inlineSize)).toEqual([
      "56px",
      "48px",
      "48px",
    ]);
    expect(cells.map((c) => c.style.paddingInlineStart)).toEqual([
      "20px",
      "12px",
      "12px",
    ]);
    expect(cells.every((c) => c.style.minBlockSize === "56px")).toBe(true);
  });

  it("트레이는 칠하지 않는다 — 바탕 클래스가 없다", async () => {
    await render(<List />);
    const [w] = wrappers();
    expect(trayOf(w!).className).not.toMatch(/\bbg-/);
  });

  it("미는 동안 글 고르기 · 길게 누름 메뉴를 막고 세로 스크롤은 브라우저에 남긴다", async () => {
    await render(<List />);
    const [w] = wrappers();
    expect(w!.className).toContain("touch-pan-y");
    expect(w!.className).toContain("select-none");
    expect(w!.className).toContain("[-webkit-touch-callout:none]");
  });
});

describe("라벨 폭 — 영어 · 긴 글은 칸이 글 폭만큼 넓어진다(최소 배지 36, 한국어는 그대로)", () => {
  it("한국어 두 글자 동사는 배지 안에 들어 칸이 56 · 48 그대로다", () => {
    expect(swipeLabelWidth("수정")).toBeLessThanOrEqual(36);
    expect([0, 1, 2].map((i) => swipeSlotWidth(i, "삭제"))).toEqual([
      56, 48, 48,
    ]);
    expect(swipeTrayWidth(["삭제", "수정"])).toBe(104);
  });

  it('영어 "Delete" 는 배지(36)보다 넓어 칸이 넓어지고, 트레이 폭도 따라간다', () => {
    expect(swipeLabelWidth("Delete")).toBeGreaterThan(36);
    expect(swipeSlotWidth(0, "Delete")).toBeGreaterThan(56);
    expect(swipeTrayWidth(["Delete", "Edit"])).toBeGreaterThan(104);
  });

  it("글자 크기 200%(루트 32px)면 한국어 '삭제' 도 48 이 되어 칸이 넓어지고, 칸 style 도 따라간다", async () => {
    const root = document.documentElement;
    root.style.fontSize = "32px";
    try {
      expect(swipeTextScale()).toBe(2);
      expect(swipeLabelWidth("삭제")).toBe(48);
      expect(swipeSlotWidth(0, "삭제")).toBe(68);
      expect(swipeSlotWidth(0, "Delete")).toBeGreaterThan(
        swipeSlotWidth(0, "삭제"),
      );
      const host = document.createElement("div");
      document.body.appendChild(host);
      const r = createRoot(host);
      await act(async () =>
        r.render(
          <SwipeActions
            actions={[
              { kind: "destructive", label: "삭제", onSelect: () => {} },
            ]}
          >
            <div>row</div>
          </SwipeActions>,
        ),
      );
      const cell = host.querySelector<HTMLElement>("[data-slot=swipe-action]")!;
      expect(parseFloat(cell.style.inlineSize)).toBe(68);
      act(() => r.unmount());
      host.remove();
    } finally {
      root.style.fontSize = "";
    }
  });

  it("칸 폭은 글 폭을 따라 style 로 들어간다 — 라벨이 두 줄로 꺾이지 않는다", async () => {
    window.history.replaceState(null, "");
    const host = document.createElement("div");
    document.body.appendChild(host);
    const r = createRoot(host);
    await act(async () =>
      r.render(
        <SwipeActions
          actions={[
            { kind: "primary", label: "Edit", onSelect: () => {} },
            { kind: "destructive", label: "Delete", onSelect: () => {} },
          ]}
        >
          <div>row</div>
        </SwipeActions>,
      ),
    );
    const cells = host.querySelectorAll<HTMLElement>(
      "[data-slot=swipe-action]",
    );
    // 안쪽(Delete)이 첫 칸이다 — 56 보다 넓다
    expect(parseFloat(cells[0]!.style.inlineSize)).toBeGreaterThan(56);
    act(() => r.unmount());
    host.remove();
  });
});

describe("다른 줄이 열려 있을 때 · 화면이 바뀔 때 · 높이", () => {
  it("다른 줄이 열려 있는데 이 줄을 누르면 열린 줄을 닫기만 하고 이 누름은 먹지 않는다(swipe-actions.md:175)", async () => {
    const onRowClick = vi.fn();
    await render(<List rows={["스타벅스", "쿠팡"]} onRowClick={onRowClick} />);
    const [a, b] = wrappers();
    await drag(a!, -80);
    expect(stateOf(a!)).toBe("open");
    await tap(b!, b!.querySelector("button[type=button]:not([data-slot])")!);
    expect(stateOf(a!)).toBe("closed");
    expect(onRowClick).not.toHaveBeenCalled();
    // 닫힌 뒤의 다음 누름은 먹는다
    await tap(b!, b!.querySelector("button[type=button]:not([data-slot])")!);
    expect(onRowClick).toHaveBeenCalledWith("쿠팡");
  });

  it("closeKey 가 바뀌면(화면을 옮기면) 열린 줄이 닫힌다 — 줄은 그대로여도", async () => {
    const tree = (key: string) => (
      <SwipeActionsProvider closeKey={key}>
        <SwipeActions actions={[edit(), del()]} rowLabel="스타벅스">
          <button type="button">스타벅스</button>
        </SwipeActions>
      </SwipeActionsProvider>
    );
    await render(tree("/a"));
    const [w] = wrappers();
    await drag(w!, -80);
    expect(stateOf(w!)).toBe("open");
    await render(tree("/a"));
    expect(stateOf(w!)).toBe("open");
    await render(tree("/b"));
    expect(stateOf(w!)).toBe("closed");
  });

  it("줄과 트레이는 같은 칸에 겹쳐 쌓여 높이가 둘 중 큰 쪽이다 — 줄 최소 56, 잘려 나가지 않는다", async () => {
    await render(<List />);
    const [w] = wrappers();
    expect(w!.className).toMatch(/\bgrid\b/);
    expect(trayOf(w!).className).not.toMatch(/\babsolute\b/);
    expect(trayOf(w!).className).toMatch(/col-start-1 row-start-1/);
    expect(rowOf(w!).className).toMatch(/col-start-1 row-start-1/);
    expect(rowOf(w!).className).toMatch(/min-h-14/);
  });
});
