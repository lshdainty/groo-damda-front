/**
 * 마지막 입력 방식 — 키보드인가 포인터(마우스 · 손가락 · 펜)인가를 `<html data-input>` 에 적는다.
 *
 * 초점 링은 `:focus-visible` 일 때만 그린다(DESIGN.md 초점 링). 그런데 브라우저는 스크립트가 옮긴 초점(화면을 옮긴 뒤 제목,
 * 닫힌 뒤 연 자리)에 :focus-visible 을 앞 초점에서 이어받아 준다 — 손가락으로 탭을 눌러 화면을 옮겨도 제목 · 탭에 링이 남았다
 * (iPhone · iPad Safari). 그래서 링의 조건(index.css 의 `focus-visible` 변형)에 "직전 입력이 포인터면 그리지 않는다" 를 더한다.
 * 글을 넣는 칸(input · textarea · select · contenteditable)은 그대로 둔다 — 브라우저가 누름에도 링을 주는 자리다.
 *
 * 잡는 단계에서 듣는다 — 다른 처리가 초점을 옮기기 전에 값이 바뀌어 있어야 한다. 수정 키 조합(⌘ · Ctrl · Alt)은 단축키라 세지 않는다.
 */
export type InputModality = "keyboard" | "pointer";

let tracking = false;

export function trackInputModality(doc: Document = document) {
  if (tracking) return;
  tracking = true;
  const root = doc.documentElement;
  const set = (value: InputModality) => {
    if (root.dataset.input !== value) root.dataset.input = value;
  };
  doc.addEventListener(
    "keydown",
    (e) => {
      if (!e.metaKey && !e.ctrlKey && !e.altKey) set("keyboard");
    },
    true,
  );
  doc.addEventListener("pointerdown", () => set("pointer"), true);
}

/** 마지막 입력 방식 — 아직 아무 입력도 없으면 undefined. 링을 JS 로 거는 자리(Slider 손잡이)가 CSS 와 같은 값을 읽는다 */
export function lastInputModality(
  doc: Document = document,
): InputModality | undefined {
  const value = doc.documentElement.dataset.input;
  return value === "keyboard" || value === "pointer" ? value : undefined;
}

/**
 * 키보드 초점인가 — 초점 링과 같은 조건(index.css `focus-visible` 변형)을 JS 에서 본다.
 * :focus-visible 이면서 직전 입력이 포인터가 아닐 때. 글을 넣는 칸은 링처럼 그대로 둔다.
 * 키보드 초점에만 여는 · 멈추는 자리(Tooltip 열기 · Snackbar 멈춤)가 쓴다 — 손가락으로 누른 뒤 스크립트가 옮긴 초점은
 * 브라우저가 :focus-visible 을 이어받아 주지만 키보드 초점이 아니다(tooltip.md · snackbar.md "키보드 초점이 오면").
 */
export function isKeyboardFocus(el: Element): boolean {
  if (!el.matches(":focus-visible")) return false;
  if (el.matches("input, textarea, select, [contenteditable]")) return true;
  return lastInputModality(el.ownerDocument) !== "pointer";
}

/** 시험용 — 듣기를 다시 걸 수 있게 */
export function resetInputModalityForTest() {
  tracking = false;
  delete document.documentElement.dataset.input;
}
