/**
 * 시험용 — 링 유틸의 변형을 선택자로 풀어 지금 DOM 에서 링이 걸리는 요소를 찾는다.
 *
 * jsdom 은 Tailwind CSS 를 풀지 않는다. 그래서 클래스 문자열이 적은 조건(초점 · 직전 입력)을 선택자로 바꿔 실제 DOM 에 대 본다 —
 * `<html data-input="pointer">` 에서 빠지고 `keyboard` 에서 걸리는지를 클래스 · 구조 단위로 잠근다(index.css focus-visible 과 같은 조건).
 * Tailwind 가 쓰는 두 꼴만 푼다: `has-[X]:유틸` → `&:has(X)`, `[X]:유틸` → `X`(& 가 그 요소). `_` 는 빈칸이다.
 * 브라우저의 `:focus-visible` 판단은 `:focus` 로 바꿔 댄다 — jsdom 은 그것을 마지막 이벤트로 흉내 내 같은 초점에서도 값이 흔들린다.
 * 여기서 보는 것은 우리가 더한 조건(직전 입력)이다.
 */
export function ringTargets(
  el: Element,
  utility = "outline-stroke-focus-ring",
): Element[] {
  const tokens = (el.getAttribute("class") ?? "")
    .split(/\s+/)
    .filter((t) => t.endsWith(`:${utility}`) && t.includes("focus-visible"));
  if (tokens.length !== 1)
    throw new Error(`초점 링 유틸 ${utility} 이 하나가 아니다: ${tokens}`);
  const variant = tokens[0]!.slice(0, -(utility.length + 1));
  const has = /^has-\[(.*)\]$/.exec(variant);
  const arbitrary = /^\[(.*)\]$/.exec(variant);
  const selector = has ? `&:has(${has[1]})` : arbitrary ? arbitrary[1]! : null;
  if (selector == null) throw new Error(`풀 수 없는 변형: ${variant}`);
  const css = selector
    .replace(/_/g, " ")
    .replace(/:focus-visible/g, ":focus")
    .replace(/&/g, "[data-ring-probe]");
  el.setAttribute("data-ring-probe", "");
  try {
    // 그 요소와 그 안만 본다
    return [el, ...Array.from(el.querySelectorAll("*"))].filter((c) =>
      c.matches(css),
    );
  } finally {
    el.removeAttribute("data-ring-probe");
  }
}

/** 시험용 — 손가락 · 마우스 누름(잡는 단계에서 <html data-input="pointer">) */
export const pressPointer = (doc: Document = document) =>
  doc.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));

/** 시험용 — 키 누름(<html data-input="keyboard">) */
export const pressKey = (doc: Document = document, key = "Shift") =>
  doc.body.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
