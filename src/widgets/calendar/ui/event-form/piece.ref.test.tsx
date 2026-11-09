// 날짜 · 시각 조각이 ref 를 버튼에 이어야 1280 이상 팝오버(PopoverTrigger asChild)가 조각 아래에 선다.
// 안 이으면 닫힌 자리 없는 팝오버가 화면 밖(−200%)에 떠 휠이 안 보인다.
import { act, createRef } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "ko" } }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const { Piece } = await import("./sheet-body");

describe("Piece", () => {
  it("ref 와 buttonRef 가 모두 버튼을 가리킨다", () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const a = createRef<HTMLButtonElement>();
    const b = createRef<HTMLButtonElement>();
    const host = document.createElement("div");
    const root = createRoot(host);
    act(() =>
      root.render(
        <Piece
          label="시각"
          expanded={false}
          onClick={() => {}}
          ref={a}
          buttonRef={b}
        >
          오후 7:57
        </Piece>,
      ),
    );
    expect(a.current).toBeInstanceOf(HTMLButtonElement);
    expect(b.current).toBe(a.current);
    act(() => root.unmount());
  });
});
