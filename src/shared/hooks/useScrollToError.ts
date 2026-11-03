import { useEffect, useRef } from "react";

/**
 * 폼 본문은 스크롤되고 [적용] 은 바닥에 붙어 있어서, 목록을 내려 고른 뒤 실패하면 맨 위 Callout 이 화면 밖이다.
 * `active`(실패 상태)가 켜질 때 그 Callout 이 보이게 본문을 맨 위로 올린다 — 돌려주는 ref 를 Callout 을 감싼 요소에 단다.
 *
 * `token` 은 실패마다 새로 생기는 값(`mut.error` — 실패 때마다 새 오류 객체. 시각(`submittedAt`)은 같은 시각에 두 번 시도하면 같아 쓰지 않는다). 실패 → 다시 [적용] → 또 실패에서 `active` 가 true 로 이어져 보여도
 * (재시도가 시작되면 mutation 이 pending 이 되어 한 번 꺼지지만, 꺼짐이 한 번도 안 그려지는 경우를 막는다) 매번 다시 올린다.
 * 재시도가 진행되는 동안(active 가 꺼진 동안)은 움직이지 않는다. 모션 줄이기면 부드럽게 오르지 않고 바로 간다.
 */
export function useScrollToError<T extends HTMLElement>(
  active: boolean,
  token: unknown,
) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    if (!active) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    ref.current?.scrollIntoView({
      block: "start",
      behavior: reduce?.matches ? "auto" : "smooth",
    });
  }, [active, token]);
  return ref;
}
