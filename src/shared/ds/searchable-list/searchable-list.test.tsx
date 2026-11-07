// Searchable List 의 동작 — 모양 · 색은 scripts/check-ds-spec.mjs 가 크로미움에서 스펙 값과 맞춘다.
// 검사기가 못 재는 값(강조 바탕 ::before · 누름 축소 · 문장 · 시간)과 키보드 · 알림 · 거르기 흐름은 여기서 본다(searchable-list.measure.mjs 머리).
import { useState, type ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ds/popover";

import {
  SearchableList,
  SearchableListEmpty,
  SearchableListError,
  SearchableListGroup,
  SearchableListInput,
  SearchableListItem,
  SearchableListResults,
  SearchableListSkeleton,
  type SearchableListProps,
} from "./searchable-list";
import { focusSearchableList, matchesSearch } from "./searchable-list-dom";

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
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function render(node: ReactNode) {
  act(() => root.render(node));
}

const input = () => container.querySelector<HTMLInputElement>("input")!;
const listbox = () => container.querySelector<HTMLElement>("[role=listbox]");
const options = () =>
  Array.from(container.querySelectorAll<HTMLElement>("[role=option]"));
const optionNames = () =>
  options().map(
    (o) =>
      o.querySelector("[data-slot=searchable-list-item-title]")?.textContent,
  );
const classes = (el: Element) => el.className.split(/\s+/);

// 한글 입력(조합 중)을 흉내 낸다 — 값을 바꾸고 input 이벤트를 보낸다
function type(text: string) {
  act(() => {
    const el = input();
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(el, text);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
function key(k: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", {
    key: k,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  act(() => {
    input().dispatchEvent(event);
  });
  return event;
}

const BANKS = [
  { group: "시중은행", names: ["국민은행", "신한은행", "우리은행"] },
  { group: "인터넷은행", names: ["카카오뱅크", "토스뱅크"] },
];

// 쓰는 쪽이 거른다 — 공백 · 대소문자를 무시하고 포함하는지
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");

function Banks(props: Partial<SearchableListProps> & { autoFocus?: boolean }) {
  const { autoFocus, onQueryChange, ...rest } = props;
  const [query, setQuery] = useState("");
  const groups = BANKS.map((g) => ({
    ...g,
    names: g.names.filter((n) => norm(n).includes(norm(query))),
  })).filter((g) => g.names.length > 0);
  return (
    <SearchableList
      query={query}
      onQueryChange={(q) => {
        setQuery(q);
        onQueryChange?.(q);
      }}
      placement="inline"
      {...rest}
    >
      <SearchableListInput autoFocus={autoFocus} placeholder="은행 이름 검색" />
      {groups.length === 0 ? (
        <SearchableListEmpty />
      ) : (
        <SearchableListResults aria-label="은행">
          {BANKS.map((g) => (
            <SearchableListGroup key={g.group} label={g.group}>
              {g.names
                .filter((n) => norm(n).includes(norm(query)))
                .map((n) => (
                  <SearchableListItem key={n} value={n} title={n} />
                ))}
            </SearchableListGroup>
          ))}
        </SearchableListResults>
      )}
    </SearchableList>
  );
}

describe("구조 · 접근성", () => {
  it("검색칸은 combobox — 이름 '검색' · 밑줄형 · 목록을 가리킨다 · 강조가 없으면 activedescendant 가 비어 있다", () => {
    render(<Banks />);
    const el = input();
    expect(el.getAttribute("role")).toBe("combobox");
    expect(el.getAttribute("aria-label")).toBe("검색");
    expect(el.getAttribute("aria-expanded")).toBe("true");
    expect(el.getAttribute("aria-autocomplete")).toBe("list");
    expect(el.getAttribute("aria-controls")).toBe(listbox()!.id);
    expect(el.hasAttribute("aria-activedescendant")).toBe(false);
    expect(el.getAttribute("autocomplete")).toBe("off");
    const box = container.querySelector("[data-slot=text-input]")!;
    expect(box.getAttribute("data-variant")).toBe("underline");
    // 앞 돋보기
    expect(
      box.querySelector("[data-slot=text-input-prefix-icon]"),
    ).not.toBeNull();
  });

  it("목록은 listbox + 이름, 분류는 group + 머리, 줄은 option + aria-selected", () => {
    render(<Banks defaultValue="신한은행" />);
    expect(listbox()!.getAttribute("aria-label")).toBe("은행");
    const groups = container.querySelectorAll("[role=group]");
    expect(groups).toHaveLength(2);
    const labelId = groups[0]!.getAttribute("aria-labelledby")!;
    expect(document.getElementById(labelId)!.textContent).toBe("시중은행");
    expect(
      options().map((o) => [
        o.getAttribute("data-value"),
        o.getAttribute("aria-selected"),
      ]),
    ).toEqual([
      ["국민은행", "false"],
      ["신한은행", "true"],
      ["우리은행", "false"],
      ["카카오뱅크", "false"],
      ["토스뱅크", "false"],
    ]);
    // 줄은 Tab 으로 들어가지 않는다 — 초점은 검색칸
    expect(options().every((o) => !o.hasAttribute("tabindex"))).toBe(true);
  });

  it("오른쪽 라디오는 보는 표시 — 보조 기술에 숨기고, 지금 값만 켠다. 고른 줄 바탕은 칠하지 않는다", () => {
    render(<Banks defaultValue="신한은행" />);
    const radios = Array.from(
      container.querySelectorAll("[data-slot=searchable-list-item-radio]"),
    );
    expect(radios.every((r) => r.getAttribute("aria-hidden") === "true")).toBe(
      true,
    );
    expect(radios.map((r) => r.getAttribute("data-state"))).toEqual([
      "unchecked",
      "checked",
      "unchecked",
      "unchecked",
      "unchecked",
    ]);
    expect(classes(radios[0]!)).toContain("pointer-events-none");
    expect(classes(options()[1]!).join(" ")).not.toMatch(/bg-bg-brand/);
  });

  it("앞 붙이개는 보조 기술에 숨기고, 설명은 제목 아래에 놓인다", () => {
    render(
      <SearchableList placement="inline">
        <SearchableListInput autoFocus={false} />
        <SearchableListResults aria-label="카드">
          <SearchableListItem
            value="a"
            title="T-Pay 신한카드"
            detail="신한카드 · 신용"
            prefix={<span data-testid="tile" />}
          />
        </SearchableListResults>
      </SearchableList>,
    );
    const prefix = container.querySelector(
      "[data-slot=searchable-list-item-prefix]",
    )!;
    expect(prefix.getAttribute("aria-hidden")).toBe("true");
    expect(prefix.querySelector("[data-testid=tile]")).not.toBeNull();
    expect(
      container.querySelector("[data-slot=searchable-list-item-detail]")!
        .textContent,
    ).toBe("신한카드 · 신용");
  });

  it("묶음 밖에서 쓰면 알려 준다", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<SearchableListItem value="a" title="a" />)).toThrow(
      /SearchableList 안에/,
    );
    error.mockRestore();
  });
});

describe("거르기", () => {
  it("치는 대로 onQueryChange 를 부르고 쓰는 쪽이 거른다 — 공백 · 대소문자는 무시", () => {
    const onQueryChange = vi.fn();
    render(<Banks onQueryChange={onQueryChange} />);
    type("신한");
    expect(onQueryChange).toHaveBeenLastCalledWith("신한");
    expect(optionNames()).toEqual(["신한은행"]);
    type("카카오 뱅크");
    expect(optionNames()).toEqual(["카카오뱅크"]);
  });

  it("조합 중에 친 글자도 그대로 검색어가 된다 — 한 글자씩 늘어도 목록이 따라간다", () => {
    render(<Banks />);
    for (const q of ["ㅅ", "시", "신", "신ㅎ", "신한"]) type(q);
    expect(optionNames()).toEqual(["신한은행"]);
    expect(input().value).toBe("신한");
  });

  it("남은 줄이 없는 분류는 머리째 숨긴다", () => {
    render(<Banks />);
    type("뱅크");
    const groups = container.querySelectorAll("[role=group]");
    expect(groups).toHaveLength(1);
    expect(container.textContent).not.toContain("시중은행");
    expect(container.textContent).toContain("인터넷은행");
  });

  it("치면 강조를 지운다", () => {
    render(<Banks />);
    key("ArrowDown");
    expect(input().getAttribute("aria-activedescendant")).toBeTruthy();
    type("은");
    expect(input().hasAttribute("aria-activedescendant")).toBe(false);
    expect(container.querySelector("[data-highlighted]")).toBeNull();
  });

  it("지우기 버튼은 검색어를 비우고 검색칸에 초점을 둔다 — 전체 목록으로", () => {
    render(<Banks />);
    type("신한");
    const clear = container.querySelector<HTMLButtonElement>(
      "[data-slot=text-input-clear]",
    )!;
    expect(clear.getAttribute("aria-label")).toBe("지우기");
    act(() => clear.click());
    expect(input().value).toBe("");
    expect(options()).toHaveLength(5);
    expect(document.activeElement).toBe(input());
  });

  it("검색어를 안 줘도(비제어) 쓰는 대로 값을 든다", () => {
    const seen: string[] = [];
    render(
      <SearchableList placement="inline" onQueryChange={(q) => seen.push(q)}>
        <SearchableListInput autoFocus={false} />
      </SearchableList>,
    );
    type("abc");
    expect(input().value).toBe("abc");
    expect(seen).toEqual(["abc"]);
  });
});

describe("키보드 — 초점은 검색칸에", () => {
  it("↓ 는 첫 줄 · ↑ 는 마지막 줄에서 시작하고 끝에서 멈춘다 — 분류 머리는 건너뛴다", () => {
    render(<Banks />);
    key("ArrowDown");
    expect(input().getAttribute("aria-activedescendant")).toBe(
      options()[0]!.id,
    );
    expect(options()[0]!.getAttribute("data-highlighted")).toBe("keyboard");
    for (let i = 0; i < 10; i++) key("ArrowDown");
    expect(input().getAttribute("aria-activedescendant")).toBe(
      options()[4]!.id,
    );
    key("ArrowUp");
    expect(input().getAttribute("aria-activedescendant")).toBe(
      options()[3]!.id,
    );
    // 인터넷은행 첫 줄에서 ↑ — 머리가 아니라 앞 분류의 마지막 줄로
    key("ArrowUp");
    expect(options()[2]!.getAttribute("data-highlighted")).toBe("keyboard");
  });

  it("강조가 없을 때 ↑ 는 마지막 줄", () => {
    render(<Banks />);
    key("ArrowUp");
    expect(input().getAttribute("aria-activedescendant")).toBe(
      options()[4]!.id,
    );
  });

  it("한 번에 한 줄만 강조되고, 초점은 검색칸에 그대로다", () => {
    render(<Banks />);
    key("ArrowDown");
    key("ArrowDown");
    expect(container.querySelectorAll("[data-highlighted]")).toHaveLength(1);
    expect(document.activeElement).not.toBe(options()[1]);
  });

  it("↓ ↑ 는 기본 동작(캐럿 이동)을 막는다", () => {
    render(<Banks />);
    expect(key("ArrowDown").defaultPrevented).toBe(true);
    expect(key("ArrowUp").defaultPrevented).toBe(true);
  });

  it("Enter 는 강조한 줄을 고른다", () => {
    const onValueChange = vi.fn();
    render(<Banks onValueChange={onValueChange} />);
    key("ArrowDown");
    key("ArrowDown");
    key("Enter");
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith("신한은행");
    // 비제어 — 라디오가 바뀐다
    expect(options()[1]!.getAttribute("aria-selected")).toBe("true");
  });

  it("강조가 없으면 Enter 는 아무것도 하지 않는다 — 폼을 제출하지 않는다", () => {
    const onValueChange = vi.fn();
    const onSubmit = vi.fn((e: Event) => e.preventDefault());
    render(
      <form onSubmit={(e) => onSubmit(e.nativeEvent)}>
        <Banks onValueChange={onValueChange} />
        <button type="submit">제출</button>
      </form>,
    );
    const event = key("Enter");
    expect(event.defaultPrevented).toBe(true);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("Esc — 검색어가 있으면 지운다(시트 · 팝오버가 닫히지 않게 막는다), 비었으면 그대로 둔다", () => {
    render(<Banks />);
    type("신한");
    const first = key("Escape");
    expect(first.defaultPrevented).toBe(true);
    expect(input().value).toBe("");
    const second = key("Escape");
    expect(second.defaultPrevented).toBe(false);
  });

  it("글자를 조합하는 동안(한글)의 ↓ ↑ Enter Esc 는 조합의 것이다", () => {
    const onValueChange = vi.fn();
    render(<Banks onValueChange={onValueChange} />);
    type("신한");
    key("ArrowDown", { isComposing: true });
    expect(input().hasAttribute("aria-activedescendant")).toBe(false);
    key("Enter", { isComposing: true });
    expect(onValueChange).not.toHaveBeenCalled();
    expect(key("Escape", { isComposing: true }).defaultPrevented).toBe(false);
    expect(input().value).toBe("신한");
    // 크로미움이 조합 중 keyCode 를 229 로 보내는 경우
    key("ArrowDown", { keyCode: 229 } as KeyboardEventInit);
    expect(input().hasAttribute("aria-activedescendant")).toBe(false);
  });

  it("밖에서 준 onKeyDown 이 막으면 묶음은 키를 쓰지 않는다", () => {
    render(
      <SearchableList placement="inline">
        <SearchableListInput
          autoFocus={false}
          onKeyDown={(e) => e.preventDefault()}
        />
        <SearchableListResults aria-label="a">
          <SearchableListItem value="a" title="a" />
        </SearchableListResults>
      </SearchableList>,
    );
    key("ArrowDown");
    expect(input().hasAttribute("aria-activedescendant")).toBe(false);
  });
});

describe("줄 누르기 · 마우스", () => {
  it("누르면 그 줄을 고른다 — 비제어는 라디오가 바뀌고, 제어는 값을 주는 쪽이 정한다", () => {
    const onValueChange = vi.fn();
    render(<Banks onValueChange={onValueChange} />);
    act(() => options()[2]!.click());
    expect(onValueChange).toHaveBeenCalledWith("우리은행");
    expect(options()[2]!.getAttribute("aria-selected")).toBe("true");
    render(<Banks value="국민은행" onValueChange={onValueChange} />);
    act(() => options()[2]!.click());
    expect(options()[0]!.getAttribute("aria-selected")).toBe("true");
    expect(options()[2]!.getAttribute("aria-selected")).toBe("false");
  });

  it("줄을 눌러도 초점은 검색칸에 남는다(mousedown 을 막는다)", () => {
    render(<Banks />);
    const event = new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      options()[0]!.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
  });

  it("마우스를 움직여 올린 줄이 강조된다 — 터치 · 펜은 아니다", () => {
    render(<Banks />);
    const move = (el: Element, pointerType: string) =>
      act(() => {
        const e = new Event("pointermove", { bubbles: true });
        Object.defineProperty(e, "pointerType", { value: pointerType });
        el.dispatchEvent(e);
      });
    move(options()[0]!, "touch");
    expect(container.querySelector("[data-highlighted]")).toBeNull();
    move(options()[1]!, "mouse");
    expect(options()[1]!.getAttribute("data-highlighted")).toBe("pointer");
    expect(input().getAttribute("aria-activedescendant")).toBe(
      options()[1]!.id,
    );
    // 키로 짚으면 한 줄만 남는다
    key("ArrowDown");
    expect(container.querySelectorAll("[data-highlighted]")).toHaveLength(1);
  });

  it("마우스가 목록을 떠나면 마우스로 짚은 강조만 지운다 — 키보드로 짚은 강조는 남는다(Q-007-2)", () => {
    render(<Banks />);
    // React 의 onPointerLeave 는 pointerout(relatedTarget 이 목록 밖)으로 합성된다
    const leave = (pointerType: string) =>
      act(() => {
        const out = new Event("pointerout", { bubbles: true });
        Object.defineProperty(out, "pointerType", { value: pointerType });
        Object.defineProperty(out, "relatedTarget", { value: document.body });
        listbox()!.dispatchEvent(out);
      });
    act(() => {
      const e = new Event("pointermove", { bubbles: true });
      Object.defineProperty(e, "pointerType", { value: "mouse" });
      options()[1]!.dispatchEvent(e);
    });
    expect(options()[1]!.getAttribute("data-highlighted")).toBe("pointer");
    leave("mouse");
    expect(container.querySelector("[data-highlighted]")).toBeNull();
    key("ArrowDown");
    expect(container.querySelector("[data-highlighted]")).not.toBeNull();
    leave("mouse");
    expect(
      container
        .querySelector("[data-highlighted]")!
        .getAttribute("data-highlighted"),
    ).toBe("keyboard");
  });

  it("matchesSearch — NFC · 대소문자 · 공백을 무시하고 이름 · 별칭 중 하나에 들면 맞다(초성은 아니다)", () => {
    expect(matchesSearch("", "국민은행")).toBe(true);
    expect(matchesSearch("kb", "국민은행", "KB")).toBe(true);
    expect(matchesSearch("모아카드", "모아 카드")).toBe(true);
    expect(matchesSearch("모아 카드", "모아카드")).toBe(true);
    expect(matchesSearch("각", "국민은행")).toBe(false);
    expect(matchesSearch("ㄱㅁ", "국민은행")).toBe(false);
    expect(matchesSearch("x", undefined, null)).toBe(false);
    // 조합형 한글(NFD)도 같은 글
    expect(matchesSearch("국민".normalize("NFD"), "국민은행")).toBe(true);
  });

  it("누르는 순간 기준 길이 max(높이, 폭 ÷ 4, 24) 를 잰다", () => {
    render(<Banks />);
    const row = options()[0]!;
    Object.defineProperty(row, "offsetHeight", {
      configurable: true,
      value: 46,
    });
    Object.defineProperty(row, "offsetWidth", {
      configurable: true,
      value: 360,
    });
    act(() => {
      row.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(row.style.getPropertyValue("--press-basis")).toBe("90");
  });

  it("강조한 줄이 걸러져 사라지면 강조도 지운다 — 없는 줄을 가리키지 않는다", () => {
    render(<Banks />);
    key("ArrowDown");
    key("ArrowDown");
    key("ArrowDown");
    const id = input().getAttribute("aria-activedescendant")!;
    expect(document.getElementById(id)).not.toBeNull();
    // 서버 결과가 바뀌어 그 줄이 빠진다(검색어는 그대로)
    render(
      <SearchableList placement="inline">
        <SearchableListInput autoFocus={false} />
        <SearchableListResults aria-label="새 결과">
          <SearchableListItem value="x" title="새 줄" />
        </SearchableListResults>
      </SearchableList>,
    );
    expect(input().hasAttribute("aria-activedescendant")).toBe(false);
  });
});

describe("서버 검색 — 마지막 입력 뒤 300ms 에 한 번", () => {
  it("6글자를 쳐도 요청은 한 번 — 마지막 검색어로", () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    render(<Banks onSearch={onSearch} />);
    for (const q of ["t", "ta", "tap", "tapt", "tapta", "taptap"]) {
      type(q);
      act(() => {
        vi.advanceTimersByTime(100);
      });
    }
    expect(onSearch).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(onSearch).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith("taptap");
  });

  it("searchDelay 로 바꾼다 · 지우기도 한 번 보낸다 · 닫히면(언마운트) 보내지 않는다", () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    render(<Banks onSearch={onSearch} searchDelay={500} />);
    type("a");
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(onSearch).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onSearch).toHaveBeenCalledWith("a");
    type("ab");
    render(<div />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it("onSearch 가 없으면 타이머를 걸지 않는다", () => {
    const spy = vi.spyOn(window, "setTimeout");
    render(<Banks />);
    type("a");
    expect(spy.mock.calls.some(([, delay]) => delay === 300)).toBe(false);
    spy.mockRestore();
  });
});

describe("열릴 때 초점 · 지금 값 보이기", () => {
  // 시트 · 팝오버(Radix FocusScope)가 열릴 때 표면에 보내는 이벤트를 흉내 낸다 — 표면(currentTarget)이 이벤트를 받는다
  function openSurface(node: ReactNode) {
    render(
      <div
        data-testid="surface"
        ref={(el) => {
          el?.addEventListener("open-focus", focusSearchableList);
        }}
      >
        {node}
      </div>,
    );
    const event = new Event("open-focus", { cancelable: true });
    act(() => {
      container.querySelector("[data-testid=surface]")!.dispatchEvent(event);
    });
    return event;
  }

  it("검색칸은 스스로 초점을 가져가지 않는다 — 시트 · 팝오버의 첫 초점은 focusSearchableList 로 넘겨받는다", () => {
    render(<Banks placement="sheet" />);
    expect(document.activeElement).not.toBe(input());
    render(<div />);
    render(<Banks placement="inline" autoFocus />);
    expect(document.activeElement).toBe(input());
  });

  it("focusSearchableList — 첫 초점을 표면 대신 검색칸에 준다(기본 동작을 막는다)", () => {
    const event = openSurface(<Banks placement="sheet" />);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(input());
  });

  it("focusSearchableList — 검색칸이 없는 표면은 건드리지 않는다", () => {
    const event = openSurface(<p>내용</p>);
    expect(event.defaultPrevented).toBe(false);
  });

  it("열면 지금 값이 붙은 검색칸 아래 영역의 가운데에 오게 스크롤한다", () => {
    // jsdom 은 레이아웃이 없다 — 스크롤 영역(0 ~ 200) · 검색칸(아래 40) · 지금 값 줄(500, 높이 46)의 자리를 정해 준다
    const rect = (top: number, height: number) =>
      ({ top, bottom: top + height, height }) as DOMRect;
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        if (this.getAttribute("data-testid") === "scroller")
          return rect(0, 200);
        if (this.getAttribute("data-slot") === "searchable-list-field")
          return rect(0, 40);
        if (this.getAttribute("aria-selected") === "true") return rect(500, 46);
        return rect(0, 0);
      },
    );
    render(
      <div
        data-testid="scroller"
        style={{ overflowY: "auto" }}
        ref={(el) => {
          if (!el) return;
          Object.defineProperty(el, "scrollHeight", {
            configurable: true,
            value: 900,
          });
          Object.defineProperty(el, "clientHeight", {
            configurable: true,
            value: 200,
          });
        }}
      >
        <Banks placement="sheet" defaultValue="우리은행" />
      </div>,
    );
    act(() => {
      const scroller = container.querySelector("[data-testid=scroller]")!;
      scroller.addEventListener("open-focus", focusSearchableList);
      scroller.dispatchEvent(new Event("open-focus", { cancelable: true }));
    });
    // (500 + 23) − (40 + (200 − 40) ÷ 2) = 403
    expect(
      container.querySelector<HTMLElement>("[data-testid=scroller]")!.scrollTop,
    ).toBe(403);
    vi.restoreAllMocks();
  });
});

describe("0건 · 실패 · 불러오는 줄", () => {
  it("0건 — 검색어로 제목을 만들고 알린다(role=status)", () => {
    render(<Banks />);
    type("나루로리롱");
    const status = container.querySelector("[role=status]")!;
    expect(status.getAttribute("data-slot")).toBe("searchable-list-empty");
    expect(status.textContent).toContain(
      '"나루로리롱"에 대한 검색 결과가 없어요',
    );
    expect(listbox()).toBeNull();
  });

  it("0건 — 공백만이면 검색어를 넣지 않고, 제목 · 설명을 바꿀 수 있다", () => {
    render(
      <SearchableList placement="inline" defaultQuery="   ">
        <SearchableListEmpty />
      </SearchableList>,
    );
    expect(container.textContent).toContain("검색 결과가 없어요");
    expect(container.textContent).not.toContain("''");
    render(
      <SearchableList placement="inline" defaultQuery="x">
        <SearchableListEmpty
          title="맞는 카드가 없어요"
          description="카드사 이름으로도 찾아보세요."
        />
      </SearchableList>,
    );
    expect(container.textContent).toContain("맞는 카드가 없어요");
    expect(container.textContent).toContain("카드사 이름으로도 찾아보세요.");
  });

  it("긴 검색어도 제목에 그대로 들어간다", () => {
    const long = "가".repeat(200);
    render(
      <SearchableList placement="inline" defaultQuery={long}>
        <SearchableListEmpty />
      </SearchableList>,
    );
    expect(container.textContent).toContain(
      `"${long}"에 대한 검색 결과가 없어요`,
    );
  });

  it("실패 — 0건과 따로 쓰고 다시 시도가 onRetry 를 부른다", () => {
    const onRetry = vi.fn();
    render(
      <SearchableList placement="inline" defaultQuery="신한">
        <SearchableListError onRetry={onRetry} />
      </SearchableList>,
    );
    const status = container.querySelector("[role=status]")!;
    expect(status.getAttribute("data-slot")).toBe("searchable-list-error");
    expect(status.textContent).toContain("검색 결과를 불러오지 못했어요");
    expect(status.textContent).not.toContain("검색 결과가 없어요");
    const retry = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "다시 시도",
    )!;
    act(() => retry.click());
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("실패 — 다시 시도 중이면 버튼이 로딩이다", () => {
    render(
      <SearchableList placement="inline">
        <SearchableListError onRetry={() => {}} retrying />
      </SearchableList>,
    );
    const retry = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("다시 시도"),
    )!;
    expect(retry.getAttribute("aria-busy") ?? retry.disabled).toBeTruthy();
  });

  it("결과가 있을 때는 개수를 알리지 않는다 — 알림 자리가 없다", () => {
    render(<Banks />);
    expect(container.querySelector("[role=status]")).toBeNull();
    expect(container.querySelector("[aria-live]")).toBeNull();
  });

  it("스켈레톤 — 기본 5줄 · 보조 기술에 숨김 · 앞 자리별 모양", () => {
    render(
      <SearchableList placement="inline">
        <SearchableListSkeleton />
      </SearchableList>,
    );
    const sk = container.querySelector("[data-slot=searchable-list-skeleton]")!;
    expect(sk.getAttribute("aria-hidden")).toBe("true");
    expect(
      sk.querySelectorAll("[data-slot=searchable-list-skeleton-row]"),
    ).toHaveLength(5);
    // 앞 자리 없음 — 줄마다 제목 + 설명 두 막대
    expect(sk.querySelectorAll("[data-slot=skeleton]").length).toBe(10);
    for (const [prefix, cls] of [
      ["logo", "size-[40px]"],
      ["cardArt", "w-[56px]"],
      ["avatar", "size-[42px]"],
    ] as const) {
      render(
        <SearchableList placement="inline">
          <SearchableListSkeleton prefix={prefix} rows={2} />
        </SearchableList>,
      );
      const rows = container.querySelectorAll(
        "[data-slot=searchable-list-skeleton-row]",
      );
      expect(rows).toHaveLength(2);
      expect(rows[0]!.querySelectorAll(`.${CSS.escape(cls)}`).length).toBe(1);
    }
  });
});

describe("자리 · 모양 클래스", () => {
  it("검색칸은 위에 붙고 놓인 자리의 면을 칠한다 — 시트 floating · 단계 default", () => {
    render(<Banks placement="sheet" autoFocus={false} />);
    const field = container.querySelector("[data-slot=searchable-list-field]")!;
    expect(classes(field)).toEqual(
      expect.arrayContaining([
        "sticky",
        "top-0",
        "px-global-gutter",
        "bg-bg-layer-floating",
      ]),
    );
    render(<Banks placement="inline" />);
    expect(
      classes(container.querySelector("[data-slot=searchable-list-field]")!),
    ).toContain("bg-bg-layer-default");
  });

  it("크기는 검색칸에 간다 — 기본 responsive", () => {
    render(<Banks />);
    expect(
      container
        .querySelector("[data-slot=text-input]")!
        .getAttribute("data-size"),
    ).toBe("responsive");
    render(<Banks size="medium" />);
    expect(
      container
        .querySelector("[data-slot=text-input]")!
        .getAttribute("data-size"),
    ).toBe("medium");
  });

  it("강조 바탕은 좌우 6 들어온 누름 바탕 · 모서리 10, 마우스로 올린 바탕만 전환한다", () => {
    render(<Banks />);
    const c = classes(options()[0]!);
    // 바탕은 줄 폭 전체(0 · 모서리 0)에서 짚으면 좌우 6 · 모서리 10 — 150ms 로 함께 바뀐다(Q-009-3 B)
    expect(c).toEqual(
      expect.arrayContaining([
        "before:inset-x-0",
        "before:rounded-none",
        "data-[highlighted]:before:inset-x-x1_5",
        "data-[highlighted]:before:rounded-r2_5",
        "data-[highlighted]:before:bg-bg-layer-default-pressed",
        "active:before:inset-x-x1_5",
        "active:before:rounded-r2_5",
        "active:before:bg-bg-layer-default-pressed",
      ]),
    );
    const joined = c.join(" ");
    expect(joined).toContain("inset_var(--motion-duration-color-transition)");
    expect(joined).toContain(
      "border-radius_var(--motion-duration-color-transition)",
    );
    // 화살표로 옮기는 동안(결과 목록이 keyboard 표식)은 전환 없이 바로
    expect(c).toContain(
      "[[data-highlight-source=keyboard]_&]:before:transition-none",
    );
  });

  it("누르면 콘텐츠만 2px 거리로 준다 — 모션 줄이기면 하지 않는다", () => {
    render(<Banks />);
    const content = classes(
      container.querySelector("[data-slot=searchable-list-item-content]")!,
    );
    expect(content).toEqual(
      expect.arrayContaining([
        "group-active/sl-option:[scale:calc(1-2/var(--press-basis))]",
        "motion-reduce:group-active/sl-option:[scale:1]",
        "px-global-gutter",
        "py-x3",
      ]),
    );
  });

  it("제목 16 / 22 · 설명 13 / 18, 분류 머리는 mediumWeak, 묶음은 검색칸 ↔ 목록 8", () => {
    render(
      <SearchableList placement="inline">
        <SearchableListInput autoFocus={false} />
        <SearchableListResults aria-label="a">
          <SearchableListGroup label="증권사">
            <SearchableListItem value="a" title="a" detail="b" />
          </SearchableListGroup>
        </SearchableListResults>
      </SearchableList>,
    );
    expect(
      classes(
        container.querySelector("[data-slot=searchable-list-item-title]")!,
      ),
    ).toEqual(
      expect.arrayContaining(["text-t5", "font-normal", "text-fg-neutral"]),
    );
    expect(
      classes(
        container.querySelector("[data-slot=searchable-list-item-detail]")!,
      ),
    ).toEqual(expect.arrayContaining(["text-t3", "text-fg-neutral-subtle"]));
    expect(
      classes(
        container.querySelector("[data-slot=searchable-list-group-label]")!,
      ),
    ).toEqual(
      expect.arrayContaining(["font-medium", "text-fg-neutral-subtle"]),
    );
    expect(
      classes(container.querySelector("[data-slot=searchable-list]")!),
    ).toContain("gap-x2");
  });
});

describe("가장 나쁜 값", () => {
  it("목록 수백 개 — ↑ ↓ 가 끝에서 멈추고 줄 수는 그대로", () => {
    const many = Array.from({ length: 400 }, (_, i) => `종목 ${i}`);
    render(
      <SearchableList placement="inline">
        <SearchableListInput autoFocus={false} />
        <SearchableListResults aria-label="종목">
          {many.map((n) => (
            <SearchableListItem key={n} value={n} title={n} />
          ))}
        </SearchableListResults>
      </SearchableList>,
    );
    expect(options()).toHaveLength(400);
    key("ArrowUp");
    expect(input().getAttribute("aria-activedescendant")).toBe(
      options()[399]!.id,
    );
    key("ArrowDown");
    expect(input().getAttribute("aria-activedescendant")).toBe(
      options()[399]!.id,
    );
  });

  it("긴 이름은 줄바꿈으로 감싼다 — 단어 단위(keep-all) + 어디서든 끊긴다", () => {
    render(
      <SearchableList placement="inline">
        <SearchableListResults aria-label="a">
          <SearchableListItem value="a" title={"가".repeat(300)} />
        </SearchableListResults>
      </SearchableList>,
    );
    const text = container.querySelector(
      "[data-slot=searchable-list-item-title]",
    )!.parentElement!;
    expect(classes(text)).toEqual(
      expect.arrayContaining(["min-w-0", "flex-1", "break-keep"]),
    );
  });

  it("빈 목록 · 검색어 없는 0건도 깨지지 않는다", () => {
    render(
      <SearchableList placement="inline">
        <SearchableListInput autoFocus={false} />
        <SearchableListResults aria-label="a" />
      </SearchableList>,
    );
    expect(options()).toHaveLength(0);
    expect(key("ArrowDown").defaultPrevented).toBe(true);
    expect(input().hasAttribute("aria-activedescendant")).toBe(false);
    expect(key("Enter").defaultPrevented).toBe(true);
  });
});

describe("팝오버 안 — 열면 초점이 검색칸, Esc 는 검색어 → 닫기", () => {
  function InPopover() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button">열기</button>
        </PopoverTrigger>
        <PopoverContent
          aria-label="은행 선택"
          onOpenAutoFocus={focusSearchableList}
        >
          <SearchableList
            query={query}
            onQueryChange={setQuery}
            onValueChange={() => setOpen(false)}
          >
            <SearchableListInput placeholder="은행 이름 검색" />
            <SearchableListResults aria-label="은행">
              <SearchableListItem value="a" title="국민은행" />
              <SearchableListItem value="b" title="신한은행" />
            </SearchableListResults>
          </SearchableList>
        </PopoverContent>
      </Popover>
    );
  }
  const opener = () =>
    Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "열기",
    )!;
  const panel = () =>
    document.querySelector<HTMLElement>("[data-slot=popover-content]");

  it("열면 검색칸에 초점이 간다", () => {
    vi.useFakeTimers();
    render(<InPopover />);
    act(() => opener().click());
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(panel()).not.toBeNull();
    expect(document.activeElement?.getAttribute("role")).toBe("combobox");
  });

  it("Esc — 검색어가 있으면 지우고 열린 채, 비었으면 닫는다", () => {
    vi.useFakeTimers();
    render(<InPopover />);
    act(() => opener().click());
    act(() => {
      vi.advanceTimersByTime(50);
    });
    const field = document.querySelector<HTMLInputElement>("input")!;
    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(field, "신");
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const esc = () =>
      act(() => {
        field.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Escape",
            bubbles: true,
            cancelable: true,
          }),
        );
      });
    esc();
    expect(field.value).toBe("");
    expect(panel()).not.toBeNull();
    esc();
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(panel()).toBeNull();
  });

  it("Enter 로 고르면 닫힌다", () => {
    vi.useFakeTimers();
    render(<InPopover />);
    act(() => opener().click());
    act(() => {
      vi.advanceTimersByTime(50);
    });
    const field = document.querySelector<HTMLInputElement>("input")!;
    const press = (k: string) =>
      act(() => {
        field.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: k,
            bubbles: true,
            cancelable: true,
          }),
        );
      });
    press("ArrowDown");
    press("Enter");
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(panel()).toBeNull();
  });
});

describe("selectionMark", () => {
  const radios = () =>
    container.querySelectorAll("[data-slot=searchable-list-item-radio]");
  const list = (mark?: "on" | "off") => (
    <SearchableList selectionMark={mark}>
      <SearchableListInput placeholder="검색" />
      <SearchableListResults aria-label="결과">
        <SearchableListItem value="a" title="가" />
        <SearchableListItem value="b" title="나" />
      </SearchableListResults>
    </SearchableList>
  );

  it("기본(on)은 줄마다 오른쪽 라디오가 있다", () => {
    render(list());
    expect(radios()).toHaveLength(2);
  });

  it("off 는 라디오가 없고 줄 최소 높이 48 을 지키며, 눌러도 값을 들지 않는다", () => {
    const onValueChange = vi.fn();
    render(
      <SearchableList selectionMark="off" onValueChange={onValueChange}>
        <SearchableListInput placeholder="검색" />
        <SearchableListResults aria-label="결과">
          <SearchableListItem value="a" title="가" />
        </SearchableListResults>
      </SearchableList>,
    );
    expect(radios()).toHaveLength(0);
    const content = container.querySelector<HTMLElement>(
      "[data-slot=searchable-list-item-content]",
    )!;
    expect(classes(content)).toContain("min-h-x12");
    act(() => options()[0]!.click());
    expect(onValueChange).toHaveBeenCalledWith("a");
    expect(options()[0]!.getAttribute("aria-selected")).toBe("false");
  });
});
