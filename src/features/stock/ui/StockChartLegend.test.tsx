// 차트 범례 — R10(t3 · 400 · fg-neutral-subtle, 숫자 고정폭), 오름 fg-critical · 내림 fg-informative(캔들과 같은 방향 색),
// 거래량은 fg-neutral-subtle(I-05 30). 옛 fontSize 10.5 · fontWeight 600 · 옛 변수가 남지 않는다.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StockChartLegend } from "./StockChartLegend";

const legend = (up: boolean) => ({
  o: 123456,
  h: 234567,
  l: 345678,
  c: 456789,
  vol: 9876543,
  up,
});

describe("StockChartLegend(30)", () => {
  it("글은 t3 · 400 · fg-neutral-subtle · 고정폭 숫자, 위아래 여백은 눈금(x1)이고 좌우 여백은 없으며 차트 위 자기 줄이다", () => {
    const html = renderToStaticMarkup(
      <StockChartLegend legend={legend(true)} isUs={false} />,
    );
    for (const c of [
      "text-t3",
      "font-normal",
      "text-fg-neutral-subtle",
      "tabular-nums",
      "py-x1",
      "flex-wrap",
    ])
      expect(html).toContain(c);
    // 차트 위에 겹치지 않는다 — 자기 줄(절대 위치 · 포인터 막기 없음)
    expect(html).not.toMatch(/absolute|top-x1 |left-x1_5|z-\[2\]/);
    expect(html).not.toMatch(/font-weight|font-size|--fg-|--status-/);
    expect(html).not.toContain("font-semibold");
  });

  it("오름 = fg-critical, 내림 = fg-informative(캔들과 같은 방향 색)", () => {
    const up = renderToStaticMarkup(
      <StockChartLegend legend={legend(true)} isUs={false} />,
    );
    const down = renderToStaticMarkup(
      <StockChartLegend legend={legend(false)} isUs={false} />,
    );
    expect(up).toMatch(/data-direction="up" class="[^"]*text-fg-critical/);
    expect(down).toMatch(
      /data-direction="down" class="[^"]*text-fg-informative/,
    );
  });

  it("VOL 은 fg-neutral-subtle 이고 값은 줄여 쓴다 · 가격은 원까지(미국은 $ 두 자리)", () => {
    const kr = renderToStaticMarkup(
      <StockChartLegend legend={legend(true)} isUs={false} />,
    );
    expect(kr).toContain("VOL 9.9M");
    expect(kr).toMatch(
      /data-slot="chart-legend-vol" class="[^"]*text-fg-neutral-subtle/,
    );
    expect(kr).toContain("123,456");
    const us = renderToStaticMarkup(
      <StockChartLegend legend={legend(true)} isUs />,
    );
    expect(us).toContain("$123456.00");
  });

  it("값 쌍(O · H · L · C · VOL)은 한 덩어리라 쌍 안에서 줄이 바뀌지 않는다", () => {
    const html = renderToStaticMarkup(
      <StockChartLegend legend={legend(true)} isUs={false} />,
    );
    expect(html.match(/whitespace-nowrap/g)?.length).toBe(5);
    // 다섯 쌍이 같은 줄 흐름에 든다(바깥 묶음이 contents) — VOL 이 혼자 줄을 차지하지 않는다
    expect(html).toMatch(/data-slot="chart-legend-ohlc"[^>]*class="contents /);
    expect(html).not.toMatch(/px-/);
    expect(html).toContain(">O 123,456<");
    expect(html).toContain(">VOL 9.9M<");
  });

  it("범례가 비어도 한 줄 높이를 예약한다(한 줄만큼은 미리 잡는다)", () => {
    const html = renderToStaticMarkup(
      <StockChartLegend legend={null} isUs={false} />,
    );
    expect(html).toContain('data-slot="chart-legend"');
    expect(html).toContain("text-t3");
    expect(html).toContain("py-x1");
    expect(html).not.toContain("px-x1_5");
    expect(html).toContain("\u00a0");
    expect(html).not.toContain("O ");
  });
});
