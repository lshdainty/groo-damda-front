import { useEffect, useRef, useState } from "react";

/** 붙는 자리 — 스크롤 칸 위에서 20(`spacing-x5`) 떨어진다. 가계부 넓은 화면의 왼쪽 칸과 같은 값 */
const STICKY_TOP = 20;

/**
 * 왼쪽 칸이 스크롤해도 붙어 있으려면(I-10 25) 화면에 다 들어와야 한다 — 화면보다 길면 붙이지 않는다(붙이면 아래가 영영 안 보인다).
 * 칸 높이 + 붙는 자리가 스크롤 칸(`#main`) 높이 안에 들어올 때만 `fits` 가 참이다. 칸 높이(남은 할 일 줄 수)나 창 높이가 바뀌면 다시 잰다.
 */
export function useStickyFit(enabled: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [fits, setFits] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    const scroller = el.closest<HTMLElement>("#main");
    const measure = () => {
      const room = scroller?.clientHeight ?? window.innerHeight;
      setFits(el.offsetHeight + STICKY_TOP <= room);
    };
    measure();
    window.addEventListener("resize", measure);
    const ro =
      typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => {
      window.removeEventListener("resize", measure);
      ro?.disconnect();
    };
  }, [enabled]);
  return { ref, sticky: enabled && fits };
}
