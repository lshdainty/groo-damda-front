import { act } from "react";

/**
 * 거래 상세 시험의 손 — jsdom 에는 matchMedia · ResizeObserver 가 없다(상세 표면은 폭으로 갈린다 — 이 환경은 1280 미만, 시트).
 * `t` 는 키를 그대로 돌려주게 mock 한다 — 줄 · 버튼은 키로 집는다.
 */
export function setupDetailDom(wide = false) {
  window.history.replaceState(null, "");
  window.matchMedia = ((query: string) => ({
    matches: wide,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  const proto = Element.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => {};
  proto.releasePointerCapture ??= () => {};
  proto.scrollIntoView ??= () => {};
}

export const click = (el: Element) =>
  act(() => el.dispatchEvent(new MouseEvent("click", { bubbles: true })));

export const pressEsc = () =>
  act(() => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
  });

/** 글이 정확히 같은 버튼 중 가장 나중(맨 위에 뜬 표면)의 것 */
export function lastButton(label: string): HTMLButtonElement {
  const el = [...document.body.querySelectorAll("button")]
    .filter((b) => b.textContent?.trim() === label)
    .slice(-1)[0];
  if (!el) throw new Error(`${label} 버튼을 찾지 못했다`);
  return el;
}

export const hasButton = (label: string) =>
  [...document.body.querySelectorAll("button")].some(
    (b) => b.textContent?.trim() === label,
  );

/** "더 하기" 줄 — 키(refund · split · recurring · dutch)로 집는다. 값 글은 줄(li)에 있다 */
export const moreRow = (key: string) =>
  document.body.querySelector<HTMLButtonElement>(`[data-testid="more-${key}"]`);
export const moreRowText = (key: string) =>
  moreRow(key)?.closest("li")?.textContent ?? "";
