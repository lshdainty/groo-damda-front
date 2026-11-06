import { useEffect } from "react";

/*
 * 새로 고침 · 탭 닫기 · 주소창 이동 전에 브라우저 기본 확인창을 띄운다(I-wrap-b2b 판단 (3)) — 폼이 바뀐 값을 가졌거나(dirty)
 * 저장 중(busy)인 동안에만. 글은 브라우저가 정해 바꿀 수 없다. 여러 자리가 함께 켜도 창 리스너는 하나다(개수로 센다).
 */
let active = 0;
const onBeforeUnload = (e: BeforeUnloadEvent) => {
  e.preventDefault();
  // 옛 브라우저(크롬 119 이전)는 returnValue 를 채워야 묻는다
  e.returnValue = "";
};

/** on 인 동안 beforeunload 확인을 건다 — 꺼지거나 내려가면 거둔다 */
export function useBeforeUnloadWhile(on: boolean) {
  useEffect(() => {
    if (!on) return;
    if (active === 0) window.addEventListener("beforeunload", onBeforeUnload);
    active += 1;
    return () => {
      active -= 1;
      if (active === 0)
        window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [on]);
}
