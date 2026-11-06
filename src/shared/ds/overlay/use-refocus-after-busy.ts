import * as React from "react";

/*
 * 저장 중(busy)에는 본문이 inert 라 그 안에 있던 초점(Enter 로 저장한 입력칸)이 문서(body)로 빠진다. 저장이 끝나면 초점을
 * 표면으로 돌려놓는다 — 그래야 Tab 이 다시 표면 안을 돌고, 실패 Callout 을 읽은 뒤 바로 고칠 칸으로 갈 수 있다.
 * 초점이 표면 안에 그대로 있으면(저장 단추 — 바닥은 inert 가 아니다) 건드리지 않는다.
 */
export function useRefocusAfterBusy(
  busy: boolean,
  surfaceRef: React.RefObject<HTMLElement | null>,
) {
  const wasBusy = React.useRef(busy);
  React.useEffect(() => {
    const was = wasBusy.current;
    wasBusy.current = busy;
    if (!was || busy) return;
    const surface = surfaceRef.current;
    if (!surface?.isConnected) return;
    const active = document.activeElement;
    if (active == null || active === document.body)
      surface.focus({ preventScroll: true });
  }, [busy, surfaceRef]);
}
