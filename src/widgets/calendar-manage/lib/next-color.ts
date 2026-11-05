import { firstUnusedColor } from "@/shared/ds/color-swatch";
import { CHART_PAIRS, chartColorOf } from "@/shared/lib/groo/chart-palette";

/**
 * 새 캘린더 · 새 라벨의 처음 색 — 쓰는 목록이 아직 쓰지 않은 첫 색(color-swatch.md:98, v110 차례 파랑 → 초록 → 주황 → …).
 * 아홉 색을 다 쓰면 파랑부터, 회색은 주지 않는다. 늘 같은 색으로 시작하지 않는다.
 * 저장 값은 라이트 hex(`CHART_PAIRS[].base`) 그대로다.
 */
export function nextColorHex(used: readonly (string | null | undefined)[]) {
  const key = firstUnusedColor(used.map((c) => chartColorOf(c)));
  return CHART_PAIRS.find((p) => p.key === key)!.base;
}
