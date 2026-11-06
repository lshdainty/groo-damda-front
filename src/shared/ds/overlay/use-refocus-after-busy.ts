import * as React from "react";

/*
 * 저장 중(busy)에는 본문이 inert 다 — 그 안에 초점이 있으면(입력칸에서 Enter 로 저장) 브라우저가 초점을 문서(body)로 빼고,
 * Radix 의 초점 가둠은 relatedTarget 이 없는 focusout 을 그냥 두어 Tab 이 뒤 화면(사이드바 링크 등)에 닿는다(검수 M2).
 *
 *   - busy 가 켜지는 순간(레이아웃 단계 — 브라우저가 inert 초점을 정리하기 전) 초점이 inert 본문 안에 있으면 그 칸을 기억하고
 *     표면(컨테이너)으로 옮긴다. 가둠이 살아 있어 Tab 은 표면 안(바닥 · 머리)을 돈다.
 *   - busy 가 꺼지면(실패 — 성공이면 표면이 닫힌다) 기억한 칸이 아직 있고 초점이 표면 · 문서에 있으면 그 칸으로 되돌린다.
 *     칸이 사라졌으면(단계가 바뀜) 표면에 둔다. 초점이 이미 다른 곳(바닥 단추)으로 갔으면 건드리지 않는다.
 */
export function useRefocusAfterBusy(
  busy: boolean,
  surfaceRef: React.RefObject<HTMLElement | null>,
) {
  const wasBusy = React.useRef(busy);
  const savedRef = React.useRef<HTMLElement | null>(null);
  React.useLayoutEffect(() => {
    const was = wasBusy.current;
    wasBusy.current = busy;
    const surface = surfaceRef.current;
    if (!surface?.isConnected) return;
    const active = document.activeElement;
    if (busy && !was) {
      // 초점이 이번에 inert 가 된 본문 안이다 — 빠지기 전에 표면으로
      if (
        active instanceof HTMLElement &&
        surface.contains(active) &&
        active.closest("[inert]") != null
      ) {
        savedRef.current = active;
        surface.focus({ preventScroll: true });
      }
      return;
    }
    if (!busy && was) {
      const saved = savedRef.current;
      savedRef.current = null;
      const lost = active == null || active === document.body;
      if (!lost && active !== surface) return;
      if (
        saved?.isConnected &&
        surface.contains(saved) &&
        saved.closest("[inert]") == null
      )
        saved.focus({ preventScroll: true });
      else if (lost) surface.focus({ preventScroll: true });
    }
  }, [busy, surfaceRef]);
}
