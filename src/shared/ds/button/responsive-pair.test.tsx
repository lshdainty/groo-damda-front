// ResponsivePair — 판정(반 폭을 넘으면 세로)은 브라우저 배치라 jsdom 에서 재지 않는다. 클래스 계약과 순서만 고정한다
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ResponsivePair } from "./responsive-pair";

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

describe("ResponsivePair", () => {
  it("보조 · 주 순서 그대로 두고, 넘치면 주 버튼이 위로 가는 줄바꿈 거꾸로 + 반 폭 바탕을 건다", () => {
    act(() =>
      root.render(
        <ResponsivePair>
          <button type="button">취소</button>
          <button type="button">엑셀로 내보내기 시작하기</button>
        </ResponsivePair>,
      ),
    );
    const pair = container.firstElementChild as HTMLElement;
    expect(pair.dataset.slot).toBe("responsive-pair");
    expect(pair.className).toContain("flex-wrap-reverse");
    // 버튼은 짝 폭을 넘지 않는다 — 자동 최소(라벨 한 줄 폭)도 짝 폭에서 멈추고, 넘친 라벨은 "…"(min-w-max 면 짝 밖으로 나갔다)
    expect(pair.className).toContain("[&>*]:max-w-full");
    expect(pair.className).not.toContain("min-w-max");
    expect(pair.className).toContain(
      "[&>*]:basis-[calc(50%-var(--spacing-x2)/2)]",
    );
    expect([...pair.children].map((c) => c.textContent)).toEqual([
      "취소",
      "엑셀로 내보내기 시작하기",
    ]);
  });

  it('글자만큼 버튼(data-fit="content" — 시트 바닥 [삭제])은 반 폭 바탕 · 늘어남을 받지 않는다(bottom-sheet.md 코드)', () => {
    act(() =>
      root.render(
        <ResponsivePair>
          <button type="button" data-fit="content">
            삭제
          </button>
          <button type="button">수정</button>
        </ResponsivePair>,
      ),
    );
    const pair = container.firstElementChild as HTMLElement;
    // 레시피 RESPONSIVE_PAIR 와 같은 두 클래스 — 글 폭(basis auto) · 늘지 않음(grow 0), 남은 폭은 주 버튼이 [&>*]:grow 로 채운다
    expect(pair.className).toContain("[&>[data-fit=content]]:grow-0");
    expect(pair.className).toContain("[&>[data-fit=content]]:basis-auto");
    // 그 선택자가 실제로 [삭제] 를 고른다 — 바로 아래 자식이어야 한다(감싸면 빠진다)
    expect(
      [...pair.querySelectorAll(":scope > [data-fit=content]")].map(
        (c) => c.textContent,
      ),
    ).toEqual(["삭제"]);
  });

  it("부르는 쪽의 data-slot · 클래스가 이긴다(시트 · 확인창 바닥)", () => {
    act(() =>
      root.render(
        <ResponsivePair data-slot="bottom-sheet-footer" className="pt-x3">
          <button type="button">확인</button>
        </ResponsivePair>,
      ),
    );
    const pair = container.firstElementChild as HTMLElement;
    expect(pair.dataset.slot).toBe("bottom-sheet-footer");
    expect(pair.className).toContain("pt-x3");
    expect(pair.className).toContain("flex-wrap-reverse");
  });
});
