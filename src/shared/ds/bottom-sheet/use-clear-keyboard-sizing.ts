import * as React from "react";

/** vaul 이 "키보드가 떴다" 로 보는 최소 높이 차. 같은 값을 쓴다. */
export const KEYBOARD_MIN_PX = 60;

/**
 * 키보드가 내려갔는데 시트가 키보드 높이 · 그때 높이에 박혀 있는 것을 푼다.
 *
 * vaul(`repositionInputs`)은 키보드가 뜨면 시트의 `style.bottom` · `style.height` 를 픽셀로 박고
 * 내려가면 되돌린다. 그런데 "키보드가 열렸나" 를 절대값이 아니라 **뒤집기**로 기억한다 —
 * 키보드 높이가 열린 채 60px 넘게 바뀌면(숫자 키패드 → 글자 키보드) 상태가 거꾸로 되고,
 * 그 뒤 초점을 빼서 내리면 vaul 의 처리기가 아예 돌지 않아 `bottom` 이 그대로 남는다.
 * 겹친 시트 아래의 폼 시트도 같다. 레이아웃 뷰포트까지 함께 줄어드는 브라우저(삼성 인터넷)에서는
 * 되돌릴 기준 높이가 이미 줄어든 값으로 잡혀 반쪽으로 남는다(2026-09-18).
 *
 * 규칙은 하나다 — **지금 키보드가 없으면 키보드 때문에 박힌 값도 없어야 한다.** 판정은 절대값
 * (`innerHeight − visualViewport.height ≤ 60`)이라 vaul 의 뒤집기가 어긋나도 풀린다.
 * 지우고 나면 클래스와 내용이 높이를 정한다.
 *
 * 다음 프레임에 지우는 이유 — vaul 도 같은 `resize` 를 듣고 그 안에서 값을 다시 박는다.
 * 같은 이벤트 안에서 지우면 그 뒤에 다시 박혀 아무 일도 안 한 것이 된다.
 *
 * 듣는 것: visualViewport `resize` · `scroll`(iOS 는 높이 변화가 늦거나 resize 없이 끝난다) ·
 * window `resize` · `focusout`(초점을 빼 내리는 길). 마운트 때도 한 번 확인한다 —
 * 시트가 닫혔다 열릴 때 낡은 값이 남지 않게.
 */
export function useClearKeyboardSizing(
  targetRef: React.RefObject<HTMLElement | null>,
) {
  React.useEffect(() => {
    // 구독은 마운트 시점의 객체에 건다. 높이는 부를 때마다 다시 읽는다.
    const vvAtMount = window.visualViewport;
    let raf = 0;
    const clear = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = targetRef.current;
        if (!el) return;
        // 키보드가 떠 있으면 vaul 이 관리 중이다 — 건드리지 않는다.
        const vv = window.visualViewport;
        const keyboard = vv ? window.innerHeight - vv.height : 0;
        if (keyboard > KEYBOARD_MIN_PX) return;
        el.style.removeProperty("height");
        el.style.removeProperty("bottom");
      });
    };
    vvAtMount?.addEventListener("resize", clear);
    vvAtMount?.addEventListener("scroll", clear);
    window.addEventListener("resize", clear);
    document.addEventListener("focusout", clear);
    clear();
    return () => {
      cancelAnimationFrame(raf);
      vvAtMount?.removeEventListener("resize", clear);
      vvAtMount?.removeEventListener("scroll", clear);
      window.removeEventListener("resize", clear);
      document.removeEventListener("focusout", clear);
    };
  }, [targetRef]);
}
