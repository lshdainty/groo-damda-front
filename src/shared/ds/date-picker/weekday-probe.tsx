import type * as React from "react";

import { WEEKDAY_PROBE_SLOT } from "./weekday-fit";

/**
 * 두 글자 요일 견본 — 칸에 들어가는지 재는 데만 쓴다(보이지 않고 읽히지 않는다). 요일 칸 안에 두고, 칸은 `relative` 다.
 * 판정은 `useWeekdayFit` · `useWeekdayNarrow`(weekday-fit.ts).
 */
export function WeekdayProbe({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      data-slot={WEEKDAY_PROBE_SLOT}
      className="pointer-events-none invisible absolute whitespace-nowrap"
    >
      {children}
    </span>
  );
}
