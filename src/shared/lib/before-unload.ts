import { useEffect } from "react";

/*
 * 새로 고침 · 탭 닫기 · 주소창 이동 전에 브라우저 기본 확인창을 띄운다(I-wrap-b2b 판단 (3)) — 폼이 바뀐 값을 가졌거나(dirty)
 * 저장 중(busy)인 동안에만. 글은 브라우저가 정해 바꿀 수 없다. 여러 자리가 함께 켜도 창 리스너는 하나다(개수로 센다).
 */
let active = 0;
// 우리가 일부러 떠나는 이동(401 → 로그인)은 묻지 않는다 — 물어서 [취소] 하면 로그인으로 못 가고 갇힌다(검수 3차 M3)
let allowed = 0;
const onBeforeUnload = (e: BeforeUnloadEvent) => {
  if (allowed > 0) return;
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

/**
 * 의도한 이동 동안 beforeunload 확인을 끈다(401 로그인 이동 등). 돌려준 함수로 되돌린다 — 이동이 취소돼 이 페이지에
 * 남았을 때 부른다(공용 표식, 검수 3차 M3)
 */
export function allowUnload(): () => void {
  allowed += 1;
  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    allowed -= 1;
  };
}
