import * as React from "react";

import { readKeyboardViewport } from "./use-keyboard-viewport";

/*
 * 화면 키보드가 떠 있는 채 표면(시트 · 대화상자)을 닫으면 키보드를 먼저 내리고, 다 내려간 뒤에 닫는다 — Bottom Sheet · Dialog 공통.
 *
 * QA 2026-11-18(iPhone · Safari 26, 담다 · 이음 3/3) — 홈 + → 금액 칸(숫자 키패드) → [×] → 곧바로 하단 "가계부" 를 누르면 이동하지
 * 않았다. 이어 누른 탭은 문서에 pointerdown 조차 오지 않았다(5/6) — 키보드가 내려가는 동안(보이는 영역이 커지며 스크롤을
 * 되돌리는 동안) iOS 가 새 터치를 페이지에 넘기지 않는다. 웹이 받지도 못한 누름이라 닫히는 딤 · 몸통이 누름을 흘려보내는 것
 * (closing-surface.ts)으로는 잡을 수 없다. 그런데 시트는 [×] 를 누르자마자 사라져 사용자는 "다 닫혔다" 고 보고 곧바로 누른다.
 *
 * 그래서 키보드가 떠 있으면 닫기를 이렇게 나눈다.
 *   1. 입력 칸의 초점을 표면(컨테이너)으로 옮긴다 — 키보드가 바로 내려가기 시작한다(누른 반응은 즉시). 초점은 표면 안에 남는다.
 *      시트는 보이는 채 키보드를 따라 내려온다(use-keyboard-viewport — 키보드 위에 붙어 있다).
 *   2. 보이는 영역이 키보드 없는 높이로 돌아오면(visualViewport · window resize) — 늦어도 KEYBOARD_CLOSE_WAIT_MS 뒤에 — 닫는다.
 *      그때부터는 원래의 닫힘(시트 200ms exit · 히스토리 칸 되돌림)이다.
 * 이러면 시트가 사라지는 때가 키보드가 다 내려간 뒤라, 사용자의 다음 탭이 키보드가 내려가는 중에 오지 않는다.
 * 키보드가 없으면(데스크톱 · 키보드를 이미 내린 폰) 그 자리에서 바로 닫는다 — 지금 동작 그대로다.
 */

/** 키보드가 다 내려가기를 기다리는 상한 — iOS 키보드가 내려가는 모션(약 250ms) + 보이는 영역 resize 가 늦게 오는 몫 */
export const KEYBOARD_CLOSE_WAIT_MS = 400;

const NON_TEXT_INPUT = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

/** 화면 키보드를 올리는 칸 — 글자 · 숫자 입력 · textarea · contenteditable */
function isTextEntry(el: Element | null): el is HTMLElement {
  if (el instanceof HTMLInputElement) return !NON_TEXT_INPUT.has(el.type);
  if (el instanceof HTMLTextAreaElement) return true;
  return el instanceof HTMLElement && el.isContentEditable;
}

/**
 * 닫기 — 키보드가 떠 있으면 내리고 다 내려간 뒤에, 아니면 바로 `close` 를 부른다. 기다리는 동안 다시 불러도 한 번만 닫는다.
 * 표면이 내려가면(언마운트) 기다림을 거둔다.
 */
export function useCloseAfterKeyboard(
  surfaceRef: React.RefObject<HTMLElement | null>,
  close: () => void,
) {
  const closeRef = React.useRef(close);
  React.useEffect(() => {
    closeRef.current = close;
  });
  const pendingRef = React.useRef<(() => void) | null>(null);
  React.useEffect(() => () => pendingRef.current?.(), []);
  return () => {
    if (pendingRef.current) return;
    if (!readKeyboardViewport()) {
      closeRef.current();
      return;
    }
    // 키보드를 내린다 — 초점을 표면으로(초점 가둠 안에 남는다). 표면이 받지 못하면 칸에서 초점만 걷는다.
    // 초점 칸이 없으면 키보드가 이미 내려가는 중이다(입력 도구줄 [완료] 뒤 곧바로 [×]) — 그대로 기다린다
    const active = document.activeElement;
    if (isTextEntry(active)) {
      surfaceRef.current?.focus({ preventScroll: true });
      if (document.activeElement === active) active.blur();
    }
    const vv = window.visualViewport;
    const stop = () => {
      pendingRef.current = null;
      clearTimeout(timer);
      vv?.removeEventListener("resize", check);
      window.removeEventListener("resize", check);
    };
    const finish = () => {
      stop();
      closeRef.current();
    };
    function check() {
      if (!readKeyboardViewport()) finish();
    }
    vv?.addEventListener("resize", check);
    window.addEventListener("resize", check);
    const timer = setTimeout(finish, KEYBOARD_CLOSE_WAIT_MS);
    pendingRef.current = stop;
  };
}
