// 금액 칸 상한 — 넘는 입력은 받지 않고(값 그대로) 칸 아래 critical 오류, 다음 유효한 입력에서 사라진다(2026-11-07).
import { act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Field } from "@/shared/ds/field";
import { setNativeValue } from "@/shared/ds/field";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: { max?: string }) => (o?.max ? `${k}|${o.max}` : k),
    i18n: { language: "ko" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const { AmountInput } = await import("./amount-input");

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;
let last: string[] = [];

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  last = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function Host({
  initial = "",
  max,
  inField,
}: {
  initial?: string;
  max?: number;
  inField?: boolean;
}) {
  const [v, setV] = useState(initial);
  const input = (
    <AmountInput
      aria-label="금액"
      value={v}
      max={max}
      onValueChange={(d) => {
        last.push(d);
        setV(d);
      }}
    />
  );
  return inField ? <Field label="금액">{input}</Field> : input;
}

function mount(node: ReactNode) {
  act(() => root.render(node));
}
const field = () => container.querySelector("input") as HTMLInputElement;
const type = (value: string) => act(() => setNativeValue(field(), value));
const errorText = () =>
  [...container.querySelectorAll("p")]
    .map((p) => p.textContent)
    .filter((x) => x?.includes("amountTooLarge"));

describe.each([
  ["Field 밖", false],
  ["Field 안", true],
])("AmountInput 상한 — %s", (_n, inField) => {
  it("100억 이하는 받는다 — 쉼표를 찍고 오류가 없다", () => {
    mount(<Host inField={inField} />);
    type("10000000000");
    expect(field().value).toBe("10,000,000,000");
    expect(errorText()).toEqual([]);
    expect(field().getAttribute("aria-invalid")).toBeNull();
  });

  it("넘는 입력은 받지 않고 값은 그대로, 칸 아래에 오류가 뜬다(깎지 않는다)", () => {
    mount(<Host initial="10000000000" inField={inField} />);
    type("100,000,000,001");
    expect(field().value).toBe("10,000,000,000");
    expect(last).toEqual([]); // 값을 바꾸지도 않았다
    expect(errorText()).toEqual(["amountTooLarge"]);
    expect(field().getAttribute("aria-invalid")).toBe("true");
    // 칸과 오류가 이어진다 — 오류 글이 칸의 설명이다
    const ids = (field().getAttribute("aria-describedby") ?? "").split(" ");
    const described = ids.map((id) => document.getElementById(id)?.textContent);
    expect(described).toContain("amountTooLarge");
  });

  it("15자리 붙여넣기도 통째로 받지 않는다", () => {
    mount(<Host inField={inField} />);
    type("999999999999999");
    expect(field().value).toBe("");
    expect(errorText()).toEqual(["amountTooLarge"]);
  });

  it("다음 유효한 입력에서 오류가 사라진다", () => {
    mount(<Host initial="5" inField={inField} />);
    type("99999999999");
    expect(errorText()).toEqual(["amountTooLarge"]);
    type("52");
    expect(field().value).toBe("52");
    expect(errorText()).toEqual([]);
    expect(field().getAttribute("aria-invalid")).toBeNull();
  });

  it("알림은 화면 읽기 프로그램에도 한 번 간다(polite)", () => {
    mount(<Host inField={inField} />);
    type("999999999999999");
    const live = [...container.querySelectorAll("[aria-live=polite]")].map(
      (n) => n.textContent,
    );
    expect(live).toContain("amountTooLarge");
  });

  it("잔액 칸(1,000억)은 그 숫자로 말한다", () => {
    mount(<Host max={100_000_000_000} inField={inField} />);
    type("999999999999");
    expect(
      [...container.querySelectorAll("p")].map((p) => p.textContent),
    ).toContain("amountTooLargeAt|1,000억원");
  });
});

describe("AmountInput 상한 — 옛 값 · 칸 밖 변경 · 폼 오류와의 순서", () => {
  function Ext({ initial = "" }: { initial?: string }) {
    const [v, setV] = useState(initial);
    return (
      <Field label="금액">
        <AmountInput aria-label="금액" value={v} onValueChange={setV} />
        <button type="button" data-testid="chip" onClick={() => setV("9000")} />
        <button type="button" data-testid="clear" onClick={() => setV("")} />
      </Field>
    );
  }
  const click = (id: string) =>
    act(() =>
      (container.querySelector(`[data-testid=${id}]`) as HTMLElement).click(),
    );

  it("옛 초과 값을 열면 오류가 보이고, 한 자리 지우기는 받는다(오류는 상한 안이 될 때까지)", () => {
    mount(<Ext initial="123456789012345" />);
    expect(errorText()).toEqual(["amountTooLarge"]);
    expect(field().getAttribute("aria-invalid")).toBe("true");
    type("12,345,678,901,234"); // 한 자리 지움
    expect(field().value).toBe("12,345,678,901,234");
    expect(errorText()).toEqual(["amountTooLarge"]);
    type("1234567890"); // 상한 안
    expect(field().value).toBe("1,234,567,890");
    expect(errorText()).toEqual([]);
  });

  it("옛 초과 값에 한 자리 더 붙이는 입력은 받지 않는다", () => {
    mount(<Ext initial="123456789012345" />);
    type("1234567890123456");
    expect(field().value).toBe("123,456,789,012,345");
  });

  it("칸 밖에서 값이 바뀌면 오류를 다시 계산한다 — 프리셋 칩 · 비우기", () => {
    mount(<Ext initial="5" />);
    type("999999999999999");
    expect(errorText()).toEqual(["amountTooLarge"]);
    click("chip");
    expect(field().value).toBe("9,000");
    expect(errorText()).toEqual([]);
    expect(field().getAttribute("aria-invalid")).toBeNull();
    type("999999999999999");
    expect(errorText()).toEqual(["amountTooLarge"]);
    click("clear");
    expect(field().value).toBe("");
    expect(errorText()).toEqual([]);
  });

  it("거절한 순간엔 상한 오류, 폼 오류가 서는 순간엔 폼 오류 — 최근 일이 이긴다", () => {
    function Form({ formError }: { formError: boolean }) {
      const [v, setV] = useState("");
      return (
        <Field
          label="금액"
          invalid={formError}
          errorMessage="금액을 입력해주세요."
        >
          <AmountInput aria-label="금액" value={v} onValueChange={setV} />
        </Field>
      );
    }
    const texts = () =>
      [...container.querySelectorAll("p")].map((p) => p.textContent);
    // 폼 오류가 먼저 떠 있다
    mount(<Form formError />);
    expect(texts()).toEqual(["금액을 입력해주세요."]);
    // 15자리를 붙여넣으면 거절 — 상한 오류가 보인다(말없이 거절되지 않는다)
    type("999999999999999");
    expect(texts()).toEqual(["amountTooLarge"]);
    // 저장을 눌러 폼 오류가 다시 서면(없어졌다 다시 생김) 폼 오류가 보인다
    mount(<Form formError={false} />);
    mount(<Form formError />);
    expect(texts()).toEqual(["금액을 입력해주세요."]);
    // 다시 거절하면 상한 오류
    type("999999999999999");
    expect(texts()).toEqual(["amountTooLarge"]);
  });
});
