// Table Pagination 의 동작 — 모양 · 색은 scripts/check-ds-spec.mjs 가 크로미움에서 스펙 값과 맞춘다.
import { act, createRef, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TablePagination, type TablePaginationValue } from "./table-pagination";
import {
  clampPage,
  formatRange,
  knownRange,
  rangePages,
} from "./table-pagination-variants";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  // Radix Select 가 요구하는 jsdom 빈자리
  Element.prototype.scrollIntoView ??= () => {};
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(node: ReactNode) {
  act(() => root.render(node));
  return container.firstElementChild as HTMLElement;
}

const one = <T extends HTMLElement = HTMLElement>(selector: string) =>
  container.querySelector<T>(selector)!;
const arrow = (which: "previous" | "next") =>
  one<HTMLButtonElement>(`[data-slot=table-pagination-${which}]`);
const click = (el: Element) => act(() => (el as HTMLElement).click());
const status = () => one("[data-slot=table-pagination-status]").textContent;
const rangeText = () =>
  one("div[data-slot=table-pagination-range] [data-slot=select-value]")
    .textContent;

// 값이 바뀌는 줄 — 제어
function Controlled({
  totalItems,
  initial,
  onChange,
  scrollTarget,
}: {
  totalItems: number;
  initial: TablePaginationValue;
  onChange?: (v: TablePaginationValue, reason: string) => void;
  scrollTarget?: React.RefObject<HTMLElement | null>;
}) {
  const [value, setValue] = useState(initial);
  return (
    <TablePagination
      totalItems={totalItems}
      value={value}
      scrollTarget={scrollTarget}
      onValueChange={(v, d) => {
        setValue(v);
        onChange?.(v, d.reason);
      }}
    />
  );
}

describe("TablePagination — 구조 · 이름", () => {
  it('줄은 role=group "표 페이지 탐색", 고르기 둘 · 화살표 둘의 이름은 스펙 문구', () => {
    const group = render(<TablePagination totalItems={237} />);
    expect(group.getAttribute("role")).toBe("group");
    expect(group.getAttribute("aria-label")).toBe("표 페이지 탐색");
    const selects = Array.from(
      container.querySelectorAll<HTMLElement>("[data-slot=select-trigger]"),
    );
    expect(selects.map((s) => s.getAttribute("aria-label"))).toEqual([
      "페이지당 표시 개수",
      "표시 범위",
    ]);
    expect(arrow("previous").getAttribute("aria-label")).toBe("이전 페이지");
    expect(arrow("next").getAttribute("aria-label")).toBe("다음 페이지");
    expect(one("[data-slot=table-pagination-suffix]").textContent).toBe(
      "씩 보기",
    );
  });

  it("영어를 쓰지 않는다", () => {
    render(<TablePagination totalItems={237} />);
    expect(container.textContent).not.toMatch(/rows?|page \d|go to/i);
  });

  it("한 줄 최소 40 · 줄바꿈 없음 · 양 끝 정렬 · 내용 폭보다 줄지 않는다 · 표 아래 12", () => {
    const group = render(<TablePagination totalItems={237} />);
    // 높이는 최소값 — 큰 글자에서 고르기 · 글을 따라 높아진다(table-pagination.yaml root.minHeight). 고정 높이면 글이 잘린다
    expect(group.classList.contains("min-h-[40px]")).toBe(true);
    expect(group.classList.contains("h-[40px]")).toBe(false);
    for (const c of [
      "flex-nowrap",
      "justify-between",
      "gap-x4",
      "min-w-max",
      "mt-component-default",
    ])
      expect(group.className).toContain(c);
  });

  it("고르기 둘은 Select medium(트리거 40) · 최소 폭 96 이고 범위 목록은 최대 높이 240", () => {
    render(<TablePagination totalItems={237} />);
    for (const t of container.querySelectorAll<HTMLElement>(
      "[data-slot=select-trigger]",
    ))
      expect(t.closest("[data-size]")!.getAttribute("data-size")).toBe(
        "medium",
      );
    for (const box of container.querySelectorAll<HTMLElement>(
      "[data-slot=table-pagination-page-size] > div, div[data-slot=table-pagination-range] > div",
    ))
      expect(box.className).toContain("min-w-[96px]");
  });

  it("ref 와 className · 나머지 속성을 줄에 넘긴다", () => {
    const ref = createRef<HTMLDivElement>();
    const group = render(
      <TablePagination
        ref={ref}
        totalItems={10}
        className="mt-0"
        data-testid="pg"
      />,
    );
    expect(ref.current).toBe(group);
    expect(group.className).toContain("mt-0");
    expect(group.dataset.testid).toBe("pg");
  });
});

describe("TablePagination — 전체 수", () => {
  it('전체 수를 알면 범위 고르기 + "/ 총 N개" — 수는 세 자리마다 쉼표', () => {
    render(
      <TablePagination
        totalItems={1240}
        defaultValue={{ page: 2, pageSize: 10 }}
      />,
    );
    expect(rangeText()).toBe("11-20");
    expect(one("[data-slot=table-pagination-total]").textContent).toBe(
      "/ 총 1,240개",
    );
    expect(one("[data-slot=table-pagination-total]").className).toContain(
      "tabular-nums",
    );
  });

  it('모르면 범위는 글로만 — 고르기도 "/ 총" 도 없다', () => {
    render(
      <TablePagination
        hasPreviousPage
        hasNextPage
        currentPageItemCount={10}
        defaultValue={{ page: 2, pageSize: 10 }}
      />,
    );
    const range = one("[data-slot=table-pagination-range]");
    expect(range.tagName).toBe("SPAN");
    expect(range.textContent).toBe("11-20");
    expect(one("[data-slot=table-pagination-total]")).toBeNull();
    expect(
      container.querySelectorAll("[data-slot=select-trigger]"),
    ).toHaveLength(1);
  });

  it("모르는데 마지막 범위가 덜 찼으면 실제 줄 수까지", () => {
    render(
      <TablePagination
        hasPreviousPage
        hasNextPage={false}
        currentPageItemCount={4}
        defaultValue={{ page: 3, pageSize: 10 }}
      />,
    );
    expect(one("[data-slot=table-pagination-range]").textContent).toBe("21-24");
    expect(arrow("next").getAttribute("aria-disabled")).toBe("true");
    expect(arrow("previous").getAttribute("aria-disabled")).toBeNull();
  });

  it('빈 표(0개)는 "0-0" · 둘 다 막히고 범위 고르기도 막힌다 — 줄 수는 바꿀 수 있다', () => {
    render(<TablePagination totalItems={0} />);
    expect(rangeText()).toBe("0-0");
    expect(arrow("previous").getAttribute("aria-disabled")).toBe("true");
    expect(arrow("next").getAttribute("aria-disabled")).toBe("true");
    const [sizeTrigger, rangeTrigger] = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        "[data-slot=select-trigger]",
      ),
    );
    expect(rangeTrigger!.disabled).toBe(true);
    expect(sizeTrigger!.disabled).toBe(false);
  });

  it("1억이 넘는 건수도 범위를 한 줄로 보인다", () => {
    render(
      <TablePagination
        totalItems={123_456_789}
        defaultValue={{ page: 61_728, pageSize: 100 }}
      />,
    );
    expect(rangeText()).toBe("6,172,701-6,172,800");
    expect(one("[data-slot=table-pagination-total]").textContent).toBe(
      "/ 총 123,456,789개",
    );
  });
});

describe("TablePagination — 이전 · 다음", () => {
  it("끝에서는 숨기지 않고 막는다 — aria-disabled 라 초점이 그 자리에 남고, 눌러도 아무 일이 없다", () => {
    const onChange = vi.fn();
    render(<TablePagination totalItems={237} onValueChange={onChange} />);
    const prev = arrow("previous");
    expect(prev.getAttribute("aria-disabled")).toBe("true");
    expect(prev.disabled).toBe(false);
    expect(prev.className).toContain("text-fg-disabled");
    expect(prev.className).toContain("cursor-not-allowed");
    prev.focus();
    expect(document.activeElement).toBe(prev);
    click(prev);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("다음 · 이전으로 한 범위씩 — reason 을 알린다", () => {
    const calls: [TablePaginationValue, string][] = [];
    render(
      <Controlled
        totalItems={237}
        initial={{ page: 1, pageSize: 10 }}
        onChange={(v, r) => calls.push([v, r])}
      />,
    );
    click(arrow("next"));
    click(arrow("next"));
    click(arrow("previous"));
    expect(calls).toEqual([
      [{ page: 2, pageSize: 10 }, "next"],
      [{ page: 3, pageSize: 10 }, "next"],
      [{ page: 2, pageSize: 10 }, "previous"],
    ]);
    expect(rangeText()).toBe("11-20");
  });

  it("마지막 범위에서는 다음이 막히고 초점은 막힌 버튼에 남는다", () => {
    render(
      <Controlled totalItems={237} initial={{ page: 23, pageSize: 10 }} />,
    );
    const next = arrow("next");
    next.focus();
    click(next);
    expect(rangeText()).toBe("231-237");
    expect(next.getAttribute("aria-disabled")).toBe("true");
    expect(document.activeElement).toBe(next);
  });

  it("화살표는 40 · 모서리 8 · 아이콘 16 · 누르는 영역은 위아래만 44 · 누르면 2px 거리 축소(모션 줄이기면 색만)", () => {
    render(
      <TablePagination
        totalItems={237}
        defaultValue={{ page: 3, pageSize: 10 }}
      />,
    );
    const next = arrow("next");
    for (const c of [
      "size-[40px]",
      "rounded-r2",
      "[&>svg]:size-[16px]",
      "before:inset-y-[-2px]",
      "hover:bg-bg-layer-default-pressed",
      "active:bg-bg-layer-default-pressed",
      "active:[scale:calc(1-2/40)]",
      "motion-reduce:active:[scale:1]",
      "focus-visible:outline-offset-2",
    ])
      expect(next.className).toContain(c);
    expect(next.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("TablePagination — 줄 수 · 범위", () => {
  // 고르기를 열어 그 선택지를 누른다 — 목록은 문서 끝에 뜬다
  const triggerAt = (i: number) =>
    Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        "[data-slot=select-trigger]",
      ),
    )[i]!;
  const pick = (i: number, label: string) => {
    act(() => {
      triggerAt(i).dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowDown",
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    const item = Array.from(
      document.querySelectorAll<HTMLElement>("[data-slot=select-item]"),
    ).find((o) => o.textContent?.startsWith(label))!;
    click(item);
  };

  it("줄 수를 바꾸면 첫 범위로 돌아간다(reason page-size)", () => {
    const calls: [TablePaginationValue, string][] = [];
    render(
      <Controlled
        totalItems={237}
        initial={{ page: 5, pageSize: 10 }}
        onChange={(v, r) => calls.push([v, r])}
      />,
    );
    expect(rangeText()).toBe("41-50");
    pick(0, "25개");
    expect(calls).toEqual([[{ page: 1, pageSize: 25 }, "page-size"]]);
    expect(rangeText()).toBe("1-25");
    expect(status()).toBe("1-25, 총 237개");
  });

  it("범위를 고르면 그 범위로(reason page-range)", () => {
    const calls: [TablePaginationValue, string][] = [];
    render(
      <Controlled
        totalItems={237}
        initial={{ page: 1, pageSize: 10 }}
        onChange={(v, r) => calls.push([v, r])}
      />,
    );
    pick(1, "41-50");
    expect(calls).toEqual([[{ page: 5, pageSize: 10 }, "page-range"]]);
    expect(rangeText()).toBe("41-50");
  });

  it("범위 목록은 쪽마다 한 선택지(마지막은 덜 찬 범위) · 최대 높이 240", () => {
    render(
      <TablePagination
        totalItems={237}
        defaultValue={{ page: 1, pageSize: 10 }}
      />,
    );
    act(() => {
      triggerAt(1).dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowDown",
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    const items = Array.from(
      document.querySelectorAll<HTMLElement>("[data-slot=select-item]"),
    );
    expect(items).toHaveLength(24);
    expect(items[0]!.textContent).toContain("1-10");
    expect(items[23]!.textContent).toContain("231-237");
    const content = document.querySelector<HTMLElement>(
      "[data-slot=select-content]",
    )!;
    expect(content.getAttribute("style")).toContain(
      "--select-list-max-height: 240px",
    );
  });

  it("줄 수 선택지는 10 · 25 · 50 — 지금 줄 수가 목록에 없으면 더한다", () => {
    render(
      <TablePagination
        totalItems={500}
        defaultValue={{ page: 1, pageSize: 100 }}
        pageSizeOptions={[10, 25, 50]}
      />,
    );
    const [sizeTrigger] = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        "[data-slot=select-trigger]",
      ),
    );
    expect(sizeTrigger!.textContent).toBe("100개");
  });

  it("줄이 줄어 지금 범위가 없어지면 마지막 범위로 옮긴다(reason constraint) — 스크롤은 하지 않는다", () => {
    const onChange = vi.fn();
    const scrollIntoView = vi.fn();
    const target = document.createElement("div");
    target.scrollIntoView = scrollIntoView;
    const ref = { current: target };
    render(
      <TablePagination
        totalItems={237}
        value={{ page: 24, pageSize: 10 }}
        onValueChange={onChange}
        scrollTarget={ref}
      />,
    );
    expect(rangeText()).toBe("231-237");
    // 줄이 줄었다 — 같은 값에서 전체 수만 작아진다
    render(
      <TablePagination
        totalItems={42}
        value={{ page: 24, pageSize: 10 }}
        onValueChange={onChange}
        scrollTarget={ref}
      />,
    );
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      { page: 5, pageSize: 10 },
      { reason: "constraint" },
    );
    expect(rangeText()).toBe("41-42");
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("제어하지 않을 때 범위가 없어지면 스스로 마지막 범위로 옮긴다", () => {
    render(
      <TablePagination
        totalItems={237}
        defaultValue={{ page: 24, pageSize: 10 }}
      />,
    );
    render(
      <TablePagination
        totalItems={237}
        defaultValue={{ page: 24, pageSize: 10 }}
        key="same"
      />,
    );
    expect(rangeText()).toBe("231-237");
  });

  it("범위 목록의 쪽 — 200개까지 모두, 넘으면 첫 · 마지막 + 지금 둘레 198", () => {
    expect(rangePages(1, 5)).toEqual([1, 2, 3, 4, 5]);
    const many = rangePages(500, 1000);
    expect(many).toHaveLength(200);
    expect(many[0]).toBe(1);
    expect(many[199]).toBe(1000);
    expect(many).toContain(500);
    const near = rangePages(1, 1000);
    expect(near[1]).toBe(2);
    expect(near[198]).toBe(199);
    const end = rangePages(1000, 1000);
    expect(end[1]).toBe(802);
  });

  it("범위 계산 — 마지막 범위는 덜 차고, 빈 표는 0-0, 쪽은 1 ~ 마지막 사이로", () => {
    expect(knownRange(24, 10, 237)).toEqual({ start: 231, end: 237 });
    expect(knownRange(1, 10, 0)).toEqual({ start: 0, end: 0 });
    expect(clampPage(0, 5)).toBe(1);
    expect(clampPage(9, 5)).toBe(5);
    expect(clampPage(3, 0)).toBe(1);
    expect(clampPage(0, undefined)).toBe(1);
    expect(formatRange(1000, 1999)).toBe("1,000-1,999");
  });
});

describe("TablePagination — 넘기면", () => {
  it('표 맨 위로 스크롤하고 "11-20, 총 237개" 를 한 번 알린다 — 처음에는 비어 있다', () => {
    const scrollIntoView = vi.fn();
    const target = document.createElement("div");
    target.scrollIntoView = scrollIntoView;
    render(
      <Controlled
        totalItems={237}
        initial={{ page: 1, pageSize: 10 }}
        scrollTarget={{ current: target }}
      />,
    );
    expect(status()).toBe("");
    expect(
      one("[data-slot=table-pagination-status]").getAttribute("role"),
    ).toBe("status");
    click(arrow("next"));
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
    expect(status()).toBe("11-20, 총 237개");
    click(arrow("next"));
    expect(status()).toBe("21-30, 총 237개");
  });

  it("전체를 모르면 범위만 알린다", () => {
    function Unknown() {
      const [value, setValue] = useState<TablePaginationValue>({
        page: 1,
        pageSize: 10,
      });
      return (
        <TablePagination
          hasPreviousPage={value.page > 1}
          hasNextPage
          value={value}
          onValueChange={setValue}
        />
      );
    }
    render(<Unknown />);
    click(arrow("next"));
    expect(status()).toBe("11-20");
  });

  it("값이 바깥에서 바뀌어도(정렬 · 거르기로 첫 쪽으로) 범위를 알린다", () => {
    render(
      <TablePagination totalItems={237} value={{ page: 3, pageSize: 10 }} />,
    );
    expect(status()).toBe("");
    render(
      <TablePagination totalItems={237} value={{ page: 1, pageSize: 10 }} />,
    );
    expect(status()).toBe("1-10, 총 237개");
  });
});

describe("TablePagination — 막힌 줄", () => {
  it("disabled 면 고르기 · 화살표가 모두 막힌다", () => {
    const onChange = vi.fn();
    const group = render(
      <TablePagination
        totalItems={237}
        defaultValue={{ page: 3, pageSize: 10 }}
        onValueChange={onChange}
        disabled
      />,
    );
    expect(group.getAttribute("aria-disabled")).toBe("true");
    for (const t of container.querySelectorAll<HTMLButtonElement>(
      "[data-slot=select-trigger]",
    ))
      expect(t.disabled).toBe(true);
    expect(arrow("previous").getAttribute("aria-disabled")).toBe("true");
    expect(arrow("next").getAttribute("aria-disabled")).toBe("true");
    click(arrow("next"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
