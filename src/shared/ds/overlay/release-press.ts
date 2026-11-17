import * as React from "react";

import { readKeyboardViewport } from "./use-keyboard-viewport";

/** 누름이 끝난(pointerup) 뒤 같은 누름의 click 으로 보는 시간 */
const RELEASE_CLICK_MS = 700;

/**
 * 닫기 단추 — 키보드가 떠 있을 때 손가락(터치 · 펜)으로 누르면 click 이 아니라 손을 뗄 때(pointerup) 누른 것으로 친다.
 *
 * QA 2026-11-18(1/6) — 키보드가 뜬 채 [×] 를 누르면 pointerdown 만 오고 click 이 오지 않아 시트가 닫히지 않았다. iOS 는 터치를
 * 끝낸 뒤 click 을 따로 지어 보내는데(합성 클릭) 그 사이 화면이 움직이면(키보드 · 보이는 영역) 짓지 않고 버린다. 손을 뗀 것
 * (pointerup)은 터치 이벤트 그대로라 온다. 단추 위에서 뗐을 때만 누른 것이다 — 밖으로 밀고 떼면 지금처럼 아무 일 없다.
 * 이어 오는 같은 누름의 click 은 거둔다(consumeClick). 키보드(Enter · Space) · 마우스 · 키보드가 없는 터치는 click 그대로다.
 */
export function useReleasePress(onPress: () => void) {
  const onPressRef = React.useRef(onPress);
  React.useEffect(() => {
    onPressRef.current = onPress;
  });
  const armedRef = React.useRef<number | null>(null);
  const firedAtRef = React.useRef(0);
  return {
    pointerHandlers: {
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        firedAtRef.current = 0;
        armedRef.current =
          e.pointerType !== "mouse" &&
          e.isPrimary &&
          e.button === 0 &&
          readKeyboardViewport()
            ? e.pointerId
            : null;
      },
      onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
        if (armedRef.current !== e.pointerId) return;
        armedRef.current = null;
        const box = e.currentTarget.getBoundingClientRect();
        const inside =
          e.clientX >= box.left &&
          e.clientX <= box.right &&
          e.clientY >= box.top &&
          e.clientY <= box.bottom;
        if (!inside) return;
        firedAtRef.current = Date.now();
        onPressRef.current();
      },
      onPointerCancel: () => {
        armedRef.current = null;
      },
    },
    /** 이 click 이 손을 뗄 때 이미 누른 누름의 나머지면 true(거둔다) — 아니면 false(click 으로 누른다) */
    consumeClick: () => {
      const fired = firedAtRef.current;
      firedAtRef.current = 0;
      return fired > 0 && Date.now() - fired <= RELEASE_CLICK_MS;
    },
  };
}
