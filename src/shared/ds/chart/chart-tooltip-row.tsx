import type * as React from "react";

import { outlineMarkerStyle } from "./chart-variants";

/**
 * 툴팁 줄 "■ 라벨 값" — 색 네모 8(모서리 2) ↔ 라벨 6 · 라벨 13 fg-neutral-muted ↔ 값(12 이상) · 값 13 · 700 · fg-neutral · 고정폭 숫자(오른쪽).
 * [outline] 이 있으면 색 네모를 막대처럼 옅은 바탕([swatch]) + 1px [outline] 색 테두리로 그린다(ChartMarker "outline")
 */
export function ChartTooltipRow({
  swatch,
  outline,
  name,
  value,
}: {
  swatch: string | undefined;
  outline?: string;
  name: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div
      data-slot="chart-tooltip-row"
      className="flex items-center gap-x1_5 text-t3"
    >
      <span
        aria-hidden
        data-slot="chart-tooltip-swatch"
        data-marker={outline ? "outline" : undefined}
        className="size-[8px] shrink-0 rounded-[2px]"
        style={{
          background: swatch,
          ...(outline ? outlineMarkerStyle(outline) : null),
        }}
      />
      <span data-slot="chart-tooltip-label" className="text-fg-neutral-subtle">
        {name}
      </span>
      <span
        data-slot="chart-tooltip-value"
        className="ml-auto pl-x3 font-bold tabular-nums text-fg-neutral"
      >
        {value}
      </span>
    </div>
  );
}
