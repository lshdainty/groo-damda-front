import { createContext, useContext, useEffect, type RefObject } from "react";

/*
 * 화면을 떠나기 전에 묻는 공용 가드(I-wrap-b2b 단계 5) — 셸(AppLayout)이 하나 둔다. 데이터 라우터(useBlocker) 없이 건다.
 *
 *   - 바뀐 값을 가진 화면(설정 > 금액 가리기)이 dirty 동안 `useRegisterLeaveGuard(guard)` 로 맡긴다.
 *     guard(proceed) 는 물어보고(확인창), [나가기] 면 proceed() 를 부른다. 저장 중이면 아무것도 하지 않는다(busy).
 *   - 이동하는 쪽(사이드바 · 탭 바 · 머리 링크 · 설정 구역 목록 · "‹ 계정")은 navigate 전에 `useLeaveGuard()(go)` 를 부른다.
 *     맡긴 가드가 없으면 바로 간다.
 */
export type LeaveGuard = (proceed: () => void) => void;

const fallback: RefObject<LeaveGuard | null> = { current: null };
/** 셸(LeaveGuardProvider)이 값을 준다 — 셸 밖(시험 · 단독 렌더)에서는 모듈 하나를 함께 쓴다 */
export const LeaveGuardContext =
  createContext<RefObject<LeaveGuard | null>>(fallback);

/** 떠나기 가드를 맡긴다(null 이면 맡기지 않는다) — 화면이 내려가면 거둔다 */
export function useRegisterLeaveGuard(guard: LeaveGuard | null) {
  const ref = useContext(LeaveGuardContext);
  useEffect(() => {
    if (!guard) return;
    ref.current = guard;
    return () => {
      if (ref.current === guard) ref.current = null;
    };
  }, [ref, guard]);
}

/** 이동 전에 부른다 — 맡긴 가드가 있으면 그 가드가 묻고, 없으면 바로 proceed() */
export function useLeaveGuard() {
  const ref = useContext(LeaveGuardContext);
  return (proceed: () => void) => {
    const guard = ref.current;
    if (guard) guard(proceed);
    else proceed();
  };
}
