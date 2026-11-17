/**
 * Recharts 의 자동 축을 명시 nice 눈금으로 고정 — Flutter 앱(`lib/core/format/chart_axis.dart`)
 * 의 `niceAxis` 와 동일 알고리즘. `<YAxis domain={[a.min,a.max]} ticks={a.ticks} />` 로 적용하면
 * 같은 데이터에 대해 앱과 동일한 눈금이 그려진다 (0 포함 + 1·2·5×10ⁿ 딱 떨어지는 step).
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

export interface NiceCeil {
  max: number;
  step: number;
  ticks: number[];
}

/**
 * dual-axis(수입·지출)용 — 0 기준 고정 [ticks]개(기본 5) 눈금으로 ceil.
 * 좌·우 축에 각각 적용하면 둘 다 같은 개수의 균등 눈금을 가져 가로 그리드가 정렬된다.
 * 앱 `stats_screen.dart` 의 `_niceCeil` 과 동일.
 */
export function niceCeil(rawMax: number, ticks = 5): NiceCeil {
  const n = ticks - 1;
  if (rawMax <= 0) {
    const step = 1 / n;
    return {
      max: 1,
      step,
      ticks: Array.from({ length: ticks }, (_, i) => i * step),
    };
  }
  const roughStep = rawMax / n;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const mantissa = roughStep / magnitude;
  // 1 · 2 · 5 × 10ⁿ 계열(2.5 없음 — chart.md "축 · 격자"). 눈금 수가 정해져 있어 2 로 내려 담을 수는 없다
  const niceMantissa =
    mantissa <= 1 ? 1 : mantissa <= 2 ? 2 : mantissa <= 5 ? 5 : 10;
  const step = niceMantissa * magnitude;
  const max = step * n;
  return {
    max,
    step,
    ticks: Array.from({ length: ticks }, (_, i) => Math.round(i * step)),
  };
}
