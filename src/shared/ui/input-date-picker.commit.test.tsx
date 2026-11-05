// 날짜·시각 칸의 `commitOnComplete` — 다 친 값만 호스트에 알린다(2026-09-28 QA).
//
// 두 칸은 키를 누를 때마다 칸의 글자를 그대로 `onValueChange` 로 넘긴다. 받은 글자를 들고
// 있다가 저장할 때 보는 호스트(거래 시트 등)는 그래도 되지만, 받은 값에 시각을 이어 붙이는
// 일정 폼은 `2` 를 `2T10:00` 으로 만들어 칸에 되썼고, 다음 글자부터 값이 통째로 깨졌다.
// 켜면 미완성 값은 칸 안에만 머물고, 완성된 값만 나간다. 끈 채로는 종전 그대로다.
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const { InputDatePicker } = await import("./input-date-picker");
const { isCompleteDate } = await import("@/shared/lib");

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

const setter = Object.getOwnPropertyDescriptor(
  HTMLInputElement.prototype,
  "value",
)!.set!;

/**
 * 전체 선택 뒤 치는 것과 같다 — 첫 글자가 기존 값을 갈아 끼우고, 그다음부터는 칸에 **지금
 * 보이는 값** 뒤에 붙는다. React 가 값을 되쓰면 캐럿이 끝으로 가므로 브라우저도 이렇다.
 */
function typeInto(el: HTMLInputElement, text: string, { replace = true } = {}) {
  [...text].forEach((ch, i) => {
    act(() => {
      setter.call(el, replace && i === 0 ? ch : el.value + ch);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
  });
}

/** React 의 onBlur 는 focusout 을 듣는다. */
const blur = (el: HTMLElement) =>
  act(() => el.dispatchEvent(new FocusEvent("focusout", { bubbles: true })));

/** 받은 값을 그대로 들고 있는 호스트 — 넘어온 값을 모두 적어 둔다. */
function DateHost({
  initial,
  commit,
  seen,
}: {
  initial: string;
  commit: boolean;
  seen: string[];
}) {
  const [value, setValue] = useState(initial);
  return (
    <InputDatePicker
      value={value}
      commitOnComplete={commit}
      onValueChange={(v) => {
        seen.push(v);
        setValue(v);
      }}
    />
  );
}

const input = () => container.querySelector("input")!;

describe("isCompleteDate", () => {
  it("YYYY-MM-DD 이면서 달력에 있는 날만 참이다", () => {
    expect(isCompleteDate("2026-09-30")).toBe(true);
    expect(isCompleteDate("2026-02-29")).toBe(false); // 2026 은 평년
    expect(isCompleteDate("2026-02-30")).toBe(false); // new Date 는 3/2 로 넘긴다
    expect(isCompleteDate("2026-9-30")).toBe(false);
    expect(isCompleteDate("2026-09-3")).toBe(false);
    expect(isCompleteDate("")).toBe(false);
  });
});

describe("InputDatePicker", () => {
  it("끈 채로는 종전 그대로 — 누를 때마다 칸의 글자가 그대로 나간다", () => {
    const seen: string[] = [];
    act(() =>
      root.render(<DateHost initial="2026-09-10" commit={false} seen={seen} />),
    );
    typeInto(input(), "2026-09-30");
    expect(seen).toHaveLength(10);
    expect(seen[0]).toBe("2");
    expect(seen[seen.length - 1]).toBe("2026-09-30");
  });

  it("켜면 미완성 값은 칸에만 있고, 다 친 날짜 한 번만 나간다", () => {
    const seen: string[] = [];
    act(() =>
      root.render(<DateHost initial="2026-09-10" commit seen={seen} />),
    );
    typeInto(input(), "2026-09-3");
    expect(seen).toEqual([]);
    expect(input().value).toBe("2026-09-3");

    typeInto(input(), "0", { replace: false }); // 마지막 한 글자
    expect(seen).toEqual(["2026-09-30"]);
    expect(input().value).toBe("2026-09-30");
  });

  it("없는 날(2026-02-30)은 안 나가고, 칸을 떠나면 마지막 값으로 돌아간다", () => {
    const seen: string[] = [];
    act(() =>
      root.render(<DateHost initial="2026-09-10" commit seen={seen} />),
    );
    typeInto(input(), "2026-02-30");
    expect(seen).toEqual([]);
    expect(input().value).toBe("2026-02-30");
    blur(input());
    expect(input().value).toBe("2026-09-10");
  });
});

/** 다 친 날짜만 받아들이는 호스트 — 통계 기간 칸이 이렇다(`fromISODate` 가 되는 값만 반영). */
function StrictHost({ commit, seen }: { commit: boolean; seen: string[] }) {
  const [value, setValue] = useState("2026-09-10");
  return (
    <InputDatePicker
      value={value}
      commitOnComplete={commit}
      onValueChange={(v) => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
          seen.push(v);
          setValue(v);
        }
      }}
    />
  );
}

describe("다 친 날짜만 받는 호스트(통계 기간)", () => {
  it("끈 채로는 누를 때마다 칸이 원래 날짜로 되써져 한 글자도 안 쳐진다", () => {
    const seen: string[] = [];
    act(() => root.render(<StrictHost commit={false} seen={seen} />));
    typeInto(input(), "2026-09-30");
    expect(seen).toEqual([]);
    expect(input().value).toBe("2026-09-10");
  });

  it("켜면 치는 동안 칸에 남고, 다 치면 바뀐다", () => {
    const seen: string[] = [];
    act(() => root.render(<StrictHost commit seen={seen} />));
    typeInto(input(), "2026-09-30");
    expect(seen).toEqual(["2026-09-30"]);
    expect(input().value).toBe("2026-09-30");
  });
});
