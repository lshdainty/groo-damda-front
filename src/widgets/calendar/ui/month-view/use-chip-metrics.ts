import { useEffect, useRef, useState } from "react";

import type { ChipMetrics } from "./month-model";

/**
 * 칸 안 칩 자리의 실제 크기를 잰다(I-09 10) — 칩 자리 높이(`stackRef`) · 칩 한 줄(`chipRef`) · "+N개" 줄(`moreRef`).
 * 칩 글은 글자 크기 설정을 따르지 않지만(칸 안 글 — groo-design #260) 칸 높이 · 웹폰트가 바뀌면 크기가 바뀌므로 ResizeObserver 로
 * 다시 잰다. 레이아웃이 없는 환경(시험)에서는 0 이 나오므로 `fallback`(스펙 값)을 쓴다.
 */
export function useChipMetrics(fallback: ChipMetrics) {
  const stackRef = useRef<HTMLDivElement>(null);
  const chipRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState<ChipMetrics>(fallback);

  useEffect(() => {
    const stack = stackRef.current;
    const chip = chipRef.current;
    const more = moreRef.current;
    if (!stack || !chip || !more || typeof ResizeObserver === "undefined")
      return;
    const measure = () => {
      const avail = stack.clientHeight;
      const chipH = chip.offsetHeight;
      const moreH = more.offsetHeight;
      if (!avail || !chipH || !moreH) return;
      setMetrics((prev) =>
        prev.avail === avail && prev.chip === chipH && prev.more === moreH
          ? prev
          : { avail, chip: chipH, more: moreH, gap: fallback.gap },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stack);
    observer.observe(chip);
    observer.observe(more);
    return () => observer.disconnect();
  }, [fallback.gap]);

  return { metrics, stackRef, chipRef, moreRef };
}
