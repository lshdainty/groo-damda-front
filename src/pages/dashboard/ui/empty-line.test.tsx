// 혼자 서는 안내 · 빈 글은 14(t4) — 결정 4B(2026-11-10). 띠 · 카드 안 "없어요" 한 줄이 13(t3)으로 돌아가면 깨진다.
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { EmptyLine } from "./home-parts";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

describe("빈 글 크기(4B)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });
  for (const [name, Comp] of [["EmptyLine", EmptyLine]] as const) {
    it(`${name} 는 t4 · fg-neutral-subtle 이다`, () => {
      globalThis.IS_REACT_ACT_ENVIRONMENT = true;
      const el = document.createElement("div");
      document.body.appendChild(el);
      act(() => createRoot(el).render(<Comp>없어요</Comp>));
      const p = el.querySelector("p")!;
      expect(p.classList.contains("text-t4")).toBe(true);
      expect(p.classList.contains("text-t3")).toBe(false);
      expect(p.classList.contains("text-fg-neutral-subtle")).toBe(true);
    });
  }
});
