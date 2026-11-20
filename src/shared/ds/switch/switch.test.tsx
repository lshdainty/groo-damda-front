// Switch 의 동작 — 모양 · 색은 scripts/check-ds-spec.mjs 가 크로미움에서 스펙 값과 맞춘다.
import { act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Switch, Switchmark } from "./switch";

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
  return container.firstElementChild as HTMLElement;
}

const control = () =>
  container.querySelector<HTMLButtonElement>("[role=switch]")!;
const thumb = () => control().querySelector("span")!;

describe("Switch", () => {
  it("스위치는 role=switch · aria-checked 이고 라벨과 <label for> 로 잇는다 — 기본은 24 · neutral · 끔", () => {
    const row = render(<Switch label="종일" />);
    expect(row.tagName).toBe("LABEL");
    expect(row.getAttribute("for")).toBe(control().id);
    expect(control().labels?.[0]).toBe(row);
    expect(control().getAttribute("aria-checked")).toBe("false");
    expect(control().className).toContain("h-[24px]");
    expect(control().className).toContain("w-[38px]");
    expect(thumb().className).toContain("bg-fg-neutral-inverted");
  });

  it("스위치나 라벨을 누르면 켬 ↔ 끔 — 바로 바뀌고 onCheckedChange 로 알린다", () => {
    const onCheckedChange = vi.fn();
    const row = render(
      <Switch label="종일" onCheckedChange={onCheckedChange} />,
    );
    act(() => control().click());
    expect(control().getAttribute("aria-checked")).toBe("true");
    expect(onCheckedChange).toHaveBeenLastCalledWith(true);
    // 라벨 글자를 눌러도 같다 — 줄(<label>)이 스위치를 누른다
    const text = row.querySelector<HTMLElement>(":scope > span")!;
    expect(text.textContent).toBe("종일");
    act(() => text.click());
    expect(control().getAttribute("aria-checked")).toBe("false");
    expect(onCheckedChange).toHaveBeenLastCalledWith(false);
  });

  it("엄지는 켬 · 끔을 따라간다 — 끄면 0.8 · 자리 0, 켜면 1 · 트랙 폭 − 트랙 높이만큼", () => {
    render(<Switch label="종일" defaultChecked />);
    expect(thumb().dataset.state).toBe("checked");
    act(() => control().click());
    expect(thumb().dataset.state).toBe("unchecked");
    expect(thumb().className).toContain("scale-[0.8]");
    expect(thumb().className).toContain("translate-x-0");
    expect(thumb().className).toContain(
      "data-[state=checked]:translate-x-[14px]",
    );
  });

  it("값을 밖에서 쥐면 누름은 알리기만 한다 — 바뀐 값을 넣어야 바뀐다", () => {
    const Controlled = () => {
      const [on, setOn] = useState(false);
      return <Switch label="알림" checked={on} onCheckedChange={setOn} />;
    };
    render(<Controlled />);
    act(() => control().click());
    expect(control().getAttribute("aria-checked")).toBe("true");

    const onCheckedChange = vi.fn();
    act(() =>
      root.render(
        <Switch
          label="알림"
          checked={false}
          onCheckedChange={onCheckedChange}
        />,
      ),
    );
    act(() => control().click());
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(control().getAttribute("aria-checked")).toBe("false");
  });

  it("막히면 누르지 않고 포커스에서 빠진다 — 값은 그대로 보인다", () => {
    const onCheckedChange = vi.fn();
    render(
      <Switch
        label="종일"
        disabled
        defaultChecked
        onCheckedChange={onCheckedChange}
      />,
    );
    expect(control().disabled).toBe(true);
    act(() => control().click());
    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(control().getAttribute("aria-checked")).toBe("true");
    expect(thumb().hasAttribute("data-disabled")).toBe(true);
  });

  it("id 를 주면 라벨이 그 id 로 간다", () => {
    const row = render(<Switch id="all-day" label="종일" />);
    expect(control().id).toBe("all-day");
    expect(row.getAttribute("for")).toBe("all-day");
  });

  it("크기 · 톤은 스위치 · 엄지 · 줄 · 라벨이 함께 받는다", () => {
    const row = render(
      <Switch size="32" tone="brand" defaultChecked label="큰 줄" />,
    );
    expect(row.className).toContain("min-h-[32px]");
    expect(control().className).toContain("w-[52px]");
    expect(control().className).toContain(
      "data-[state=checked]:bg-bg-brand-solid",
    );
    expect(thumb().className).toContain("bg-static-white");
    expect(row.querySelector(":scope > span")!.className).toContain("text-t5");
  });

  // 큰 글자 · 좁은 폭에서 라벨이 여러 줄이 되면 스위치(px 그대로)는 라벨 전체의 세로 가운데에 선다(groo-design#270 — switch.md
  // "글자 크기 설정"). 옛 레시피는 둘 다 위에 붙이고(items-start) 첫 줄 높이만큼 각자 내렸다(mt-[calc((max(24px,…)…)/2)]).
  // jsdom 은 레이아웃을 재지 못해 클래스로 잠근다 — 줄은 가운데 맞춤, 스위치 · 라벨은 위로 붙이는 여백 · 이동이 없다.
  it("라벨이 여러 줄이어도 스위치는 라벨 전체의 세로 가운데 — 첫 줄에 붙이는 위 맞춤 · 여백 없음", () => {
    for (const size of ["16", "24", "32"] as const) {
      const row = render(
        <div style={{ width: 120 }}>
          <Switch size={size} label="휴가 신청이 승인되면 메일로 알림 받기" />
        </div>,
      ).firstElementChild as HTMLElement;
      const rowClasses = row.className.split(/\s+/);
      expect(rowClasses).toContain("items-center");
      expect(rowClasses.some((c) => /items-(start|baseline)/.test(c))).toBe(
        false,
      );
      for (const el of [control(), row.querySelector(":scope > span")!]) {
        expect(el.className).not.toMatch(
          /(^|[\s:])(-?m[ty]-|-?p[ty]-|translate-y|self-start)/,
        );
      }
    }
  });
});

describe("Switchmark", () => {
  it("스위치만 — 이름은 쓰는 쪽이 준다(줄 <label> · aria-label)", () => {
    const onCheckedChange = vi.fn();
    const row = render(
      <label>
        <span>결제 알림</span>
        <Switchmark onCheckedChange={onCheckedChange} />
      </label>,
    );
    expect(control().labels?.[0]).toBe(row);
    // 줄의 글자를 눌러도 바뀐다 — 줄 전체가 누르는 영역
    act(() => row.querySelector("span")!.click());
    expect(onCheckedChange).toHaveBeenCalledWith(true);

    act(() => root.render(<Switchmark aria-label="결제 알림" />));
    expect(control().getAttribute("aria-label")).toBe("결제 알림");
  });

  // 큰 글자(루트 글자 크기 200%)에서 켠 손잡이가 몸통 밖으로 밀리던 것 — 몸통은 px 인데 손잡이 이동이 rem 이라 글자만 커졌다(2026-10-30).
  // jsdom 은 레이아웃을 재지 못해 클래스의 단위로 잠근다 — 스펙 switch.yaml 은 몸통 · 손잡이 · 이동(translateX 10 · 14 · 20)을 모두 px 로 정한다.
  // 실제 렌더 측정(루트 200% 에서 켠 손잡이 오른쪽 ≤ 몸통 오른쪽)은 ~/qa 하네스(i092-switch-200.mjs).
  it("켠 손잡이의 이동은 몸통과 같은 px 단위다 — 글자 크기를 키워도 몸통 안에 있다", () => {
    for (const [size, body, move] of [
      ["16", "w-[26px]", "translate-x-[10px]"],
      ["24", "w-[38px]", "translate-x-[14px]"],
      ["32", "w-[52px]", "translate-x-[20px]"],
    ] as const) {
      render(<Switchmark size={size} aria-label="x" defaultChecked />);
      expect(control().className).toContain(body);
      expect(thumb().className).toContain(move);
      expect(thumb().className).not.toMatch(
        /checked\]:translate-x-(\d|\[[\d.]+rem\])/,
      );
    }
  });
});
