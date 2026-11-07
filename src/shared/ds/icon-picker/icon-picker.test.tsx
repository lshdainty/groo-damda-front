// Icon Picker 의 동작 — 모양 · 색은 scripts/check-ds-spec.mjs 가 크로미움에서 스펙 값과 맞춘다.
// jsdom 은 길이를 재지 못해 격자 칸의 자리를 6열로 속인다(↑ ↓ 가 같은 열로 가는지 본다).
import { act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { icons as lucideIcons } from "lucide-react";

import { TooltipProvider } from "@/shared/ds/tooltip";
import { Field } from "@/shared/ds/field";

import { CATEGORY_ICON_GLYPHS } from "./category-icon-glyphs";
import {
  CATEGORY_ICON_GROUPS,
  CATEGORY_ICON_SECTIONS,
  CATEGORY_ICONS,
  DEFAULT_CATEGORY_ICON,
  findCategoryIcon,
  searchCategoryIcons,
} from "./category-icons";
import { IconPicker, IconPickerPanel } from "./icon-picker";
import { ANNOUNCE_DELAY } from "./icon-picker-variants";
import spec from "@/shared/ds/spec/category-icons.json";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;
let wide = false;
// 격자 차례 — 묶음 차례대로 이어 붙인 칸의 자리(6열)
const ORDER = new Map(
  CATEGORY_ICON_SECTIONS.flatMap((section) => section.icons).map((icon, k) => [
    icon.id,
    k,
  ]),
);

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  wide = false;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: wide,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
  Element.prototype.scrollIntoView = () => undefined;
  // 칸의 자리 — 6열 격자(칸 순서대로), 나머지는 0
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      if (this.getAttribute("role") === "option") {
        const i = ORDER.get(this.getAttribute("data-icon") ?? "") ?? 0;
        return {
          x: (i % 6) * 52,
          y: Math.floor(i / 6) * 52,
          left: (i % 6) * 52,
          top: Math.floor(i / 6) * 52,
          right: (i % 6) * 52 + 48,
          bottom: Math.floor(i / 6) * 52 + 48,
          width: 48,
          height: 48,
          toJSON: () => ({}),
        };
      }
      return {
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0,
        toJSON: () => ({}),
      };
    },
  );
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function render(node: ReactNode) {
  act(() => root.render(node));
}

const cells = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'));
const cellOf = (id: string) =>
  cells().find((c) => c.getAttribute("data-icon") === id)!;
const names = () => cells().map((c) => c.getAttribute("aria-label"));
const headers = () =>
  Array.from(
    document.querySelectorAll("[data-slot=icon-picker-group-header]"),
    (h) => h.textContent,
  );

function key(el: HTMLElement, k: string) {
  const e = new KeyboardEvent("keydown", {
    key: k,
    bubbles: true,
    cancelable: true,
  });
  act(() => {
    el.dispatchEvent(e);
  });
  return e;
}

describe("세트 — category-icons.json 을 그대로 읽는다", () => {
  it("148개 · 13 묶음 · 한국어 이름은 겹치지 않는다", () => {
    expect(CATEGORY_ICONS).toHaveLength(148);
    expect(CATEGORY_ICON_GROUPS).toHaveLength(13);
    expect(CATEGORY_ICON_SECTIONS).toHaveLength(13);
    expect(CATEGORY_ICON_SECTIONS.reduce((n, s) => n + s.icons.length, 0)).toBe(
      148,
    );
    const names = CATEGORY_ICONS.map((i) => i.name);
    expect(new Set(names).size).toBe(names.length);
    expect(DEFAULT_CATEGORY_ICON).toBe("tag");
    expect(CATEGORY_ICONS).toBe(spec.data.entries);
  });

  it("그림 표는 세트와 정확히 같은 id — 어긋나면 여기서 멈춘다", () => {
    expect(Object.keys(CATEGORY_ICON_GLYPHS).sort()).toEqual(
      CATEGORY_ICONS.map((i) => i.id).sort(),
    );
    // 모든 id 가 lucide 의 그 이름(kebab → Pascal)과 같은 아이콘이다
    for (const [id, glyph] of Object.entries(CATEGORY_ICON_GLYPHS)) {
      const pascal = id
        .split("-")
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join("");
      expect(glyph, id).toBe(lucideIcons[pascal as keyof typeof lucideIcons]);
    }
  });

  it("저장 값 찾기 — id · 옛 이름(home → 집) · 빈 값 · 세트 밖", () => {
    expect(findCategoryIcon("coffee")?.name).toBe("커피");
    expect(findCategoryIcon("home")?.id).toBe("house");
    expect(findCategoryIcon("waves")?.id).toBe("waves-horizontal");
    expect(findCategoryIcon(" coffee ")?.id).toBe("coffee");
    expect(findCategoryIcon("")).toBeNull();
    expect(findCategoryIcon(null)).toBeNull();
    expect(findCategoryIcon(undefined)).toBeNull();
    expect(findCategoryIcon("a-arrow-down")).toBeNull();
    // 서버가 심는 기본 카테고리의 아이콘은 모두 세트 안이다
    expect(findCategoryIcon("piggy-bank")).not.toBeNull();
    expect(findCategoryIcon(DEFAULT_CATEGORY_ICON)?.name).toBe("태그");
  });

  it("찾기 — 이름 · 찾는 말 · id 의 부분 일치, 소문자 · 공백 없이, 세트 차례", () => {
    expect(searchCategoryIcons("커피").map((i) => i.name)).toEqual([
      "커피",
      "원두",
    ]);
    expect(searchCategoryIcons("월세").map((i) => i.name)).toEqual(["집"]);
    expect(searchCategoryIcons("coffee")[0]?.name).toBe("커피");
    expect(searchCategoryIcons(" C o F f E E ")[0]?.name).toBe("커피");
    expect(searchCategoryIcons("")).toBe(CATEGORY_ICONS);
    expect(searchCategoryIcons("   ")).toBe(CATEGORY_ICONS);
    expect(searchCategoryIcons("유니콘")).toHaveLength(0);
  });
});

describe("IconPickerPanel — 격자", () => {
  const setup = (
    props: Partial<Parameters<typeof IconPickerPanel>[0]> = {},
  ) => {
    const onSelect = vi.fn();
    const onQueryChange = vi.fn();
    render(
      <IconPickerPanel
        surface="sheet"
        selectedId={null}
        query=""
        onQueryChange={onQueryChange}
        onSelect={onSelect}
        {...props}
      />,
    );
    return { onSelect, onQueryChange };
  };

  it("묶음마다 머리 + 칸 — 148 칸 · 13 머리, 격자는 listbox 이고 묶음은 group 이다", () => {
    setup();
    expect(cells()).toHaveLength(148);
    expect(headers()).toEqual([...CATEGORY_ICON_GROUPS]);
    const listbox = document.querySelector("[role=listbox]")!;
    expect(listbox.getAttribute("aria-label")).toBe("아이콘");
    const group = document.querySelector("[role=group]")!;
    expect(
      document.getElementById(group.getAttribute("aria-labelledby")!)
        ?.textContent,
    ).toBe("식비");
    // 칸 이름은 한국어 이름 · 아이콘은 보조 기술에 숨긴다
    expect(cellOf("coffee").getAttribute("aria-label")).toBe("커피");
    expect(
      cellOf("coffee").querySelector("svg")!.getAttribute("aria-hidden"),
    ).toBe("true");
  });

  it("격자에 Tab 하나 — 고른 칸, 없으면 첫 칸", () => {
    setup();
    expect(cells().filter((c) => c.tabIndex === 0)).toHaveLength(1);
    expect(cells()[0]!.tabIndex).toBe(0);
    act(() => root.unmount());
    root = createRoot(container);
    setup({ selectedId: "coffee" });
    expect(cellOf("coffee").tabIndex).toBe(0);
    expect(cells().filter((c) => c.tabIndex === 0)).toHaveLength(1);
    expect(cellOf("coffee").getAttribute("aria-selected")).toBe("true");
    expect(
      cells().filter((c) => c.getAttribute("aria-selected") === "true"),
    ).toHaveLength(1);
  });

  it("고른 칸이 세트 밖이면 고른 칸이 없다 — Tab 은 첫 칸", () => {
    setup({ selectedId: null });
    expect(
      cells().some((c) => c.getAttribute("aria-selected") === "true"),
    ).toBe(false);
  });

  it("칸을 누르면 그 id 로 고른다", () => {
    const { onSelect } = setup();
    act(() => cellOf("coffee").click());
    expect(onSelect).toHaveBeenCalledWith("coffee");
  });

  it("← → 는 차례대로(묶음을 넘는다) · Home · End 는 그 줄의 처음 · 끝 — 고르지는 않는다", () => {
    const { onSelect } = setup();
    const first = cells()[0]!;
    act(() => first.focus());
    key(first, "ArrowRight");
    expect(document.activeElement).toBe(cells()[1]);
    key(cells()[1]!, "ArrowLeft");
    expect(document.activeElement).toBe(cells()[0]);
    // 맨 앞에서 ← 는 멈춘다
    key(cells()[0]!, "ArrowLeft");
    expect(document.activeElement).toBe(cells()[0]);
    key(cells()[2]!, "End");
    expect(document.activeElement).toBe(cells()[5]);
    key(cells()[5]!, "Home");
    expect(document.activeElement).toBe(cells()[0]);
    expect(onSelect).not.toHaveBeenCalled();
    // 움직인 칸이 Tab 이 서는 칸이 된다(roving)
    expect(cells().filter((c) => c.tabIndex === 0)).toEqual([cells()[0]]);
  });

  it("↑ ↓ 는 보이는 위아래 줄의 가장 가까운 칸 — 같은 열", () => {
    setup();
    act(() => cells()[2]!.focus());
    key(cells()[2]!, "ArrowDown");
    expect(document.activeElement).toBe(cells()[8]);
    key(cells()[8]!, "ArrowUp");
    expect(document.activeElement).toBe(cells()[2]);
    // 맨 윗줄에서 ↑ · 맨 아랫줄에서 ↓ 는 멈춘다
    key(cells()[2]!, "ArrowUp");
    expect(document.activeElement).toBe(cells()[2]);
    const last = cells()[cells().length - 1]!;
    act(() => last.focus());
    key(last, "ArrowDown");
    expect(document.activeElement).toBe(last);
  });

  it("Enter · Space 로 고른다 — 키 기본 동작(스크롤)은 막는다", () => {
    const { onSelect } = setup();
    act(() => cells()[3]!.focus());
    const enter = key(cells()[3]!, "Enter");
    expect(enter.defaultPrevented).toBe(true);
    expect(onSelect).toHaveBeenLastCalledWith(
      cells()[3]!.getAttribute("data-icon"),
    );
    const space = key(cells()[3]!, " ");
    expect(space.defaultPrevented).toBe(true);
    expect(onSelect).toHaveBeenCalledTimes(2);
    // 그 밖의 키는 건드리지 않는다
    const a = key(cells()[3]!, "a");
    expect(a.defaultPrevented).toBe(false);
  });
});

describe("IconPickerPanel — 찾기", () => {
  const Search = ({ initial = "" }: { initial?: string }) => {
    const [query, setQuery] = useState(initial);
    return (
      <IconPickerPanel
        surface="popover"
        selectedId="coffee"
        query={query}
        onQueryChange={setQuery}
        onSelect={() => undefined}
      />
    );
  };

  it("찾는 동안은 묶음 머리 없이 걸린 칸만 세트 차례로 — 찾기 칸 이름 · 안내 글", () => {
    render(<Search initial="커피" />);
    expect(headers()).toEqual([]);
    expect(names()).toEqual(["커피", "원두"]);
    const input = document.querySelector<HTMLInputElement>("input")!;
    expect(input.getAttribute("aria-label")).toBe("아이콘 검색");
    expect(input.placeholder).toBe("아이콘 이름 검색");
  });

  it("치기를 멈추면 결과 수를 한 번 알린다 — 치는 동안은 비어 있다", () => {
    vi.useFakeTimers();
    render(<Search initial="커피" />);
    const live = () =>
      document.querySelector("[data-slot=icon-picker-count]")!.textContent;
    expect(live()).toBe("");
    act(() => {
      vi.advanceTimersByTime(ANNOUNCE_DELAY + 10);
    });
    expect(live()).toBe("검색 결과 2개");
    expect(
      document
        .querySelector("[data-slot=icon-picker-count]")!
        .getAttribute("aria-live"),
    ).toBe("polite");
  });

  it('0건이면 격자 대신 Result Section — ""{검색어}"에 대한 아이콘이 없어요"', () => {
    render(<Search initial=" 유니콘 " />);
    expect(cells()).toHaveLength(0);
    expect(document.querySelector("[role=listbox]")).toBeNull();
    const status = document.querySelector("[data-icon-picker=empty]")!;
    expect(status.textContent).toContain('"유니콘"에 대한 아이콘이 없어요');
    expect(status.textContent).toContain(
      "다른 말로 찾거나 묶음에서 골라주세요.",
    );
  });

  it("찾기 칸에서 ↓ 는 격자의 첫 칸으로", () => {
    render(<Search initial="월세" />);
    const input = document.querySelector<HTMLInputElement>("input")!;
    act(() => input.focus());
    const e = key(input, "ArrowDown");
    expect(e.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(cellOf("house"));
  });

  it("한글을 조합하는 동안의 ↓ 는 조합의 것이다", () => {
    render(<Search initial="월세" />);
    const input = document.querySelector<HTMLInputElement>("input")!;
    act(() => input.focus());
    const e = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
      isComposing: true,
    });
    act(() => {
      input.dispatchEvent(e);
    });
    expect(e.defaultPrevented).toBe(false);
  });

  it("시트는 찾기 칸 large · 팝오버는 medium", () => {
    render(
      <>
        <IconPickerPanel
          surface="sheet"
          selectedId={null}
          query=""
          onQueryChange={() => undefined}
          onSelect={() => undefined}
        />
      </>,
    );
    expect(
      document
        .querySelector("[data-slot=text-input]")!
        .getAttribute("data-size"),
    ).toBe("large");
    act(() => root.unmount());
    root = createRoot(container);
    render(<Search />);
    expect(
      document
        .querySelector("[data-slot=text-input]")!
        .getAttribute("data-size"),
    ).toBe("medium");
  });

  it("열 수 — 시트는 들어가는 만큼 → 6열, 팝오버는 7열", () => {
    render(<Search />);
    expect(
      document.querySelector("[data-slot=icon-picker-group] > [role=none]")!
        .className,
    ).toContain("grid-cols-[repeat(7,48px)]");
    act(() => root.unmount());
    root = createRoot(container);
    render(
      <IconPickerPanel
        surface="sheet"
        selectedId={null}
        query=""
        onQueryChange={() => undefined}
        onSelect={() => undefined}
      />,
    );
    const cls = document.querySelector(
      "[data-slot=icon-picker-group] > [role=none]",
    )!.className;
    expect(cls).toContain("@min-[308px]:grid-cols-[repeat(6,48px)]");
    expect(cls).toContain("grid-cols-[repeat(auto-fill,48px)]");
  });
});

describe("IconPicker — 트리거 · 여는 자리", () => {
  const trigger = () =>
    container.querySelector<HTMLButtonElement>("[data-icon-picker]")!;
  // 값 · 붙이개는 버튼을 덮는 콘텐츠 층(상자 안)에 있다 — 버튼 자신의 글은 비어 있다
  const shown = () =>
    trigger().closest("[data-slot=text-input], div")!.parentElement!
      .textContent;
  const sheetOpen = () =>
    document
      .querySelector("[data-icon-picker=sheet]")
      ?.getAttribute("data-state") === "open";

  const Controlled = ({
    initial,
    onChange,
  }: {
    initial: string | null;
    onChange?: (id: string) => void;
  }) => {
    const [value, setValue] = useState<string | null>(initial);
    return (
      <Field label="아이콘">
        <IconPicker
          value={value}
          onValueChange={(id) => {
            setValue(id);
            onChange?.(id);
          }}
        />
      </Field>
    );
  };

  it('트리거는 지금 아이콘 + 그 이름 — 이름은 "아이콘" 라벨과 함께 읽힌다', () => {
    render(<Controlled initial="coffee" />);
    expect(shown()).toContain("커피");
    expect(trigger().dataset.icon).toBe("coffee");
    expect(trigger().getAttribute("aria-haspopup")).toBe("dialog");
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    const name = trigger()
      .getAttribute("aria-labelledby")!
      .split(" ")
      .map((id) => document.getElementById(id)?.textContent)
      .join(" ");
    expect(name).toContain("아이콘");
    expect(name).toContain("커피");
  });

  it('빈 값 · null 은 태그 + "태그", 세트 밖 저장 값은 그 아이콘 + "지금 아이콘"', () => {
    render(<IconPicker value="" />);
    expect(shown()).toContain("태그");
    expect(trigger().dataset.icon).toBe("tag");
    act(() => root.render(<IconPicker value={null} />));
    expect(shown()).toContain("태그");
    act(() => root.render(<IconPicker value="a-arrow-down" />));
    expect(shown()).toContain("지금 아이콘");
    expect(trigger().dataset.icon).toBe("a-arrow-down");
    // 서버가 심은 옛 이름은 세트의 이름으로
    act(() => root.render(<IconPicker value="home" />));
    expect(shown()).toContain("집");
  });

  it("좁으면 시트로 열고 칸을 고르면 알린 뒤 바로 닫는다 — 완료 단추 없음", () => {
    const onChange = vi.fn();
    render(<Controlled initial="coffee" onChange={onChange} />);
    act(() => trigger().click());
    expect(document.querySelector("[data-icon-picker=sheet]")).not.toBeNull();
    expect(document.querySelector("[data-icon-picker=popover]")).toBeNull();
    expect(cells()).toHaveLength(148);
    expect(cellOf("coffee").getAttribute("aria-selected")).toBe("true");
    act(() => cellOf("utensils").click());
    expect(onChange).toHaveBeenCalledWith("utensils");
    expect(sheetOpen()).toBe(false);
    expect(shown()).toContain("식사");
  });

  it('1280 이상이면 팝오버(폭 408)로 연다 — 이름 "아이콘"', () => {
    wide = true;
    render(<Controlled initial="coffee" />);
    act(() => trigger().click());
    const pop = document.querySelector("[data-icon-picker=popover]")!;
    expect(pop).not.toBeNull();
    expect(pop.className).toContain("w-[408px]");
    expect(pop.getAttribute("aria-label")).toBe("아이콘");
    expect(document.querySelector("[data-icon-picker=sheet]")).toBeNull();
  });

  it("값이 그대로면(고르지 않고 닫으면) 알리지 않는다 — 세트 밖 저장 값은 그대로 남는다", () => {
    const onChange = vi.fn();
    render(<Controlled initial="a-arrow-down" onChange={onChange} />);
    act(() => trigger().click());
    // 세트 밖이면 고른 칸이 없다
    expect(
      cells().some((c) => c.getAttribute("aria-selected") === "true"),
    ).toBe(false);
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(sheetOpen()).toBe(false);
    expect(trigger().dataset.icon).toBe("a-arrow-down");
  });

  it("칸 툴팁은 마우스를 올릴 때만 연다 — 키보드 초점으로 열지 않아 Esc 한 번에 닫힌다(03B-012)", () => {
    vi.useFakeTimers();
    try {
      render(
        <TooltipProvider>
          <Controlled initial="coffee" />
        </TooltipProvider>,
      );
      const bubbleCount = () =>
        document.querySelectorAll("[data-slot=tooltip-content]").length;
      // 키보드로 연 것처럼 — 열기 전에 :focus-visible 이 참이게 한다. 피커는 열 때 고른 칸에 초점을 주므로 그 초점이 툴팁 경로를 탄다
      const realMatches = Element.prototype.matches;
      const spy = vi
        .spyOn(Element.prototype, "matches")
        .mockImplementation(function (this: Element, selector: string) {
          return (
            selector === ":focus-visible" || realMatches.call(this, selector)
          );
        });
      act(() => trigger().click());
      const selected = cells().find(
        (c) => c.getAttribute("aria-selected") === "true",
      )!;
      expect(document.activeElement).toBe(selected);
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(bubbleCount()).toBe(0);
      spy.mockRestore();
      // 첫 Esc 에 닫힌다
      act(() => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
      });
      expect(sheetOpen()).toBe(false);

      // 마우스를 올리면 200ms 뒤 같은 글의 툴팁이 뜬다
      act(() => trigger().click());
      const other = cells()[1]!;
      act(() => {
        other.dispatchEvent(
          new PointerEvent("pointerover", {
            bubbles: true,
            pointerType: "mouse",
          }),
        );
        other.dispatchEvent(
          new PointerEvent("pointermove", {
            bubbles: true,
            pointerType: "mouse",
          }),
        );
        vi.advanceTimersByTime(250);
      });
      expect(bubbleCount()).toBe(1);
      expect(
        document.querySelector("[data-slot=tooltip-content]")!.firstChild
          ?.textContent,
      ).toBe(other.getAttribute("aria-label"));
    } finally {
      vi.useRealTimers();
    }
  });

  it("막히면 열리지 않는다(Input Button)", () => {
    render(
      <Field label="아이콘" disabled>
        <IconPicker value="coffee" />
      </Field>,
    );
    expect(trigger().disabled).toBe(true);
    act(() => trigger().click());
    expect(document.querySelector("[data-icon-picker=sheet]")).toBeNull();
    expect(sheetOpen()).toBe(false);
  });
});
