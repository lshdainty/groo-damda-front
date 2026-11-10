// Table 의 동작 — 모양 · 색은 scripts/check-ds-spec.mjs 가 크로미움에서 스펙 값과 맞춘다.
import { act, createRef, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ResultSection } from "@/shared/ds/result-section";

import {
  Table,
  TableBody,
  TableBulkBar,
  TableCell,
  TableCellContent,
  TableHead,
  TableHeader,
  TableMoreCell,
  TableMoreHead,
  TableRow,
  TableRowHeader,
  TableSelectCell,
  TableSelectHead,
  TableSkeletonRows,
  TableStatusRow,
} from "./table";
import { useTableLayout } from "./use-table-layout";

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
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(node: ReactNode) {
  act(() => root.render(node));
  return container;
}

const one = <T extends HTMLElement = HTMLElement>(selector: string) =>
  container.querySelector<T>(selector)!;
const all = (selector: string) =>
  Array.from(container.querySelectorAll<HTMLElement>(selector));
const click = (el: Element) => act(() => (el as HTMLElement).click());

function Basic({
  onRow,
  rowHeight,
}: {
  onRow?: () => void;
  rowHeight?: "text" | "rich";
}) {
  return (
    <Table caption="사용자" rowHeight={rowHeight}>
      <TableHeader>
        <TableRow>
          <TableHead>이름</TableHead>
          <TableHead align="end">남은 휴가</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow onClick={onRow}>
          <TableRowHeader>김하늘</TableRowHeader>
          <TableCell align="end">12.5일</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

describe("Table — 구조", () => {
  it("table · caption · th scope — 보조 기술이 열 이름과 줄 이름을 읽는다", () => {
    render(<Basic />);
    expect(one("table caption").textContent).toBe("사용자");
    expect(one("caption").className).toContain("sr-only");
    expect(one("thead th").getAttribute("scope")).toBe("col");
    expect(one("tbody th").getAttribute("scope")).toBe("row");
    expect(one("tbody td").tagName).toBe("TD");
  });

  it("줄 선은 칸의 아래 테두리 1px stroke-neutral-subtle 이고 세로 선 · 줄무늬 · 머리 바탕이 없다", () => {
    render(<Basic />);
    for (const cell of all("th, td")) {
      expect(cell.className).toContain("border-b");
      expect(cell.className).toContain("border-stroke-neutral-subtle");
      expect(cell.className).not.toMatch(/border-x|border-l|border-r|border-t/);
    }
    expect(one("thead").className).not.toContain("bg-");
    expect(one("table").className).toContain("border-separate");
    expect(one("[data-slot=table]").className).not.toMatch(/odd|even|border /);
  });

  it("글은 14 · 줄 높이 20, 머리는 500 · 짙은 글자, 본문은 400, 칸 좌우 16(첫 · 끝 24)", () => {
    render(<Basic />);
    const head = one("thead th");
    for (const c of [
      "text-t4",
      "leading-5",
      "font-medium",
      "text-fg-neutral",
      "py-x2_5",
      "px-x4",
      "first:pl-x6",
      "last:pr-x6",
    ])
      expect(head.className).toContain(c);
    const cell = one("tbody td");
    for (const c of ["font-normal", "py-x3", "px-x4", "leading-5"])
      expect(cell.className).toContain(c);
  });

  it("숫자 열(align=end)은 오른쪽 + 고정폭 숫자 — 머리도 오른쪽, 고정폭 글꼴은 쓰지 않는다", () => {
    render(<Basic />);
    expect(one("thead th:last-child").className).toContain("text-end");
    const num = one("tbody td");
    expect(num.className).toContain("text-end");
    expect(num.className).toContain("tabular-nums");
    expect(num.className).not.toContain("font-mono");
    expect(one("tbody th").className).toContain("text-start");
  });

  it("ref 를 상자에 넘기고 className 은 상자, tableClassName 은 표에 간다", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Table
        ref={ref}
        caption="x"
        className="max-h-[160px]"
        tableClassName="min-w-[800px]"
      >
        <TableBody />
      </Table>,
    );
    expect(ref.current).toBe(one("[data-slot=table]"));
    expect(ref.current!.className).toContain("max-h-[160px]");
    expect(one("table").className).toContain("min-w-[800px]");
  });

  it("상자는 가로로 밀린다 — 넘김 줄이 같은 상자 안이고 자리는 좌우 24 만이다(위 12 는 Table Pagination 이 갖는다)", () => {
    render(
      <Table caption="x" pagination={<span id="pg">쪽</span>}>
        <TableBody />
      </Table>,
    );
    expect(one("[data-slot=table]").className).toContain("overflow-x-auto");
    const slot = one("[data-slot=table-pagination-slot]");
    expect(slot.className).toContain("px-x6");
    // 위 12 를 자리와 Table Pagination 이 함께 갖지 않는다(24 가 되던 것 — 03-D 결정 5 B)
    expect(slot.className).not.toMatch(/\bp[ty]-/);
    expect(one("[data-slot=table-frame]").contains(slot)).toBe(true);
    expect(one("[data-slot=table-frame]").className).toContain("w-fit");
  });

  it("stickyHeader 면 상자가 세로로 스크롤하고 머리 칸이 카드 면 색으로 붙는다", () => {
    render(
      <Table caption="x" stickyHeader className="max-h-[160px]">
        <TableHeader>
          <TableRow>
            <TableHead>이름</TableHead>
            <TableSelectHead checked={false} onCheckedChange={() => {}} />
            <TableMoreHead />
          </TableRow>
        </TableHeader>
      </Table>,
    );
    expect(one("[data-slot=table]").className).toContain("overflow-y-auto");
    for (const th of all("thead th")) {
      expect(th.className).toContain("sticky");
      expect(th.className).toContain("top-0");
      expect(th.className).toContain("bg-bg-layer-default");
    }
  });

  it("붙이지 않으면 머리 칸은 바탕 없이 그대로 흐른다", () => {
    render(<Basic />);
    expect(one("thead th").className).not.toContain("sticky");
  });

  it("rich 표는 모든 줄이 최소 72 — 칸 위아래 12 를 지키고 내용이 넘으면 줄이 자란다", () => {
    render(<Basic rowHeight="rich" />);
    expect(one("[data-slot=table]").dataset.rowHeight).toBe("rich");
    for (const cell of all("tbody th, tbody td")) {
      // 표 칸의 height 는 최소 높이처럼 자란다(min-height 는 표 칸에 먹지 않는다)
      expect(cell.className).toContain("h-[72px]");
      expect(cell.className).not.toContain("min-h-");
      // 옛 값(여백 0)은 긴 글이 줄 선에 붙었다
      expect(cell.className).toContain("py-x3");
      expect(cell.className.split(" ")).not.toContain("py-0");
    }
  });

  it("Image Frame 을 담은 칸만 위아래 0 — 클래스가 has-[[data-slot=image-frame]]:py-0, 다른 칸은 py-x3", () => {
    render(
      <Table caption="x" rowHeight="rich">
        <TableBody>
          <TableRow>
            <TableRowHeader>a</TableRowHeader>
            <TableCell>b</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const cell = one("tbody td");
    expect(cell.className).toContain("py-x3");
    expect(cell.className).toContain("has-[[data-slot=image-frame]]:py-0");
  });

  it("TableCellContent — 그림 ↔ 글 12, 윗줄 + 둘째 줄(13 · 옅은 글) 사이 2", () => {
    render(
      <TableCellContent
        media={<img alt="" />}
        title="김하늘"
        detail="HR-0012"
      />,
    );
    expect(one("[data-slot=table-cell-content]").className).toContain("gap-x3");
    expect(one("[data-slot=table-cell-text]").className).toContain("gap-x0_5");
    expect(one("[data-slot=table-cell-detail]").className).toContain("text-t3");
    expect(one("[data-slot=table-cell-detail]").className).toContain(
      "text-fg-neutral-subtle",
    );
    expect(one("[data-slot=table-cell-title]").textContent).toBe("김하늘");
  });

  it("긴 둘째 줄 없이도 그려진다 — media · detail 은 고르기", () => {
    render(<TableCellContent title="김하늘" />);
    expect(one("[data-slot=table-cell-media]")).toBeNull();
    expect(one("[data-slot=table-cell-detail]")).toBeNull();
  });
});

describe("TableRow — 누르는 줄", () => {
  it("onClick 이 있는 본문 줄만 누르는 줄 — 호버 · 누름 바탕, 축소는 없다", () => {
    render(<Basic onRow={() => {}} />);
    const row = one("tbody tr");
    expect(row.dataset.pressable).toBe("true");
    for (const c of [
      "cursor-pointer",
      "hover:bg-bg-layer-default-pressed",
      "active:bg-bg-layer-default-pressed",
    ])
      expect(row.className).toContain(c);
    expect(row.className).not.toContain("scale");
  });

  it("보기만 하는 표의 줄은 바뀌지 않는다", () => {
    render(<Basic />);
    const row = one("tbody tr");
    expect(row.dataset.pressable).toBeUndefined();
    expect(row.className).not.toContain("hover:");
    expect(row.className).not.toContain("cursor-pointer");
  });

  it("머리 줄은 onClick 을 줘도 누르는 줄이 아니다", () => {
    render(
      <Table caption="x">
        <TableHeader>
          <TableRow onClick={() => {}}>
            <TableHead>이름</TableHead>
          </TableRow>
        </TableHeader>
      </Table>,
    );
    expect(one("thead tr").dataset.pressable).toBeUndefined();
  });

  it("줄을 누르면 부르고, 줄 안의 링크 · 체크 · 버튼을 누른 것은 줄 누르기가 아니다", () => {
    const onRow = vi.fn();
    const onCheck = vi.fn();
    const onName = vi.fn();
    render(
      <Table caption="x">
        <TableBody>
          <TableRow onClick={onRow}>
            <TableSelectCell
              label="김하늘"
              checked={false}
              onCheckedChange={onCheck}
            />
            <TableRowHeader onClick={onName}>김하늘</TableRowHeader>
            <TableCell>개발팀</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    click(one("tbody td:nth-child(3)"));
    expect(onRow).toHaveBeenCalledTimes(1);
    click(one("[role=checkbox]"));
    expect(onCheck).toHaveBeenCalledWith(true);
    click(one("[data-slot=table-row-link]"));
    expect(onName).toHaveBeenCalledTimes(1);
    expect(onRow).toHaveBeenCalledTimes(1);
  });

  it("TableRowHeader — href 면 링크, onClick 이면 버튼, 안 주면 글", () => {
    render(
      <Table caption="x">
        <TableBody>
          <TableRow>
            <TableRowHeader href="/users/1">김하늘</TableRowHeader>
          </TableRow>
          <TableRow>
            <TableRowHeader onClick={() => {}}>박서준</TableRowHeader>
          </TableRow>
          <TableRow>
            <TableRowHeader>이도윤</TableRowHeader>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const links = all("[data-slot=table-row-link]");
    expect(links).toHaveLength(2);
    expect(links[0]!.tagName).toBe("A");
    expect(links[0]!.getAttribute("href")).toBe("/users/1");
    expect(links[1]!.tagName).toBe("BUTTON");
    expect(links[1]!.getAttribute("type")).toBe("button");
    expect(links[0]!.className).toContain("focus-visible:-outline-offset-2");
  });
});

describe("TableHead — 정렬", () => {
  function Sorted({
    sort,
    onSort,
    align,
    defaultSortDirection,
  }: {
    sort: "none" | "ascending" | "descending" | undefined;
    onSort: (d: "ascending" | "descending") => void;
    align?: "start" | "end";
    defaultSortDirection?: "ascending" | "descending";
  }) {
    return (
      <Table caption="x">
        <TableHeader>
          <TableRow>
            <TableHead
              sort={sort}
              onSortChange={onSort}
              align={align}
              defaultSortDirection={defaultSortDirection}
            >
              남은 휴가
            </TableHead>
            <TableHead>부서</TableHead>
          </TableRow>
        </TableHeader>
      </Table>
    );
  }

  it("정렬할 수 있는 열은 칸 전체가 버튼 — 이름은 열 이름, ↑↓ 는 장식이다", () => {
    render(<Sorted sort="none" onSort={() => {}} />);
    const button = one("[data-slot=table-sort-button]");
    expect(button.tagName).toBe("BUTTON");
    expect(button.textContent).toBe("남은 휴가");
    expect(button.querySelector("svg")!.getAttribute("aria-hidden")).toBe(
      "true",
    );
    expect(one("thead th:nth-child(2) button")).toBeNull();
    expect(one("thead th:first-child").className).toContain("p-0");
  });

  it("↑↓ 는 늘 있고 지금 방향 하나만 짙다 — 둘 다 흐린 색에서 시작한다", () => {
    const arrows = () => {
      const up = one("[data-arrow=up]").getAttribute("class");
      const down = one("[data-arrow=down]").getAttribute("class");
      return { up, down };
    };
    render(<Sorted sort="none" onSort={() => {}} />);
    expect(arrows()).toEqual({
      up: "stroke-fg-neutral-muted",
      down: "stroke-fg-neutral-muted",
    });
    render(<Sorted sort="ascending" onSort={() => {}} />);
    expect(arrows()).toEqual({
      up: "stroke-fg-neutral",
      down: "stroke-fg-neutral-muted",
    });
    render(<Sorted sort="descending" onSort={() => {}} />);
    expect(arrows()).toEqual({
      up: "stroke-fg-neutral-muted",
      down: "stroke-fg-neutral",
    });
  });

  it("aria-sort 는 정렬된 열에만 단다 — 다른 열 · 정렬 안 한 열에는 달지 않는다", () => {
    render(<Sorted sort="ascending" onSort={() => {}} />);
    expect(one("thead th:first-child").getAttribute("aria-sort")).toBe(
      "ascending",
    );
    expect(one("thead th:nth-child(2)").hasAttribute("aria-sort")).toBe(false);
    render(<Sorted sort="none" onSort={() => {}} />);
    expect(one("thead th:first-child").hasAttribute("aria-sort")).toBe(false);
    render(<Sorted sort="descending" onSort={() => {}} />);
    expect(one("thead th:first-child").getAttribute("aria-sort")).toBe(
      "descending",
    );
  });

  it("두 단계 — 누를 때마다 내림 ↔ 오름이고 정렬 없음으로 돌아가지 않는다", () => {
    const onSort = vi.fn();
    render(<Sorted sort="descending" onSort={onSort} />);
    click(one("[data-slot=table-sort-button]"));
    expect(onSort).toHaveBeenLastCalledWith("ascending");
    render(<Sorted sort="ascending" onSort={onSort} />);
    click(one("[data-slot=table-sort-button]"));
    expect(onSort).toHaveBeenLastCalledWith("descending");
    for (const call of onSort.mock.calls) expect(call[0]).not.toBe("none");
  });

  it("처음 누르면 글 열은 오름, 숫자(align=end) 열은 내림, 날짜 열은 defaultSortDirection", () => {
    const onSort = vi.fn();
    render(<Sorted sort="none" onSort={onSort} />);
    click(one("[data-slot=table-sort-button]"));
    expect(onSort).toHaveBeenLastCalledWith("ascending");
    render(<Sorted sort="none" onSort={onSort} align="end" />);
    click(one("[data-slot=table-sort-button]"));
    expect(onSort).toHaveBeenLastCalledWith("descending");
    render(
      <Sorted sort="none" onSort={onSort} defaultSortDirection="descending" />,
    );
    click(one("[data-slot=table-sort-button]"));
    expect(onSort).toHaveBeenLastCalledWith("descending");
  });

  it("바꾸면 결과를 표의 숨긴 상태 글(role=status)로 알린다 — 같은 글도 다시 읽히게 번갈아 바꾼다", () => {
    render(<Sorted sort="none" onSort={() => {}} align="end" />);
    const status = one("[data-slot=table]>[role=status]");
    expect(status.textContent).toBe("");
    click(one("[data-slot=table-sort-button]"));
    expect(status.textContent).toBe("남은 휴가 내림차순으로 정렬했어요. ");
    click(one("[data-slot=table-sort-button]"));
    expect(status.textContent).toBe("남은 휴가 내림차순으로 정렬했어요.");
  });

  it("오른쪽 열은 버튼도 오른쪽 끝에 붙는다", () => {
    render(<Sorted sort="none" onSort={() => {}} align="end" />);
    expect(one("[data-slot=table-sort-button]").className).toContain(
      "justify-end",
    );
    expect(one("[data-slot=table-sort-button]").className).toContain(
      "hover:bg-bg-layer-default-pressed",
    );
    expect(one("[data-slot=table-sort-button]").className).not.toContain(
      "scale",
    );
  });

  it("누르는 영역은 위아래로 44 까지 넓힌다(::before)", () => {
    render(<Sorted sort="none" onSort={() => {}} />);
    expect(one("[data-slot=table-sort-button]").className).toContain(
      "before:-inset-y-0.5",
    );
  });
});

describe("선택 · 일괄 작업 바", () => {
  it('머리 체크는 모두 · 일부 · 없음을 보이고 이름은 "모두 선택", 줄은 "{이름} 선택"', () => {
    const states = [false, "indeterminate", true] as const;
    const seen: (string | null)[] = [];
    for (const checked of states) {
      render(
        <Table caption="x">
          <TableHeader>
            <TableRow>
              <TableSelectHead checked={checked} onCheckedChange={() => {}} />
            </TableRow>
          </TableHeader>
        </Table>,
      );
      const box = one("[role=checkbox]");
      expect(box.getAttribute("aria-label")).toBe("모두 선택");
      seen.push(box.getAttribute("aria-checked"));
    }
    expect(seen).toEqual(["false", "mixed", "true"]);
    render(
      <Table caption="x">
        <TableBody>
          <TableRow>
            <TableSelectCell
              label="김하늘"
              checked
              onCheckedChange={() => {}}
            />
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(one("[role=checkbox]").getAttribute("aria-label")).toBe(
      "김하늘 선택",
    );
  });

  it("머리 체크는 일부 고른 상태에서 누르면 모두 고른다 — 모두 고른 상태면 푼다", () => {
    const onAll = vi.fn();
    render(
      <Table caption="x">
        <TableHeader>
          <TableRow>
            <TableSelectHead checked="indeterminate" onCheckedChange={onAll} />
          </TableRow>
        </TableHeader>
      </Table>,
    );
    click(one("[role=checkbox]"));
    expect(onAll).toHaveBeenLastCalledWith(true);
    render(
      <Table caption="x">
        <TableHeader>
          <TableRow>
            <TableSelectHead checked onCheckedChange={onAll} />
          </TableRow>
        </TableHeader>
      </Table>,
    );
    click(one("[role=checkbox]"));
    expect(onAll).toHaveBeenLastCalledWith(false);
  });

  it("체크는 24 + 누르는 영역 44 — 고른 줄에는 바탕을 칠하지 않는다", () => {
    render(
      <Table caption="x">
        <TableBody>
          <TableRow>
            <TableSelectCell label="a" checked onCheckedChange={() => {}} />
          </TableRow>
        </TableBody>
      </Table>,
    );
    const box = one("[role=checkbox]");
    expect(box.className).toContain("before:size-[44px]");
    expect(one("tbody tr").className).not.toMatch(/bg-/);
    expect(one("[data-slot=table-select-cell]").className).not.toMatch(/bg-/);
  });

  it('일괄 작업 바 — 0 이면 그리지 않고, 1 이상이면 "{n}개 선택됨"', () => {
    render(
      <TableBulkBar count={0}>
        <button type="button">삭제</button>
      </TableBulkBar>,
    );
    expect(one("[data-slot=table-bulk-bar]")).toBeNull();
    render(
      <TableBulkBar count={3}>
        <button type="button">삭제</button>
      </TableBulkBar>,
    );
    const bar = one("[data-slot=table-bulk-bar]");
    expect(bar.getAttribute("role")).toBe("region");
    expect(bar.getAttribute("aria-label")).toBe("선택한 항목");
    expect(one("[data-slot=table-bulk-count]").textContent).toBe("3개 선택됨");
    expect(bar.className).toContain("bg-bg-brand-weak");
    expect(bar.className).toContain("min-h-[48px]");
    expect(bar.className).toContain("rounded-r3");
  });

  it("고른 수는 바가 없을 때도 role=status 자리가 있어 처음 고를 때 읽힌다", () => {
    render(<TableBulkBar count={0} />);
    const status = one("[data-slot=table-bulk-status]");
    expect(status.getAttribute("role")).toBe("status");
    expect(status.textContent).toBe("");
    render(<TableBulkBar count={2} />);
    expect(one("[data-slot=table-bulk-status]").textContent).toBe("2개 선택됨");
    // 보이는 글은 보조 기술에 숨기고 읽는 글은 status 가 맡는다
    expect(
      one("[data-slot=table-bulk-count]").getAttribute("aria-hidden"),
    ).toBe("true");
  });

  it('바가 있을 때 바가 그 자리의 첫 요소다 · ✕ "선택 해제" 는 초점을 표의 머리 체크로 옮기고 부른다', () => {
    const onClear = vi.fn();
    render(
      <div>
        <TableBulkBar count={1} onClear={onClear} />
        <Table caption="x">
          <TableHeader>
            <TableRow>
              <TableSelectHead
                checked="indeterminate"
                onCheckedChange={() => {}}
              />
            </TableRow>
          </TableHeader>
        </Table>
      </div>,
    );
    expect(one("div").firstElementChild!.getAttribute("data-slot")).toBe(
      "table-bulk-bar",
    );
    const clear = one("[data-slot=table-bulk-clear]");
    expect(clear.getAttribute("aria-label")).toBe("선택 해제");
    click(clear);
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(one("[role=checkbox]"));
  });
});

describe("줄 끝 ⋮", () => {
  it('머리는 글 없이 숨긴 "동작", ⋮ 이름은 "{줄 이름} 더보기" · 열 폭 80', () => {
    render(
      <Table caption="x">
        <TableHeader>
          <TableRow>
            <TableMoreHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableMoreCell label="김하늘">{null}</TableMoreCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(one("[data-slot=table-more-head] .sr-only").textContent).toBe(
      "동작",
    );
    expect(one("[data-slot=table-more-head]").className).toContain("w-[80px]");
    const button = one("[data-slot=table-more-button]");
    expect(button.getAttribute("aria-label")).toBe("김하늘 더보기");
    // 1280 미만은 Menu Sheet(대화상자)가 열린다 — Menu(aria-haspopup=menu)는 아래 테스트
    expect(button.getAttribute("aria-haspopup")).toBe("dialog");
    expect(one("[data-slot=table-more-cell]").className).toContain("w-[80px]");
  });

  it("1280 이상은 Menu 가 열려 aria-haspopup=menu", () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    try {
      render(
        <Table caption="x">
          <TableBody>
            <TableRow>
              <TableMoreCell label="김하늘">{null}</TableMoreCell>
            </TableRow>
          </TableBody>
        </Table>,
      );
      expect(
        one("[data-slot=table-more-button]").getAttribute("aria-haspopup"),
      ).toBe("menu");
    } finally {
      window.matchMedia = original;
    }
  });
});

describe("기다림 · 비었음 · 실패", () => {
  it("TableSkeletonRows — 줄 수 · 열 맞춤 · 폭, 보조 기술에는 숨긴다, 줄 높이 그대로", () => {
    render(
      <Table caption="x">
        <TableBody>
          <TableSkeletonRows
            rows={3}
            columns={[{ width: "40%" }, { align: "end", width: "20%" }, {}]}
          />
        </TableBody>
      </Table>,
    );
    const rows = all("[data-slot=table-skeleton-row]");
    expect(rows).toHaveLength(3);
    expect(rows[0]!.getAttribute("aria-hidden")).toBe("true");
    const bars = rows[0]!.querySelectorAll<HTMLElement>("[data-slot=skeleton]");
    expect(bars).toHaveLength(3);
    expect(bars[0]!.style.width).toBe("40%");
    expect(bars[1]!.className).toContain("ml-auto");
    expect(bars[2]!.style.width).toBe("60%");
    expect(rows[0]!.querySelector("td")!.className).toContain("h-[45px]");
  });

  it("rich 표의 스켈레톤 줄은 72", () => {
    render(
      <Table caption="x" rowHeight="rich">
        <TableBody>
          <TableSkeletonRows rows={1} columns={[{}]} />
        </TableBody>
      </Table>,
    );
    expect(one("[data-slot=table-skeleton-row] td").className).toContain(
      "h-[72px]",
    );
  });

  it("기본 10줄", () => {
    render(
      <Table caption="x">
        <TableBody>
          <TableSkeletonRows columns={[{}]} />
        </TableBody>
      </Table>,
    );
    expect(all("[data-slot=table-skeleton-row]")).toHaveLength(10);
  });

  it("TableStatusRow — 칸 하나가 머리 줄의 칸 수만큼 덮고, 좌우 24 만 둔다", () => {
    render(
      <Table caption="x">
        <TableHeader>
          <TableRow>
            <TableHead>이름</TableHead>
            <TableHead>부서</TableHead>
            <TableHead>상태</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableStatusRow>
            <ResultSection
              kind="failure"
              size="medium"
              title="사용자를 불러오지 못했어요"
              primaryAction={{ label: "다시 시도" }}
            />
          </TableStatusRow>
        </TableBody>
      </Table>,
    );
    const cell = one<HTMLTableCellElement>("[data-slot=table-status-cell]");
    expect(cell.colSpan).toBe(3);
    expect(cell.className).toContain("px-x6");
    expect(cell.className).toContain("border-stroke-neutral-subtle");
    expect(cell.textContent).toContain("사용자를 불러오지 못했어요");
  });

  it("colSpan 을 주면 그 값이다", () => {
    render(
      <Table caption="x">
        <TableHeader>
          <TableRow>
            <TableHead>이름</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableStatusRow colSpan={5}>비었어요</TableStatusRow>
        </TableBody>
      </Table>,
    );
    expect(
      one<HTMLTableCellElement>("[data-slot=table-status-cell]").colSpan,
    ).toBe(5);
  });
});

describe("useTableLayout", () => {
  const original = window.matchMedia;
  afterEach(() => {
    window.matchMedia = original;
  });

  function Probe() {
    return <span data-slot="layout">{useTableLayout()}</span>;
  }
  const mock = (matches: boolean) => {
    window.matchMedia = ((query: string) => ({
      matches,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
  };

  it("768 이상이면 table, 미만이면 list", () => {
    mock(true);
    render(<Probe />);
    expect(one("[data-slot=layout]").textContent).toBe("table");
    mock(false);
    render(<Probe />);
    // 같은 훅 호출은 스냅샷을 다시 읽으므로 새로 그린다
    act(() => root.unmount());
    root = createRoot(container);
    render(<Probe />);
    expect(one("[data-slot=layout]").textContent).toBe("list");
  });

  it("matchMedia 가 없으면 list 다", () => {
    window.matchMedia = undefined as unknown as typeof window.matchMedia;
    render(<Probe />);
    expect(one("[data-slot=layout]").textContent).toBe("list");
  });
});
