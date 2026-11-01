// Chip 의 동작 — 모양 · 색은 scripts/check-ds-spec.mjs 가 크로미움에서 스펙 값과 맞춘다. 재지 못하는 값(안쪽 1px 테두리 · 44 영역 ·
// 축소 · 전환 · 묶음 포커스 링 · 마스크)은 여기서 클래스 · 속성으로 본다(chip.measure.mjs 머리).
import { act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChevronDown, Tag } from "lucide-react";

import { Field } from "@/shared/ds/field";

import {
  Chip,
  ChipGroup,
  ChipRadio,
  ChipRadioGroup,
  ChipToggle,
  InputChip,
} from "./chip";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // 가로 스크롤 줄의 끝 흐림이 토큰을 못 읽는다는 경고 — jsdom 은 토큰 CSS 를 읽지 않는다
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function render(node: ReactNode) {
  act(() => root.render(node));
  return container.firstElementChild as HTMLElement;
}

const q = <T extends HTMLElement>(selector: string) =>
  container.querySelector<T>(selector)!;
const all = <T extends HTMLElement>(selector: string) =>
  Array.from(container.querySelectorAll<T>(selector));
const key = (el: Element, k: string, type: "keydown" | "keyup" = "keydown") =>
  el.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true }));

describe("Chip (버튼)", () => {
  it("버튼이다 — 폼 안에서도 제출하지 않고(type=button), aria-pressed 를 쓰지 않는다", () => {
    const onClick = vi.fn();
    const submit = vi.fn((e: Event) => e.preventDefault());
    render(
      <form onSubmit={(e) => submit(e.nativeEvent)}>
        <Chip onClick={onClick} selected>
          식비
        </Chip>
      </form>,
    );
    const chip = q<HTMLButtonElement>("[data-slot=chip]");
    expect(chip.tagName).toBe("BUTTON");
    expect(chip.type).toBe("button");
    act(() => chip.click());
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();
    expect(chip.hasAttribute("aria-pressed")).toBe(false);
    // 고른 모습은 보이기만 한다 — data-selected(Popover 트리거의 data-state 와 겹치지 않는다)
    expect(chip.hasAttribute("data-selected")).toBe(true);
    expect(chip.hasAttribute("data-state")).toBe(false);
  });

  it("고른 모습이 없으면 data-selected 도 없다 — 제안 칩", () => {
    render(<Chip variant="solid">10만</Chip>);
    expect(q("[data-slot=chip]").hasAttribute("data-selected")).toBe(false);
  });

  it("앞 · 뒤 아이콘은 장식이다(aria-hidden) — 글만 이름이 된다", () => {
    render(
      <Chip prefixIcon={<Tag />} suffixIcon={<ChevronDown />}>
        기간
      </Chip>,
    );
    expect(q("[data-slot=chip-prefix-icon]").getAttribute("aria-hidden")).toBe(
      "true",
    );
    expect(q("[data-slot=chip-suffix-icon]").getAttribute("aria-hidden")).toBe(
      "true",
    );
    expect(q("[data-slot=chip]").textContent).toBe("기간");
  });

  it("아이콘만 있는 칩은 이름이 없으면 개발 중에 경고한다", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <Chip layout="iconOnly" aria-label="필터 지우기">
        <Tag />
      </Chip>,
    );
    expect(warn).not.toHaveBeenCalled();
    act(() =>
      root.render(
        <Chip layout="iconOnly">
          <Tag />
        </Chip>,
      ),
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toContain("이름이 없다");
  });

  it("asChild — 자식 요소(링크)가 칩이 된다, 앞 · 뒤 아이콘을 자식 둘레에 둔다", () => {
    render(
      <Chip asChild suffixIcon={<ChevronDown />}>
        <a href="/x">더 보기</a>
      </Chip>,
    );
    const link = q("a");
    expect(link.getAttribute("data-slot")).toBe("chip");
    expect(link.textContent).toBe("더 보기");
    expect(link.querySelector("[data-slot=chip-suffix-icon]")).not.toBeNull();
  });

  it("누르는 순간 기준 길이(max(높이, 폭 ÷ 4, 24))를 --press-basis 로 넘긴다 — 포인터 · Space · Enter", () => {
    render(<Chip>식비</Chip>);
    const chip = q<HTMLButtonElement>("[data-slot=chip]");
    // jsdom 은 레이아웃이 없다 — 크기를 대신 준다
    Object.defineProperty(chip, "offsetHeight", { value: 36 });
    Object.defineProperty(chip, "offsetWidth", { value: 200 });
    act(() => {
      chip.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(chip.style.getPropertyValue("--press-basis")).toBe("50");
    chip.style.removeProperty("--press-basis");
    act(() => {
      key(chip, " ");
    });
    expect(chip.style.getPropertyValue("--press-basis")).toBe("50");
    chip.style.removeProperty("--press-basis");
    act(() => {
      key(chip, "a");
    });
    expect(chip.style.getPropertyValue("--press-basis")).toBe("");
  });

  it("스펙의 모양 규칙을 클래스로 건다 — 44 영역 · 축소 · 안쪽 1px · 막힘(고른 채 막힘은 짙은 1px)", () => {
    render(
      <Chip variant="outlineWeak" selected disabled>
        식비
      </Chip>,
    );
    const cls = q("[data-slot=chip]").className;
    expect(cls).toContain("before:min-h-[44px]");
    expect(cls).toContain("before:min-w-[44px]");
    expect(cls).toContain("active:[scale:calc(1-2/var(--press-basis))]");
    expect(cls).toContain("motion-reduce:active:[scale:1]");
    expect(cls).toContain("focus-visible:outline-2");
    expect(cls).toContain("focus-visible:outline-offset-2");
    expect(cls).toContain(
      "shadow-[inset_0_0_0_1px_var(--color-stroke-neutral-weak)]",
    );
    expect(cls).toContain(
      "shadow-[inset_0_0_0_1px_var(--color-stroke-neutral-contrast)]",
    );
    expect(cls).toContain("disabled:bg-bg-disabled");
    expect(cls).toContain(
      "disabled:shadow-[inset_0_0_0_1px_var(--color-stroke-neutral-solid)]",
    );
    // 흐리게 하지 않는다(v106)
    expect(cls).not.toContain("opacity");
  });

  it("막힌 Solid(안 고름)는 바탕을 그대로 두고 글 · 아이콘만 fg-disabled — 다른 변형은 bg-disabled(03-B 결정 1 A)", () => {
    render(
      <>
        <Chip variant="solid" disabled>
          솔리드
        </Chip>
        <Chip variant="outlineWeak" disabled>
          윤곽
        </Chip>
        <Chip variant="solid" selected disabled>
          고른 솔리드
        </Chip>
      </>,
    );
    const [solid, outline, picked] = all("[data-slot=chip]");
    expect(solid!.className).toContain("disabled:bg-bg-neutral-weak-alpha");
    expect(solid!.className.split(" ")).not.toContain(
      "disabled:bg-bg-disabled",
    );
    expect(solid!.className).toContain("disabled:text-fg-disabled");
    expect(outline!.className).toContain("disabled:bg-bg-disabled");
    // 고른 채 막힘은 회색 채움 + 짙은 1px (스펙 solid selected disabled)
    expect(picked!.className).toContain(
      "[&:is([data-state=checked],[data-selected])]:disabled:bg-bg-disabled",
    );
  });

  it("줄보다 긴 칩은 줄 폭에서 멈추고 글만 말줄임 — 아이콘은 줄지 않는다(03-E 결정 2 A)", () => {
    render(
      <Chip prefixIcon={<Tag />} suffixIcon={<ChevronDown />}>
        주말 가족 여행 준비 장보기 목록
      </Chip>,
    );
    const chip = q("[data-slot=chip]");
    expect(chip.className).toContain("max-w-full");
    const label = q("[data-slot=chip-label]");
    expect(label.className).toContain("truncate");
    expect(label.className).toContain("min-w-0");
    expect(label.textContent).toBe("주말 가족 여행 준비 장보기 목록");
    expect(q("[data-slot=chip-prefix-icon]").className).toContain("shrink-0");
    expect(q("[data-slot=chip-suffix-icon]").className).toContain("shrink-0");
  });

  it("아이콘만 있는 칩은 글 칸으로 감싸지 않는다", () => {
    render(
      <Chip layout="iconOnly" aria-label="필터 지우기">
        <Tag />
      </Chip>,
    );
    expect(container.querySelector("[data-slot=chip-label]")).toBeNull();
    expect(q("[data-slot=chip] > svg")).not.toBeNull();
  });

  it("Outline Strong 은 고르면 테두리를 지운다 · Solid 는 고르면 짙은 채움", () => {
    render(
      <>
        <Chip variant="outlineStrong">a</Chip>
        <Chip variant="solid">b</Chip>
      </>,
    );
    const [strong, solid] = all("[data-slot=chip]");
    expect(strong!.className).toContain("shadow-none");
    expect(solid!.className).toContain("bg-bg-neutral-inverted");
    expect(solid!.className).toContain("text-fg-neutral-inverted");
  });

  it("크기마다 높이 · 최소 폭 · 좌우 여백이 다르다 — small 32 · medium 36 · large 40", () => {
    render(
      <>
        <Chip size="small">a</Chip>
        <Chip>b</Chip>
        <Chip size="large">c</Chip>
        <Chip layout="iconOnly" aria-label="x">
          <Tag />
        </Chip>
      </>,
    );
    const [s, m, l, icon] = all("[data-slot=chip]");
    expect(s!.className).toContain("min-h-[32px]");
    expect(s!.className).toContain("min-w-[44px]");
    expect(s!.className).toMatch(/ px-x3(?: |$)/);
    expect(m!.className).toContain("min-h-[36px]");
    expect(m!.className).toContain("min-w-[48px]");
    expect(m!.className).toContain("px-x3_5");
    expect(l!.className).toContain("min-h-[40px]");
    expect(l!.className).toContain("min-w-[52px]");
    expect(l!.className).toContain("px-x4");
    // 글이 있는 칩은 위아래 (높이 − 19) ÷ 2 — 글자 크기 설정이 커지면 줄 높이를 따라 늘어난다(100% 는 min-h 와 같은 32 · 36 · 40)
    expect(s!.className).toContain("py-[6.5px]");
    expect(m!.className).toContain("py-[8.5px]");
    expect(l!.className).toContain("py-[10.5px]");
    // 아이콘만 있는 칩은 원 — 폭 = 높이, 좌우 여백 없음
    expect(icon!.className).toContain("w-[36px]");
    expect(icon!.className).toContain("px-0");
  });

  it("긴 이름은 줄바꿈 · 말줄임하지 않고 글만큼 넓어진다", () => {
    render(<Chip>신한카드 마이 포인트 플러스 체크카드</Chip>);
    const cls = q("[data-slot=chip]").className;
    expect(cls).toContain("whitespace-nowrap");
    expect(cls).toContain("shrink-0");
    expect(cls).not.toContain("truncate");
  });
});

describe("ChipToggle (여럿 고르기)", () => {
  const Alarms = ({ onChange }: { onChange?: (on: boolean) => void }) => {
    const [alarms, setAlarms] = useState<string[]>([]);
    return (
      <Field label="알림">
        <ChipGroup>
          {["당일", "1일 전", "3일 전"].map((t) => (
            <ChipToggle
              key={t}
              checked={alarms.includes(t)}
              onCheckedChange={(on) => {
                onChange?.(on);
                setAlarms((now) =>
                  on ? [...now, t] : now.filter((x) => x !== t),
                );
              }}
            >
              {t}
            </ChipToggle>
          ))}
        </ChipGroup>
      </Field>
    );
  };

  it("체크박스다 — 누르면 고르고 다시 누르면 풀린다, 콜백은 boolean", () => {
    const onChange = vi.fn();
    render(<Alarms onChange={onChange} />);
    const boxes = () => all<HTMLButtonElement>("[role=checkbox]");
    expect(boxes().map((b) => b.getAttribute("aria-checked"))).toEqual([
      "false",
      "false",
      "false",
    ]);
    act(() => boxes()[1]!.click());
    expect(boxes()[1]!.getAttribute("aria-checked")).toBe("true");
    expect(boxes()[1]!.getAttribute("data-state")).toBe("checked");
    expect(onChange).toHaveBeenLastCalledWith(true);
    act(() => boxes()[1]!.click());
    expect(boxes()[1]!.getAttribute("aria-checked")).toBe("false");
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it("칩마다 Tab 이 선다(tabIndex 를 로빙하지 않는다) — 막히면 누를 수 없다", () => {
    const onCheckedChange = vi.fn();
    render(
      <ChipGroup aria-label="알림">
        <ChipToggle>당일</ChipToggle>
        <ChipToggle disabled onCheckedChange={onCheckedChange}>
          1일 전
        </ChipToggle>
      </ChipGroup>,
    );
    const [a, b] = all<HTMLButtonElement>("[role=checkbox]");
    expect(a!.tabIndex).toBe(0);
    expect(b!.disabled).toBe(true);
    act(() => b!.click());
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it("Field 의 라벨이 묶음의 이름이다(aria-labelledby)", () => {
    render(<Alarms />);
    const group = q("[data-slot=chip-group]");
    const label = group.getAttribute("aria-labelledby")!;
    expect(document.getElementById(label)?.textContent).toContain("알림");
  });
});

describe("ChipRadioGroup (하나 고르기)", () => {
  const Type = ({
    onValueChange,
    value,
  }: {
    onValueChange?: (v: string) => void;
    value?: string;
  }) => (
    <ChipRadioGroup
      aria-label="거래 종류"
      value={value}
      defaultValue={value === undefined ? "expense" : undefined}
      onValueChange={onValueChange}
    >
      <ChipRadio variant="outlineStrong" value="expense">
        지출
      </ChipRadio>
      <ChipRadio variant="outlineStrong" value="income">
        수입
      </ChipRadio>
      <ChipRadio variant="outlineStrong" value="transfer" disabled>
        이체
      </ChipRadio>
    </ChipRadioGroup>
  );
  const radios = () => all<HTMLButtonElement>("[role=radio]");

  it("라디오 묶음이다 — 고른 칩만 aria-checked · Tab 이 선다", () => {
    const group = render(<Type />);
    expect(group.getAttribute("role")).toBe("radiogroup");
    expect(group.getAttribute("aria-label")).toBe("거래 종류");
    expect(radios().map((r) => r.getAttribute("aria-checked"))).toEqual([
      "true",
      "false",
      "false",
    ]);
    expect(radios().map((r) => r.tabIndex)).toEqual([0, -1, -1]);
  });

  it("누르면 고르고, 고른 칩을 다시 눌러도 풀리지 않는다", () => {
    const onValueChange = vi.fn();
    render(<Type onValueChange={onValueChange} />);
    act(() => radios()[1]!.click());
    expect(radios()[1]!.getAttribute("aria-checked")).toBe("true");
    expect(onValueChange).toHaveBeenLastCalledWith("income");
    act(() => radios()[1]!.click());
    expect(radios()[1]!.getAttribute("aria-checked")).toBe("true");
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it("화살표로 옮기면 바로 고른다 — 막힌 칩은 건너뛰고 끝에서 처음으로 돈다", () => {
    vi.useFakeTimers();
    render(<Type />);
    act(() => radios()[0]!.focus());
    act(() => {
      key(radios()[0]!, "ArrowRight");
      vi.runAllTimers();
    });
    expect(document.activeElement).toBe(radios()[1]);
    expect(radios()[1]!.getAttribute("aria-checked")).toBe("true");
    act(() => {
      key(radios()[1]!, "ArrowRight", "keyup");
      key(radios()[1]!, "ArrowDown");
      vi.runAllTimers();
    });
    // 막힌 "이체" 를 건너뛰어 처음으로
    expect(document.activeElement).toBe(radios()[0]);
    expect(radios()[0]!.getAttribute("aria-checked")).toBe("true");
  });

  it("값을 밖에서 쥐면 그 값을 따른다 — Tab 이 서는 칩도 고른 칩을 따라간다", () => {
    const Controlled = () => {
      const [type, setType] = useState("expense");
      return (
        <>
          <Type onValueChange={setType} value={type} />
          <button type="button" onClick={() => setType("income")}>
            수입으로
          </button>
        </>
      );
    };
    render(<Controlled />);
    expect(radios().map((r) => r.tabIndex)).toEqual([0, -1, -1]);
    act(() =>
      container.querySelector<HTMLButtonElement>("button:not([role])")!.click(),
    );
    expect(radios()[1]!.getAttribute("aria-checked")).toBe("true");
    expect(radios().map((r) => r.tabIndex)).toEqual([-1, 0, -1]);
  });

  it("고른 칩의 모습은 data-state=checked 가 칠한다(Chip 의 data-selected 와 같은 규칙)", () => {
    render(<Type />);
    expect(radios()[0]!.getAttribute("data-state")).toBe("checked");
    expect(radios()[0]!.className).toContain("[&:is([data-state=checked]");
  });
});

describe("InputChip (입력값)", () => {
  const People = ({ initial }: { initial: string[] }) => {
    const [people, setPeople] = useState(initial);
    return (
      <ChipGroup aria-label="참여자">
        {people.map((p) => (
          <InputChip
            key={p}
            onRemove={() => setPeople((now) => now.filter((x) => x !== p))}
          >
            {p}
          </InputChip>
        ))}
      </ChipGroup>
    );
  };
  const removes = () => all<HTMLButtonElement>("[data-slot=input-chip-remove]");
  // 지운 다음 프레임에 포커스를 옮긴다 — 프레임 콜백을 바로 돌린다
  const frames = () => {
    const queue: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      queue.push(cb);
      return queue.length;
    });
    return () => act(() => queue.splice(0).forEach((cb) => cb(0)));
  };

  it("칩 자체는 버튼이 아니다 — 지우기 버튼 하나만 있고 이름은 “{글} 지우기”", () => {
    render(<People initial={["김하나", "이둘"]} />);
    expect(all("[data-slot=input-chip]")).toHaveLength(2);
    expect(removes().map((b) => b.getAttribute("aria-label"))).toEqual([
      "김하나 지우기",
      "이둘 지우기",
    ]);
    expect(all("[data-slot=input-chip] button")).toHaveLength(2);
    expect(removes()[0]!.type).toBe("button");
  });

  it("글이 문자열이 아니면 화면의 글 + “지우기” 로 읽힌다 · removeLabel 이 이긴다", () => {
    render(
      <>
        <InputChip onRemove={() => {}}>
          <b>김하나</b>
        </InputChip>
        <InputChip onRemove={() => {}} removeLabel="참여자 빼기">
          <b>이둘</b>
        </InputChip>
      </>,
    );
    const [a, b] = removes();
    expect(a!.getAttribute("aria-label")).toBeNull();
    const ids = a!.getAttribute("aria-labelledby")!.split(" ");
    expect(ids.map((id) => document.getElementById(id)?.textContent)).toEqual([
      "김하나",
      "지우기",
    ]);
    expect(b!.getAttribute("aria-label")).toBe("참여자 빼기");
  });

  it("지우면 그 값만 빠지고 포커스는 다음 칩의 지우기로 간다", () => {
    const flush = frames();
    render(<People initial={["김하나", "이둘", "박셋"]} />);
    act(() => removes()[0]!.focus());
    act(() => removes()[0]!.click());
    flush();
    expect(
      all("[data-slot=input-chip-label]").map((e) => e.textContent),
    ).toEqual(["이둘", "박셋"]);
    expect(document.activeElement).toBe(removes()[0]);
    expect(removes()[0]!.getAttribute("aria-label")).toBe("이둘 지우기");
  });

  it("마지막 칩을 지우면 앞 칩의 지우기로, 다 지우면 묶음으로 간다", () => {
    const flush = frames();
    render(<People initial={["김하나", "이둘"]} />);
    act(() => removes()[1]!.click());
    flush();
    expect(document.activeElement).toBe(removes()[0]);
    act(() => removes()[0]!.click());
    flush();
    expect(removes()).toHaveLength(0);
    expect(document.activeElement).toBe(q("[data-slot=chip-group]"));
  });

  it("막힌 입력값 칩은 지울 수 없고 회색 바탕 + 짙은 1px 이다", () => {
    const onRemove = vi.fn();
    render(
      <InputChip disabled onRemove={onRemove}>
        김하나
      </InputChip>,
    );
    expect(removes()[0]!.disabled).toBe(true);
    act(() => removes()[0]!.click());
    expect(onRemove).not.toHaveBeenCalled();
    const cls = q("[data-slot=input-chip]").className;
    expect(cls).toContain("data-[disabled]:bg-bg-disabled");
    expect(cls).toContain("stroke-neutral-solid");
  });

  it("지우기에 키보드 포커스가 있으면 칩 둘레에 링을 그린다 · 눌리는 영역은 24 × 24 · 누르면 지우기만 준다", () => {
    render(<InputChip onRemove={() => {}}>김하나</InputChip>);
    expect(q("[data-slot=input-chip]").className).toContain(
      "has-[[data-slot=input-chip-remove]:focus-visible]:outline-2",
    );
    const cls = removes()[0]!.className;
    expect(cls).toContain("before:size-[24px]");
    expect(cls).toContain("[--press-basis:24]");
    expect(cls).toContain("active:[scale:calc(1-2/var(--press-basis))]");
  });
});

describe("ChipGroup (묶음)", () => {
  it("role=group + 이름 · 입력값을 다 지운 뒤 포커스를 받는다(tabIndex -1) · 키보드 링 · 칩 사이 8", () => {
    const group = render(
      <ChipGroup aria-label="빠른 금액">
        <Chip>10만</Chip>
      </ChipGroup>,
    );
    expect(group.getAttribute("role")).toBe("group");
    expect(group.getAttribute("aria-label")).toBe("빠른 금액");
    expect(group.tabIndex).toBe(-1);
    expect(group.className).toContain("gap-between-chips");
    expect(group.className).toContain("flex-wrap");
    expect(group.className).toContain("focus-visible:outline-2");
    expect(group.className).toContain("focus-visible:outline-offset-2");
  });

  it("비어 있을 때만 칩 한 줄(36) 높이를 남긴다", () => {
    const group = render(<ChipGroup aria-label="참여자" />);
    expect(group.className).toContain("empty:min-h-[36px]");
    expect(group.matches(":empty")).toBe(true);
  });

  it("scroll — 바깥 묶음 안에 스크롤 칸을 한 겹 더 둔다(여백 24 · 위아래 6 · 바깥 −6 · 스크롤바 숨김 · 넘치면 가로)", () => {
    const group = render(
      <ChipGroup layout="scroll" bleed aria-label="거래 거르기">
        <Chip variant="solid">기간</Chip>
        <Chip variant="solid">계좌</Chip>
      </ChipGroup>,
    );
    expect(group.className).toContain("-mx-global-gutter");
    expect(group.className).not.toContain("flex-wrap");
    const row = group.querySelector<HTMLElement>(
      "[data-slot=chip-scroll-row]",
    )!;
    expect(row.parentElement).toBe(group);
    expect(row.className).toContain("px-global-gutter");
    expect(row.className).toContain("py-x1_5");
    expect(row.className).toContain("-my-x1_5");
    expect(row.className).toContain("scroll-px-global-gutter");
    expect(row.className).toContain("overflow-x-auto");
    expect(row.className).toContain("flex-nowrap");
    expect(row.className).toContain("gap-between-chips");
    expect(row.className).toContain("[scrollbar-width:none]");
    // 칩은 칸 안에 있다 · 양 끝 흐림은 늘 켜져 있다(Scroll Fog row)
    expect(row.querySelectorAll("[data-slot=chip]")).toHaveLength(2);
    expect(row.getAttribute("data-scroll-fog")).toBe("row");
  });

  it("scroll 의 빈 칸도 칩 한 줄 높이를 남긴다", () => {
    const group = render(<ChipGroup layout="scroll" aria-label="입력값" />);
    expect(group.className).toContain(
      "has-[>[data-slot=chip-scroll-row]:empty]:min-h-[36px]",
    );
  });

  it("칩 20개 · 긴 이름도 그대로 담는다 — 줄바꿈 묶음은 줄을 바꾸고 칩을 줄이지 않는다", () => {
    const names = Array.from({ length: 20 }, (_, i) => `카테고리 ${i + 1}`);
    render(
      <ChipGroup aria-label="많은 칩">
        {names.map((n) => (
          <Chip key={n}>{n}</Chip>
        ))}
        <Chip>신한카드 마이 포인트 플러스 체크카드</Chip>
      </ChipGroup>,
    );
    expect(all("[data-slot=chip]")).toHaveLength(21);
    expect(
      all("[data-slot=chip]").every((c) => c.className.includes("shrink-0")),
    ).toBe(true);
  });

  it("Field 안이면 라벨이 이름 · 설명이 aria-describedby 가 된다", () => {
    render(
      <Field label="알림" description="고른 때마다 알려줘요.">
        <ChipGroup>
          <ChipToggle>당일</ChipToggle>
        </ChipGroup>
      </Field>,
    );
    const group = q("[data-slot=chip-group]");
    expect(
      document.getElementById(group.getAttribute("aria-labelledby")!)
        ?.textContent,
    ).toContain("알림");
    expect(
      document.getElementById(group.getAttribute("aria-describedby")!)
        ?.textContent,
    ).toContain("고른 때마다");
  });
});
