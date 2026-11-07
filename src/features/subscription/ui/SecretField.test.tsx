// 증권사 API Key 는 시크릿과 짝이 되는 자격증명의 반쪽이다.
// 한동안 Key 만 평문으로 떠 있었다 — 다시 벗겨지면 여기서 깨진다.
import { act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SecretField } from "@/features/subscription/ui/SecretField";

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
}

const input = () => container.querySelector("input")!;
const toggle = (label: string) =>
  container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;

/** 붙여넣기가 값을 밀어 넣는 것과 같은 경로 — native setter + input 이벤트. */
function paste(el: HTMLInputElement, text: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )!.set!;
  act(() => {
    setter.call(el, text);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** 실제 사용처와 같은 controlled 배선. */
function Harness({ label = "App Key" }: { label?: string }) {
  const [v, setV] = useState("");
  const [shown, setShown] = useState(false);
  return (
    <SecretField
      label={label}
      value={v}
      onChange={setV}
      revealed={shown}
      onRevealedChange={setShown}
      toggleAriaLabel={`${label} 보기`}
    />
  );
}

describe("SecretField", () => {
  it("처음엔 가려져 있다", () => {
    render(<Harness />);
    expect(input().type).toBe("password");
  });

  it("브라우저가 자격증명을 기억하지 않게 한다", () => {
    render(<Harness />);
    expect(input().getAttribute("autocomplete")).toBe("off");
    expect(input().getAttribute("spellcheck")).toBe("false");
  });

  it("눈 아이콘으로 벗겨 보고 다시 가린다", () => {
    render(<Harness />);
    const btn = toggle("App Key 보기");

    act(() => btn.click());
    expect(input().type).toBe("text");
    expect(btn.getAttribute("aria-pressed")).toBe("true");

    act(() => btn.click());
    expect(input().type).toBe("password");
    expect(btn.getAttribute("aria-pressed")).toBe("false");
  });

  it("가려진 채로도 붙여넣기가 된다", () => {
    // API 키는 손으로 칠 수 있는 길이가 아니다.
    const key = "PSb2xkZW4tc2VjcmV0LWtleS0xMjM0NTY3ODkwYWJjZGVm";
    render(<Harness />);
    expect(input().type).toBe("password");

    paste(input(), key);
    expect(input().value).toBe(key);
  });

  it("onChange 로 값을 그대로 올린다", () => {
    const onChange = vi.fn();
    render(
      <SecretField
        label="App Secret"
        value=""
        onChange={onChange}
        revealed={false}
        onRevealedChange={() => {}}
        toggleAriaLabel="App Secret 보기"
      />,
    );
    paste(input(), "SEabcdef0123456789");
    expect(onChange).toHaveBeenCalledWith("SEabcdef0123456789");
  });

  it("라벨은 서버가 준 값 그대로고 자리 글(placeholder)은 없다", () => {
    // 토스는 "Client ID", 나무는 "App Key" — 프론트에 박지 않는다.
    render(<Harness label="Client ID" />);
    expect(container.textContent).toContain("Client ID");
    expect(input().placeholder).toBe("");
    expect(toggle("Client ID 보기")).toBeTruthy();
  });
});
