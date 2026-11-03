/**
 * 캔들 차트 위 범례 — 크로스헤어(또는 마지막 봉)의 O H L C 와 거래량.
 *
 * 글은 R10 범례(t3 · 400 · fg-neutral-subtle, 숫자 고정폭)다. 오름 · 내림 색은 캔들과 같은 방향 색이다
 * (오름 fg-critical · 내림 fg-informative — 국내 관례, DESIGN 증감). 차트 그림 위 자기 줄이다(겹치지 않는다 — 폰 · 글자 200% 에서 눈금 · 캔들과
 * 겹치던 것을 줄로 뺐다). 줄바꿈은 허용하고 좌우 여백은 없고(그래프 왼쪽 끝에 맞춘다) 위아래만 눈금(spacing-x1)으로 둔다(I-05 30). 증권 화면(detail-parts ChartBlock)과 앱 임베드가 함께 쓴다.
 */
export interface StockChartLegendValue {
  o: number;
  h: number;
  l: number;
  c: number;
  vol: number;
  up: boolean;
}

export function StockChartLegend({
  legend,
  isUs,
}: {
  /** null 이면 값 없이 한 줄 높이만 지킨다(채워질 때 차트가 밀리지 않게). */
  legend: StockChartLegendValue | null;
  isUs: boolean;
}) {
  const fmtPrice = (v: number) =>
    isUs ? `$${v.toFixed(2)}` : Math.round(v).toLocaleString("ko-KR");
  const fmtVol = (v: number) =>
    v >= 1_000_000
      ? `${(v / 1_000_000).toFixed(1)}M`
      : v >= 1_000
        ? `${(v / 1_000).toFixed(0)}K`
        : `${Math.round(v)}`;

  // 한 줄 높이는 늘 예약한다 — 한 줄만큼은 미리 잡는다(글자를 키워도 줄 높이가 따라간다). 값이 채워져 줄이 더 늘면 그만큼은 밀린다.
  const cls =
    "shrink-0 flex flex-wrap gap-x-x2 py-x1 text-t3 font-normal text-fg-neutral-subtle tabular-nums";
  if (!legend)
    return (
      <div data-slot="chart-legend" data-empty="" aria-hidden className={cls}>
        <span className="invisible">&nbsp;</span>
      </div>
    );

  // 값 쌍("O 70,010")은 한 덩어리다 — 줄이 모자라면 쌍 단위로 다음 줄로 넘어가고 쌍 안에서는 끊기지 않는다.
  const pair = "whitespace-nowrap";
  const d = legend.up ? "up" : "down";
  return (
    <div data-slot="chart-legend" className={cls}>
      <span
        data-slot="chart-legend-ohlc"
        data-direction={d}
        className={`contents ${legend.up ? "text-fg-critical" : "text-fg-informative"}`}
      >
        <span className={pair}>O {fmtPrice(legend.o)}</span>
        <span className={pair}>H {fmtPrice(legend.h)}</span>
        <span className={pair}>L {fmtPrice(legend.l)}</span>
        <span className={pair}>C {fmtPrice(legend.c)}</span>
      </span>
      <span
        data-slot="chart-legend-vol"
        className={`${pair} text-fg-neutral-subtle`}
      >
        VOL {fmtVol(legend.vol)}
      </span>
    </div>
  );
}
