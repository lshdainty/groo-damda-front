// Select Box 의 동작 — 모양 · 색은 scripts/check-ds-spec.mjs 가 크로미움에서 스펙 값과 맞춘다.
// 검사기가 못 재는 값(안쪽 그림자 · ::after 테두리 · 전환 · 문장)과 jsdom 이 못 푸는 :has 상태는 여기서 클래스 · 속성으로 본다
// (select-box.measure.mjs 머리). 키보드 · 읽는 말(radiogroup / fieldset)은 여기서 잠근다.
import { act, createRef, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Palette } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Field } from "@/shared/ds/field";
import { trackInputModality } from "@/shared/lib/input-modality";
import {
  pressKey,
  pressPointer,
  ringTargets,
} from "@/shared/lib/input-modality.test-utils";

import {
  CheckSelectBox,
  CheckSelectBoxGroup,
  RadioSelectBox,
  RadioSelectBoxGroup,
} from "./select-box";
import {
  footerClasses,
  selectBoxGroupVariants,
  selectBoxVariants,
} from "./select-box-variants";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // jsdom 에 없다 — Radix 의 폼 안 체크 · 라디오가 쓴다
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

function render(node: ReactNode) {
  act(() => root.render(node));
}

// Radix 의 화살표 이동은 다음 틱에 초점을 옮긴다
const tick = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

const radios = () =>
  Array.from(container.querySelectorAll<HTMLButtonElement>("[role=radio]"));
const checks = () =>
  Array.from(container.querySelectorAll<HTMLButtonElement>("[role=checkbox]"));
const boxes = () =>
  Array.from(container.querySelectorAll<HTMLElement>("[data-slot=select-box]"));
const triggerOf = (el: Element) =>
  el
    .closest("[data-slot=select-box]")!
    .querySelector<HTMLElement>("[data-slot=select-box-trigger]")!;
const classes = (el: Element) =>
  (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);

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

function click(el: Element) {
  act(() => {
    (el as HTMLElement).click();
  });
}

const END_OPTIONS = (
  <>
    <RadioSelectBox
      value="none"
      label="무기한"
      description="중지할 때까지 계속 반복"
    />
    <RadioSelectBox
      value="count"
      label="횟수 지정"
      description="정한 횟수만큼 반복"
    />
    <RadioSelectBox
      value="date"
      label="종료일 지정"
      description="정한 날까지 반복"
    />
  </>
);

describe("RadioSelectBox — 하나 고르기", () => {
  it("묶음은 role=radiogroup · 상자마다 role=radio 가 <label> 에 묶여 제목 + 설명이 이름이다", () => {
    render(
      <RadioSelectBoxGroup aria-label="종료">
        {END_OPTIONS}
      </RadioSelectBoxGroup>,
    );
    const group = container.querySelector("[data-slot=select-box-group]")!;
    expect(group.getAttribute("role")).toBe("radiogroup");
    expect(group.getAttribute("aria-label")).toBe("종료");
    expect(radios()).toHaveLength(3);
    for (const radio of radios()) {
      const label = container.querySelector<HTMLLabelElement>(
        `label[for="${radio.id}"]`,
      )!;
      expect(label).not.toBeNull();
      expect(label.contains(radio)).toBe(true);
    }
    const label = container.querySelector<HTMLLabelElement>(
      `label[for="${radios()[1]!.id}"]`,
    )!;
    expect(label.textContent).toBe("횟수 지정정한 횟수만큼 반복");
  });

  it("Field 로 감싸면 Field 의 라벨이 묶음의 이름(aria-labelledby), 설명이 묶음의 설명이다", () => {
    render(
      <Field label="종료" description="언제까지 반복할까요?">
        <RadioSelectBoxGroup>{END_OPTIONS}</RadioSelectBoxGroup>
      </Field>,
    );
    const group = container.querySelector("[role=radiogroup]")!;
    const labelId = group.getAttribute("aria-labelledby")!;
    expect(document.getElementById(labelId)!.textContent).toContain("종료");
    const described = group.getAttribute("aria-describedby")!;
    expect(document.getElementById(described.split(" ")[0]!)!.textContent).toBe(
      "언제까지 반복할까요?",
    );
    // aria-label 을 직접 주면 그것이 이긴다
    render(
      <Field label="종료">
        <RadioSelectBoxGroup aria-label="반복 종료">
          {END_OPTIONS}
        </RadioSelectBoxGroup>
      </Field>,
    );
    const own = container.querySelector("[role=radiogroup]")!;
    expect(own.getAttribute("aria-label")).toBe("반복 종료");
    expect(own.getAttribute("aria-labelledby")).toBeNull();
  });

  it("Field 의 오류 · 필수 · 막힘을 받는다 — 오류는 상자를 바꾸지 않고 묶음 아래 글로 알린다", () => {
    render(
      <Field label="종료" invalid required errorMessage="종료를 골라주세요.">
        <RadioSelectBoxGroup>{END_OPTIONS}</RadioSelectBoxGroup>
      </Field>,
    );
    const group = container.querySelector("[role=radiogroup]")!;
    expect(group.getAttribute("aria-invalid")).toBe("true");
    expect(group.getAttribute("aria-required")).toBe("true");
    expect(container.textContent).toContain("종료를 골라주세요.");
    // 상자 모양은 그대로 — 오류 빨간 테두리가 없다
    expect(
      boxes().every((b) => !classes(b).join(" ").includes("critical")),
    ).toBe(true);
    render(
      <Field label="종료" disabled>
        <RadioSelectBoxGroup>{END_OPTIONS}</RadioSelectBoxGroup>
      </Field>,
    );
    expect(
      container
        .querySelector("[role=radiogroup]")!
        .getAttribute("aria-disabled"),
    ).toBe("true");
    expect(radios().every((r) => r.disabled)).toBe(true);
    // 묶음 막힘은 상자 모양도 막힘으로 — data-disabled · 글 fg-disabled · 커서 not-allowed(03B-004)
    for (const box of boxes()) {
      const trigger = box.querySelector("[data-slot=select-box-trigger]")!;
      expect(trigger.hasAttribute("data-disabled")).toBe(true);
      expect(classes(trigger)).toContain("data-[disabled]:cursor-not-allowed");
      expect(
        classes(box.querySelector("[data-slot=select-box-label]")!),
      ).toContain("text-fg-disabled");
    }
  });

  it("상자 어디를 눌러도(제목 · 설명 · 빈 자리) 고른다 · onValueChange", () => {
    const onValueChange = vi.fn();
    render(
      <RadioSelectBoxGroup aria-label="종료" onValueChange={onValueChange}>
        {END_OPTIONS}
      </RadioSelectBoxGroup>,
    );
    const second = boxes()[1]!;
    click(second.querySelector("[data-slot=select-box-description]")!);
    expect(onValueChange).toHaveBeenLastCalledWith("count");
    expect(radios()[1]!.getAttribute("aria-checked")).toBe("true");
    click(boxes()[2]!.querySelector("[data-slot=select-box-label]")!);
    expect(onValueChange).toHaveBeenLastCalledWith("date");
    expect(radios().map((r) => r.getAttribute("aria-checked"))).toEqual([
      "false",
      "false",
      "true",
    ]);
    // 누르는 영역은 펼침을 뺀 상자 전체 — 누르는 자리(label)가 상자 폭을 다 채우고 남는 자리까지 늘어난다(grow)
    expect(classes(triggerOf(radios()[0]!))).toEqual(
      expect.arrayContaining(["w-full", "grow", "cursor-pointer"]),
    );
  });

  it("제어 — value 를 그대로 따른다 · 고른 상자는 data-state=checked", () => {
    function Controlled() {
      const [value, setValue] = useState("none");
      return (
        <RadioSelectBoxGroup
          aria-label="종료"
          value={value}
          onValueChange={setValue}
        >
          {END_OPTIONS}
        </RadioSelectBoxGroup>
      );
    }
    render(<Controlled />);
    expect(radios().map((r) => r.dataset.state)).toEqual([
      "checked",
      "unchecked",
      "unchecked",
    ]);
    click(boxes()[2]!.querySelector("[data-slot=select-box-trigger]")!);
    expect(radios().map((r) => r.dataset.state)).toEqual([
      "unchecked",
      "unchecked",
      "checked",
    ]);
  });

  it("Tab 은 묶음 하나로 들어와 고른 상자로 간다(상자마다 서지 않는다) · 고른 것이 없으면 첫 상자", () => {
    render(
      <RadioSelectBoxGroup aria-label="종료" defaultValue="count">
        {END_OPTIONS}
      </RadioSelectBoxGroup>,
    );
    const group = container.querySelector<HTMLElement>("[role=radiogroup]")!;
    expect(group.tabIndex).toBe(0);
    expect(radios().every((r) => r.tabIndex === -1)).toBe(true);
    act(() => group.focus());
    expect(document.activeElement).toBe(radios()[1]);
    render(
      <RadioSelectBoxGroup key="empty" aria-label="종료">
        {END_OPTIONS}
      </RadioSelectBoxGroup>,
    );
    act(() =>
      container.querySelector<HTMLElement>("[role=radiogroup]")!.focus(),
    );
    expect(document.activeElement).toBe(radios()[0]);
  });

  it("화살표로 옮기며 고른다 — ↓ → 는 다음, ↑ ← 는 이전, 끝에서 돌아간다", async () => {
    const onValueChange = vi.fn();
    render(
      <RadioSelectBoxGroup
        aria-label="종료"
        defaultValue="none"
        onValueChange={onValueChange}
      >
        {END_OPTIONS}
      </RadioSelectBoxGroup>,
    );
    act(() => radios()[0]!.focus());
    key(radios()[0]!, "ArrowDown");
    await tick();
    expect(document.activeElement).toBe(radios()[1]);
    expect(onValueChange).toHaveBeenLastCalledWith("count");
    key(radios()[1]!, "ArrowRight");
    await tick();
    expect(document.activeElement).toBe(radios()[2]);
    expect(onValueChange).toHaveBeenLastCalledWith("date");
    key(radios()[2]!, "ArrowDown");
    await tick();
    expect(document.activeElement).toBe(radios()[0]);
    expect(onValueChange).toHaveBeenLastCalledWith("none");
    key(radios()[0]!, "ArrowUp");
    await tick();
    expect(document.activeElement).toBe(radios()[2]);
    key(radios()[2]!, "ArrowLeft");
    await tick();
    expect(document.activeElement).toBe(radios()[1]);
  });

  it("막힌 상자는 화살표가 건너뛴다 · 눌러도 고르지 않는다", async () => {
    const onValueChange = vi.fn();
    render(
      <RadioSelectBoxGroup
        aria-label="종료"
        defaultValue="none"
        onValueChange={onValueChange}
      >
        <RadioSelectBox value="none" label="무기한" />
        <RadioSelectBox value="count" label="횟수 지정" disabled />
        <RadioSelectBox value="date" label="종료일 지정" />
      </RadioSelectBoxGroup>,
    );
    act(() => radios()[0]!.focus());
    key(radios()[0]!, "ArrowDown");
    await tick();
    expect(document.activeElement).toBe(radios()[2]);
    click(boxes()[1]!.querySelector("[data-slot=select-box-trigger]")!);
    expect(radios()[1]!.getAttribute("aria-checked")).toBe("false");
    const trigger = triggerOf(radios()[1]!);
    expect(trigger.hasAttribute("data-disabled")).toBe(true);
    expect(classes(trigger)).toContain("data-[disabled]:cursor-not-allowed");
    // 막히면 글 · 설명 · 앞 아이콘이 fg-disabled — 흐리게(opacity) 하지 않는다
    expect(
      classes(boxes()[1]!.querySelector("[data-slot=select-box-label]")!),
    ).toContain("text-fg-disabled");
    expect(classes(boxes()[1]!).some((c) => c.startsWith("opacity"))).toBe(
      false,
    );
  });

  it("Enter 는 고르지 않고 폼을 제출한다(진짜 input 처럼)", () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <RadioSelectBoxGroup aria-label="종료">
          {END_OPTIONS}
        </RadioSelectBoxGroup>
        <button type="submit">저장</button>
      </form>,
    );
    act(() => radios()[1]!.focus());
    key(radios()[1]!, "Enter");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(radios()[1]!.getAttribute("aria-checked")).toBe("false");
  });

  it("컨트롤 none — 테두리만으로 보이고 라디오는 화면 밖(sr-only)에 남아 키보드 · 화면 읽기 프로그램이 쓴다", async () => {
    render(
      <RadioSelectBoxGroup
        aria-label="파일 형식"
        defaultValue="csv"
        columns={3}
      >
        <RadioSelectBox
          value="csv"
          control="none"
          label="CSV"
          description="구글시트"
          prefix={<Palette />}
        />
        <RadioSelectBox
          value="xlsx"
          control="none"
          label="Excel"
          description="엑셀"
        />
      </RadioSelectBoxGroup>,
    );
    expect(radios()).toHaveLength(2);
    expect(classes(radios()[0]!)).toContain("sr-only");
    expect(radios()[0]!.querySelector("span")).toBeNull();
    expect(radios()[0]!.getAttribute("aria-checked")).toBe("true");
    // 화살표로 옮겨 고른다
    act(() => radios()[0]!.focus());
    key(radios()[0]!, "ArrowRight");
    await tick();
    expect(radios()[1]!.getAttribute("aria-checked")).toBe("true");
  });

  it("density compact — 세로형 위아래 12 · 앞 ↔ 글 4, 기본은 20 · 10, 가로형은 그대로", () => {
    render(
      <RadioSelectBoxGroup aria-label="종류" columns={2}>
        <RadioSelectBox value="a" control="none" label="가" density="compact" />
        <RadioSelectBox value="b" control="none" label="나" />
        <RadioSelectBox
          value="c"
          control="none"
          label="다"
          layout="horizontal"
          density="compact"
        />
      </RadioSelectBoxGroup>,
    );
    const trig = (i: number) =>
      container.querySelectorAll<HTMLElement>("[data-slot=select-box-trigger]")[
        i
      ]!;
    const content = (i: number) => trig(i).firstElementChild!;
    expect(classes(trig(0))).toContain("py-x3");
    expect(classes(trig(0))).not.toContain("py-x5");
    expect(classes(content(0))).toContain("gap-x1");
    expect(classes(trig(1))).toContain("py-x5");
    expect(classes(content(1))).toContain("gap-x2_5");
    expect(classes(trig(2))).toContain("py-x4");
    expect(classes(trig(2))).not.toContain("py-x3");
  });

  it("컨트롤이 있으면 라디오(Radiomark 20)는 자기 링을 끄고 상자의 호버 · 누름을 받는다(group/radio) — 자기 축소는 끈다", () => {
    render(
      <RadioSelectBoxGroup aria-label="종료">
        {END_OPTIONS}
      </RadioSelectBoxGroup>,
    );
    const radio = radios()[0]!;
    expect(classes(radio)).toEqual(
      expect.arrayContaining([
        "size-[20px]",
        "focus-visible:outline-none",
        "active:[scale:1]",
        "group-active/radio:[scale:1]",
      ]),
    );
    expect(classes(radio)).not.toContain(
      "group-active/radio:[scale:calc(1-2/var(--press-basis))]",
    );
    expect(classes(triggerOf(radio))).toContain("group/radio");
    expect(radio.getAttribute("data-select-box-control")).toBe("");
  });

  it("ref 는 라디오(button)다", () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <RadioSelectBoxGroup aria-label="종료">
        <RadioSelectBox ref={ref} value="none" label="무기한" />
      </RadioSelectBoxGroup>,
    );
    expect(ref.current).toBe(radios()[0]);
  });
});

describe("CheckSelectBox — 여럿 고르기", () => {
  const ROLES = ["관리자", "일반 사용자", "승인권자"];

  it("묶음은 <fieldset> · 상자마다 role=checkbox 가 <label> 에 묶인다 · 이름은 aria-label 또는 Field 의 라벨", () => {
    render(
      <CheckSelectBoxGroup aria-label="역할">
        {ROLES.map((r) => (
          <CheckSelectBox key={r} label={r} description="설명" />
        ))}
      </CheckSelectBoxGroup>,
    );
    const group = container.querySelector("[data-slot=select-box-group]")!;
    expect(group.tagName).toBe("FIELDSET");
    expect(group.getAttribute("aria-label")).toBe("역할");
    expect(checks()).toHaveLength(3);
    expect(
      container.querySelector(`label[for="${checks()[0]!.id}"]`)!.textContent,
    ).toBe("관리자설명");

    render(
      <Field label="역할" description="여럿 고를 수 있어요.">
        <CheckSelectBoxGroup>
          <CheckSelectBox label="관리자" />
        </CheckSelectBoxGroup>
      </Field>,
    );
    const field = container.querySelector("fieldset")!;
    expect(
      document.getElementById(field.getAttribute("aria-labelledby")!)!
        .textContent,
    ).toContain("역할");
  });

  it("상자마다 켜고 끈다 · 여럿 · onCheckedChange 는 boolean", () => {
    const onCheckedChange = vi.fn();
    render(
      <CheckSelectBoxGroup aria-label="역할">
        <CheckSelectBox label="관리자" onCheckedChange={onCheckedChange} />
        <CheckSelectBox label="일반 사용자" defaultChecked />
      </CheckSelectBoxGroup>,
    );
    click(
      boxes()[0]!.querySelector("[data-slot=select-box-description]") ??
        boxes()[0]!.querySelector("[data-slot=select-box-label]")!,
    );
    expect(onCheckedChange).toHaveBeenLastCalledWith(true);
    expect(checks().map((c) => c.getAttribute("aria-checked"))).toEqual([
      "true",
      "true",
    ]);
    click(boxes()[0]!.querySelector("[data-slot=select-box-trigger]")!);
    expect(onCheckedChange).toHaveBeenLastCalledWith(false);
    expect(checks()[0]!.getAttribute("aria-checked")).toBe("false");
    expect(checks()[1]!.getAttribute("aria-checked")).toBe("true");
  });

  it("제어 — 저장 전까지 고른 것을 쥔다(HR 역할)", () => {
    function Roles() {
      const [picked, setPicked] = useState(["USER"]);
      return (
        <CheckSelectBoxGroup aria-label="역할">
          {["ADMIN", "USER", "APPROVER"].map((c) => (
            <CheckSelectBox
              key={c}
              label={c}
              checked={picked.includes(c)}
              onCheckedChange={(on) =>
                setPicked((l) => (on ? [...l, c] : l.filter((x) => x !== c)))
              }
            />
          ))}
        </CheckSelectBoxGroup>
      );
    }
    render(<Roles />);
    expect(checks().map((c) => c.dataset.state)).toEqual([
      "unchecked",
      "checked",
      "unchecked",
    ]);
    click(triggerOf(checks()[2]!));
    expect(checks().map((c) => c.dataset.state)).toEqual([
      "unchecked",
      "checked",
      "checked",
    ]);
  });

  it("Tab 은 상자마다 선다 · Enter 는 켜지 않고 폼을 제출한다(Space 는 버튼의 기본 동작이라 크로미움에서 본다)", () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <CheckSelectBoxGroup aria-label="역할">
          <CheckSelectBox label="관리자" />
          <CheckSelectBox label="일반 사용자" control="none" />
        </CheckSelectBoxGroup>
        <button type="submit">저장</button>
      </form>,
    );
    expect(checks().map((c) => c.tabIndex)).toEqual([0, 0]);
    for (const check of checks()) {
      act(() => check.focus());
      key(check, "Enter");
      expect(check.getAttribute("aria-checked")).toBe("false");
    }
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("컨트롤 check — 칸 없는 체크(Ghost 20 · 체크 14)가 오른쪽 · none — 화면 밖(sr-only)", () => {
    render(
      <CheckSelectBoxGroup aria-label="역할">
        <CheckSelectBox label="관리자" />
        <CheckSelectBox label="승인권자" control="none" />
      </CheckSelectBoxGroup>,
    );
    const [mark, hidden] = checks();
    expect(mark!.querySelector("svg")).not.toBeNull();
    expect(classes(mark!)).toEqual(
      expect.arrayContaining([
        "size-[20px]",
        "text-fg-placeholder",
        "focus-visible:outline-none",
        "hover:bg-transparent",
      ]),
    );
    // 켜지지 않은 체크도 옅게 보인다(Ghost) — 일부 선택은 없다
    expect(mark!.dataset.state).toBe("unchecked");
    expect(classes(hidden!)).toContain("sr-only");
    expect(hidden!.querySelector("svg")).toBeNull();
  });

  it("Field 의 오류 · 막힘 — 오류는 칸마다 aria-invalid(묶음에는 걸지 않는다), 막힘은 묶음 aria-disabled + 칸마다 disabled", () => {
    render(
      <Field label="권한" invalid errorMessage="하나 이상 골라주세요.">
        <CheckSelectBoxGroup>
          <CheckSelectBox label="조회" />
          <CheckSelectBox label="신청" control="none" />
        </CheckSelectBoxGroup>
      </Field>,
    );
    const fieldset = container.querySelector("fieldset")!;
    expect(fieldset.getAttribute("aria-invalid")).toBeNull();
    expect(checks().map((c) => c.getAttribute("aria-invalid"))).toEqual([
      "true",
      "true",
    ]);
    expect(container.textContent).toContain("하나 이상 골라주세요.");
    render(
      <Field label="권한" disabled>
        <CheckSelectBoxGroup>
          <CheckSelectBox label="조회" />
          <CheckSelectBox label="신청" control="none" />
        </CheckSelectBoxGroup>
      </Field>,
    );
    expect(
      container.querySelector("fieldset")!.getAttribute("aria-disabled"),
    ).toBe("true");
    expect(checks().every((c) => c.disabled)).toBe(true);
    expect(triggerOf(checks()[0]!).hasAttribute("data-disabled")).toBe(true);
  });

  it("ref 는 체크(button)다", () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <CheckSelectBoxGroup aria-label="역할">
        <CheckSelectBox ref={ref} label="관리자" />
      </CheckSelectBoxGroup>,
    );
    expect(ref.current).toBe(checks()[0]);
  });
});

describe("Select Box — 모양 · 배치 · 펼침", () => {
  it("상자 — 모서리 12 · 안쪽 1px 테두리 · 고르면 ::after 2px 짙게(stroke-neutral-contrast) · 막힌 채 고르면 옅은 2px", () => {
    const box = classes(boxes_for());
    expect(box).toEqual(
      expect.arrayContaining([
        "rounded-r3",
        "bg-transparent",
        "shadow-[inset_0_0_0_1px_var(--color-stroke-neutral-weak)]",
        "after:border-2",
        "after:border-transparent",
        "has-[[data-select-box-control][data-state=checked]:not([data-disabled])]:after:border-stroke-neutral-contrast",
        "has-[[data-select-box-control][data-state=checked][data-disabled]]:after:border-stroke-neutral-weak",
      ]),
    );
    // 고른 상자도 바탕은 그대로(색만으로 알리지 않는다 — 테두리 두께 · 라디오 · 체크도 알린다)
    expect(box.join(" ")).not.toContain("data-[state=checked]:bg-");
  });

  it("호버(마우스만) · 누름은 bg-layer-default-pressed · 키보드 포커스에만 상자 바깥 링 2px · 띄움 2px", () => {
    const box = classes(boxes_for()).join(" ");
    expect(box).toContain(
      "[@media(hover:hover)]:has-[[data-select-box-action]:not([data-disabled]):hover]:bg-bg-layer-default-pressed",
    );
    expect(box).toContain(
      "has-[[data-select-box-action]:not([data-disabled]):active]:bg-bg-layer-default-pressed",
    );
    expect(box).toContain(
      "has-[[data-select-box-control]:focus-visible:not(:where(:root[data-input=pointer]_*))]:outline-2",
    );
    expect(box).toContain(
      "has-[[data-select-box-control]:focus-visible:not(:where(:root[data-input=pointer]_*))]:outline-offset-2",
    );
    expect(box).toContain("outline-stroke-focus-ring");
  });

  it("상자 링은 직전 입력이 포인터면 그리지 않는다 — 키로 오면 그린다(index.css focus-visible 과 같은 조건)", () => {
    trackInputModality();
    render(
      <RadioSelectBoxGroup aria-label="종료">
        <RadioSelectBox value="a" label="안 함" />
        <RadioSelectBox value="b" label="날짜" />
      </RadioSelectBoxGroup>,
    );
    const box = boxes()[0]!;
    act(() => radios()[0]!.focus());
    pressPointer();
    expect(ringTargets(box)).toEqual([]);
    pressKey();
    expect(ringTargets(box)).toEqual([box]);
    expect(ringTargets(box, "outline-2")).toEqual([box]);
  });

  it("누르는 순간 누르는 자리를 재서 --press-basis 로 넘기고, 누르는 자리만 2px 거리 축소(모션 줄이기면 없다)", () => {
    render(
      <RadioSelectBoxGroup aria-label="종료">
        {END_OPTIONS}
      </RadioSelectBoxGroup>,
    );
    const trigger = triggerOf(radios()[0]!);
    const press = classes(trigger).join(" ");
    expect(press).toContain(
      "group-has-[[data-select-box-action]:not([data-disabled]):active]/select-box:[scale:calc(1-2/var(--press-basis))]",
    );
    expect(press).toContain("motion-reduce:group-has-");
    act(() => {
      trigger.dispatchEvent(
        new MouseEvent("pointerdown", { bubbles: true, cancelable: true }),
      );
    });
    expect(trigger.style.getPropertyValue("--press-basis")).toBe("24");
  });

  it("묶음 — 1 ~ 3열 · 2열 이상은 모든 줄이 같은 높이(auto-rows-fr) · 줄 사이 12 · 열 사이 12", () => {
    expect(selectBoxGroupVariants({ columns: 1 })).toContain("grid-cols-1");
    expect(selectBoxGroupVariants({ columns: 1 })).not.toContain(
      "auto-rows-fr",
    );
    expect(selectBoxGroupVariants({ columns: 2 })).toContain("grid-cols-2");
    expect(selectBoxGroupVariants({ columns: 2 })).toContain("auto-rows-fr");
    expect(selectBoxGroupVariants({ columns: 3 })).toContain("grid-cols-3");
    expect(selectBoxGroupVariants({ columns: 3 })).toContain("auto-rows-fr");
    expect(selectBoxGroupVariants()).toContain("gap-x-x3");
    expect(selectBoxGroupVariants()).toContain("gap-y-component-default");
    expect(selectBoxVariants()).toContain("h-full");
  });

  it("배치 — 1열은 가로형(앞 · 본문 · 컨트롤이 한 줄), 2 ~ 3열은 세로형(앞이 위) · 상자마다 layout 으로 바꾼다", () => {
    render(
      <>
        <RadioSelectBoxGroup aria-label="a">
          <RadioSelectBox value="1" label="가" prefix={<Palette />} />
          <RadioSelectBox value="2" label="나" layout="vertical" />
        </RadioSelectBoxGroup>
        <RadioSelectBoxGroup aria-label="b" columns={2}>
          <RadioSelectBox value="1" label="가" prefix={<Palette />} />
          <RadioSelectBox value="2" label="나" layout="horizontal" />
        </RadioSelectBoxGroup>
      </>,
    );
    const [h1, v1, v2, h2] = Array.from(
      container.querySelectorAll<HTMLElement>("[data-slot=select-box-trigger]"),
    );
    const content = (t: HTMLElement) =>
      classes(t.querySelector("[data-slot=select-box-content]")!);
    expect(classes(h1!)).toEqual(
      expect.arrayContaining(["items-center", "py-x4", "pl-x5", "pr-x4"]),
    );
    expect(content(h1!)).toEqual(
      expect.arrayContaining(["flex-row", "items-center", "gap-x3"]),
    );
    expect(classes(v1!)).toEqual(
      expect.arrayContaining(["items-start", "px-x4", "py-x5"]),
    );
    expect(content(v1!)).toEqual(
      expect.arrayContaining(["flex-col", "gap-x2_5"]),
    );
    expect(classes(v2!)).toContain("items-start");
    expect(classes(h2!)).toContain("items-center");
  });

  it("앞(prefix) 아이콘 22 · fg-neutral · 막히면 fg-disabled", () => {
    render(
      <RadioSelectBoxGroup aria-label="a">
        <RadioSelectBox value="1" label="가" prefix={<Palette />} />
        <RadioSelectBox value="2" label="나" prefix={<Palette />} disabled />
      </RadioSelectBoxGroup>,
    );
    const [a, b] = Array.from(
      container.querySelectorAll("[data-slot=select-box-prefix]"),
    );
    expect(classes(a!)).toEqual(
      expect.arrayContaining(["text-fg-neutral", "[&>svg]:size-[22px]"]),
    );
    expect(classes(b!)).toContain("text-fg-disabled");
  });

  it("제목 16/500 · 설명 13 진한 회색(fg-neutral-muted) · 본문 gap 2 · 오른쪽 4", () => {
    render(
      <RadioSelectBoxGroup aria-label="a">
        <RadioSelectBox value="1" label="가" description="설명" />
      </RadioSelectBoxGroup>,
    );
    expect(
      classes(container.querySelector("[data-slot=select-box-label]")!),
    ).toEqual(
      expect.arrayContaining(["text-t5", "font-medium", "text-fg-neutral"]),
    );
    expect(
      classes(container.querySelector("[data-slot=select-box-description]")!),
    ).toEqual(expect.arrayContaining(["text-t3", "text-fg-neutral-muted"]));
    expect(
      classes(container.querySelector("[data-slot=select-box-body]")!),
    ).toEqual(expect.arrayContaining(["gap-x0_5", "pr-x1", "min-w-0"]));
  });

  it("제목 옆 배지 — 제목 칸이 배지를 옆에 둔다(사이 4)", () => {
    render(
      <RadioSelectBoxGroup aria-label="a">
        <RadioSelectBox
          value="1"
          label={
            <>
              가 <span data-testid="badge">추천</span>
            </>
          }
        />
      </RadioSelectBoxGroup>,
    );
    const label = container.querySelector("[data-slot=select-box-label]")!;
    expect(label.querySelector("[data-testid=badge]")).not.toBeNull();
    expect(classes(label)).toEqual(
      expect.arrayContaining(["flex", "items-center", "gap-x1"]),
    );
  });

  it("펼침 — 상자 안에 있되 누르는 자리(label) 밖이라 눌러도 고르지 않는다 · 좌우 20 · 아래 16", () => {
    render(
      <RadioSelectBoxGroup aria-label="종료">
        <RadioSelectBox
          value="count"
          label="횟수 지정"
          footer={<input aria-label="반복 횟수" defaultValue="12" />}
        />
      </RadioSelectBoxGroup>,
    );
    const footer = container.querySelector("[data-slot=select-box-footer]")!;
    const input = footer.querySelector("input")!;
    expect(triggerOf(radios()[0]!).contains(input)).toBe(false);
    expect(
      classes(footer.querySelector("[data-slot=select-box-footer-inner]")!),
    ).toEqual(expect.arrayContaining(["px-x5", "pb-x4"]));
    click(input);
    expect(radios()[0]!.getAttribute("aria-checked")).toBe("false");
  });

  it("펼침은 고르면(기본) 열린다 — 닫히면 보이지 않고 Tab 도 안 닿는다(visibility) · 높이 400ms · 투명도 300ms, 닫을 때 300ms · 400ms", () => {
    const whenSelected = footerClasses("when-selected");
    expect(whenSelected).toContain(
      "invisible opacity-0 [grid-template-rows:0fr]",
    );
    expect(whenSelected).toContain("[data-state=checked]]/select-box:visible");
    expect(whenSelected).toContain("[grid-template-rows:1fr]");
    expect(whenSelected).toContain("grid-template-rows_400ms");
    expect(whenSelected).toContain("opacity_var(--motion-duration-d6)");
    expect(whenSelected).toContain(
      "grid-template-rows_var(--motion-duration-d6)",
    );
    expect(whenSelected).toContain("opacity_400ms");
    // 모션 줄이기 — 높이는 바로 바뀌고 투명도만 150ms
    expect(whenSelected).toContain(
      "motion-reduce:[transition:opacity_150ms_linear",
    );
    expect(footerClasses("when-not-selected")).toContain(
      "[data-state=unchecked]]/select-box:visible",
    );
  });

  it("footerVisibility=always 는 펼침 틀 없이 늘 보인다", () => {
    render(
      <RadioSelectBoxGroup aria-label="종료">
        <RadioSelectBox
          value="a"
          label="가"
          footer={<span>안내</span>}
          footerVisibility="always"
        />
      </RadioSelectBoxGroup>,
    );
    expect(container.querySelector("[data-slot=select-box-footer]")).toBeNull();
    expect(
      container.querySelector("[data-slot=select-box-footer-inner]")!
        .textContent,
    ).toBe("안내");
  });

  it("rootProps 의 className 은 상자(div)에 합쳐진다", () => {
    render(
      <RadioSelectBoxGroup aria-label="a">
        <RadioSelectBox
          value="1"
          label="가"
          rootProps={{ className: "mt-x1", id: "box-1" }}
        />
      </RadioSelectBoxGroup>,
    );
    expect(classes(boxes()[0]!)).toContain("mt-x1");
    expect(boxes()[0]!.id).toBe("box-1");
  });

  it("가장 나쁜 값 — 긴 이름 · 설명은 본문이 줄어들며(min-w-0) 줄바꿈된다(자르지 않는다)", () => {
    render(
      <RadioSelectBoxGroup aria-label="a" columns={3}>
        <RadioSelectBox
          value="1"
          label="주식회사 그루 디자인 시스템 운영팀 서울 본사 3층 공용 회의실 예약 정산용 법인카드"
          description="설명도 아주 길어서 두 줄을 넘기면 줄바꿈으로 상자가 늘어나요"
          control="none"
        />
      </RadioSelectBoxGroup>,
    );
    const label = container.querySelector("[data-slot=select-box-label]")!;
    const description = container.querySelector(
      "[data-slot=select-box-description]",
    )!;
    for (const el of [label, description]) {
      expect(el.className).not.toContain("truncate");
      expect(el.className).not.toContain("whitespace-nowrap");
    }
    expect(
      classes(container.querySelector("[data-slot=select-box-content]")!),
    ).toContain("min-w-0");
    expect(
      classes(container.querySelector("[data-slot=select-box-body]")!),
    ).toContain("min-w-0");
  });

  it("선택지 20개 — 모두 그리고 각각 이름 있는 체크가 된다", () => {
    render(
      <CheckSelectBoxGroup aria-label="많이">
        {Array.from({ length: 20 }, (_, i) => (
          <CheckSelectBox key={i} label={`${i + 1}번째`} description="설명" />
        ))}
      </CheckSelectBoxGroup>,
    );
    expect(checks()).toHaveLength(20);
    expect(new Set(checks().map((c) => c.id)).size).toBe(20);
    for (const c of checks())
      expect(container.querySelector(`label[for="${c.id}"]`)).not.toBeNull();
  });
});

// 상자 하나의 클래스만 보면 되는 시험의 틀
function boxes_for() {
  render(
    <RadioSelectBoxGroup aria-label="종료">
      <RadioSelectBox value="a" label="가" />
    </RadioSelectBoxGroup>,
  );
  return container.querySelector<HTMLElement>("[data-slot=select-box]")!;
}
