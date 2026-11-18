/**
 * Recharts 의 자동 축을 명시 nice 눈금으로 고정 — Flutter 앱(`lib/core/format/chart_axis.dart`)
 * 의 `niceAxis` 와 동일 알고리즘. 그릴 때는 `<YAxis {...niceValueAxis(값들, 글자)} />`(axisWidth.ts — 눈금 · 범위 · 폭 ·
 * `interval` 0)로 펼친다 — `ticks` 만 주면 recharts 가 겹친다고 본 눈금을 뺀다. 같은 데이터에 대해 앱과 동일한 눈금이 그려진다
 * (0 포함 + 1·2·5×10ⁿ 딱 떨어지는 step).
 *
 * 간격은 **1 · 2 · 5 × 10ⁿ 계열**만 쓴다(chart.md "축 · 격자") — 2,500 같은 2.5 간격은 만 단위로 줄이면 "0.25만" 이 되어
 * 소수 한 자리로 반올림한 글자("0.3만")가 눈금 위치와 어긋난다.
 */

/** [rough] 이상이 되는 가장 가까운 "깔끔한" 간격 (1·2·5×10ⁿ). */
export function niceStep(rough: number): number {
  if (rough <= 0) return 1;
  const exp = Math.floor(Math.log10(rough));
  const pow10 = Math.pow(10, exp);
  const frac = rough / pow10; // [1, 10)
  const niceFrac = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return niceFrac * pow10;
}

export interface NiceAxis {
  min: number;
  max: number;
  ticks: number[];
}

/**
 * 단일 Y축 — 항상 0 을 포함하고(양수는 0 부터, 음수면 0 아래로 확장),
 * 끝점·간격을 nice 값으로 ceil-tight 하게 맞춘 {min, max, ticks} 반환.
 * 예) max 60,881,200 → { min: 0, max: 80,000,000, ticks: [0,2천만,4천만,6천만,8천만] }.
 */
export function niceAxis(
  dataMin: number,
  dataMax: number,
  targetSteps = 4,
): NiceAxis {
  const lo = Math.min(0, dataMin);
  let hi = Math.max(0, dataMax);
  // 값이 모두 0 이면 0 ~ 1만(앱 `niceChartAxis` 와 같다 — 0 ~ 1 이면 반올림한 눈금이 0 · 0 · 1 · 1 로 겹친다)
  if (lo === hi) hi = lo + 10_000;
  let step = niceStep((hi - lo) / targetSteps);
  // 2.5 를 빼면 2 와 5 사이가 벌어진다 — 5 를 골랐는데 2 로도 한 칸 더(targetSteps + 1) 안에 들면 2 를 쓴다
  // (0 ~ 1만 → 0 · 0.2만 · … · 1만. 5 면 0 · 0.5만 · 1만 두 칸뿐이다)
  const pow10 = Math.pow(10, Math.floor(Math.log10(step) + 1e-9));
  if (Math.round(step / pow10) === 5) {
    const two = 2 * pow10;
    const span = Math.ceil(hi / two - 1e-9) - Math.floor(lo / two + 1e-9);
    if (span <= targetSteps + 1) step = two;
  }
  const min = Math.round(Math.floor(lo / step + 1e-9) * step);
  const max = Math.round(Math.ceil(hi / step - 1e-9) * step);
  const ticks: number[] = [];
  for (let v = min; v <= max + step * 0.5; v += step) ticks.push(Math.round(v));
  return { min, max, ticks };
}
