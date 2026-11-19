import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 같은 행을 다시 누른 것으로 보는 시간(ms) — 할 일 완료 원처럼 누르면 바로 목록에서 빠지는 줄의 재탭 방어(TodoPage).
 * 이 시간 안에 같은 행을 다시 누르면 버린다.
 */
export const REPEAT_TAP_GUARD_MS = 600;

/**
 * 낙관 갱신으로 목록에서 빠질 항목을 그 자리에 잠깐 붙들어 두는 시간(ms).
 *
 * 재탭 방어 [REPEAT_TAP_GUARD_MS](600) 보다 **길어야** 한다 —
 * 재탭 방어가 풀린 뒤에도 행이 남아 있어야 두 번째 탭이 (이미 완료된) 같은 행에
 * 떨어진다. 두 값의 대소가 뒤집히면 방어에 틈이 생긴다.
 */
export const LIST_HOLD_MS = 700;

/**
 * 항목별 자리 유지 — 완료 토글처럼 **누른 즉시 목록에서 빠지는** 항목이 대상이다.
 *
 * 완료를 따닥 누르면 다른 할 일까지 완료됐다(QA #29). 첫 탭의 낙관 갱신이 그 행을
 * 곧바로 목록에서 빼고 아래 행이 같은 좌표로 올라와, 두 번째 탭이 **다음 항목**을
 * 완료시킨 것이다. `usePendingIds` 가 "그 항목만 잠근다" 라면 이건 "그 항목을 그
 * 자리에 남긴다" 다 — 잠금은 같은 행을 지키고, 자리 유지는 **다른 행**을 지킨다.
 *
 * 요청이 끝나는 시점이 아니라 고정 시간으로 푼다. 통신이 빠르면 잠금이 100ms 만에
 * 풀려 두 번째 탭이 그 뒤에 오기 때문이다.
 */
export function useHoldIds(ms: number = LIST_HOLD_MS) {
  const [holdIds, setHoldIds] = useState<ReadonlySet<number>>(() => new Set());
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const hold = useCallback(
    (id: number) => {
      const timer = timers.current.get(id);
      if (timer) clearTimeout(timer);
      setHoldIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id);
          setHoldIds((prev) => {
            if (!prev.has(id)) return prev;
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }, ms),
      );
    },
    [ms],
  );

  // 언마운트 뒤 타이머가 살아 있으면 사라진 컴포넌트에 setState 한다.
  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const t of map.values()) clearTimeout(t);
      map.clear();
    };
  }, []);

  return { holdIds, hold };
}
