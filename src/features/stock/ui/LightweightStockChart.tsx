/**
 * 증권 상세 캔들 차트 — TradingView Lightweight Charts(Apache-2.0) 기반.
 * 캔들스틱 + 거래량 + 이동평균(MA5/MA20) + 크로스헤어 레전드, 줌/팬 내장.
 * 데이터는 viewport 커서 lazy-load: 초기 1페이지(≤200)만 받고, 과거로 팬해 좌측 끝
 * (logicalRange.from)이 임계치 아래로 떨어지면 백엔드 nextCursor 로 다음 과거 페이지를 당겨
 * prepend 한다. (백엔드 candle = groo-core CursorResponse 단일 페이지)
 *
 * 데이터는 **그 탭의 증권사 경로**(`broker` — `/v1/toss/candles` · `/v1/namu/candles`)에서 온다.
 * `broker` 가 없으면 증권사 무관 경로(`/v1/securities/candles` — 사용자의 기본 소스)다.
 * 커서의 뜻은 증권사가 정하므로(토스=불투명 문자열, 나무=날짜) 여기서는 받은 값을 그대로 되돌려 주기만 한다.
 */
import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type UTCTimestamp,
  type LogicalRange,
  type MouseEventParams,
  type Time,
} from "lightweight-charts";
import { useTheme } from "@/shared/ui/theme-context";
import {
  StockChartLegend,
  type StockChartLegendValue,
} from "./StockChartLegend";
import {
  securitiesApi,
  type BrokerCandle,
  type BrokerCandlePage,
  type CandleBroker,
} from "@/features/stock/api/securitiesApi";

/**
 * 캔들 페이지를 가져오는 함수. 기본은 `securitiesApi.getCandles`(= 증권사 무관 경로),
 * 임베드 컨텍스트는 Bearer 토큰 client 주입.
 */
export type CandleFetcher = (
  symbol: string,
  interval: "1m" | "1d",
  opts: { count: number; before?: string },
) => Promise<BrokerCandlePage>;

type Range = "1D" | "1주" | "1개월" | "3개월" | "1년";

/** 기간 탭 → interval + 초기 표시 봉 수. 1D=분봉(1m), 그 외=일봉(1d). */
const RANGE_CFG: Record<Range, { interval: "1m" | "1d"; show: number }> = {
  "1D": { interval: "1m", show: 200 },
  "1주": { interval: "1d", show: 5 },
  "1개월": { interval: "1d", show: 22 },
  "3개월": { interval: "1d", show: 66 },
  "1년": { interval: "1d", show: 252 },
};

/** 백엔드 candle 한 페이지 크기(토스 상한). lazy-load 1회 요청량. */
const PAGE = 200;
/** 좌측 끝에 남은 봉이 이 수 미만이면 과거 페이지를 추가 로드. */
const LOAD_THRESHOLD = 12;

interface Bar {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Palette {
  up: string;
  down: string;
  ma5: string;
  ma20: string;
  grid: string;
  text: string;
}

function cssVar(name: string): string {
  if (typeof window === "undefined") return "";
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v;
}

function toBar(c: BrokerCandle): Bar | null {
  const t = Date.parse(c.timestamp);
  const open = Number.parseFloat(c.openPrice);
  const high = Number.parseFloat(c.highPrice);
  const low = Number.parseFloat(c.lowPrice);
  const close = Number.parseFloat(c.closePrice);
  const volume = Number.parseFloat(c.volume);
  if (!Number.isFinite(t) || !Number.isFinite(close)) return null;
  return {
    time: Math.floor(t / 1000) as UTCTimestamp,
    open,
    high,
    low,
    close,
    volume: Number.isFinite(volume) ? volume : 0,
  };
}

/** time 오름차순 + 중복(같은 timestamp) 제거 — Lightweight Charts setData 요구사항. */
function sortDedup(bars: Bar[]): Bar[] {
  const map = new Map<number, Bar>();
  for (const b of bars) map.set(b.time as number, b);
  return [...map.values()].sort(
    (a, b) => (a.time as number) - (b.time as number),
  );
}

/** 단순이동평균(SMA) — period 미만 구간은 생략. */
function sma(bars: Bar[], period: number): LineData<UTCTimestamp>[] {
  const out: LineData<UTCTimestamp>[] = [];
  let sum = 0;
  for (let i = 0; i < bars.length; i++) {
    sum += bars[i]!.close;
    if (i >= period) sum -= bars[i - period]!.close;
    if (i >= period - 1) out.push({ time: bars[i]!.time, value: sum / period });
  }
  return out;
}

const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

/** UTCTimestamp(초) → 로컬(기기 타임존, KR 사용자는 KST) Date. Lightweight Charts 는 기본 UTC 표시라 직접 변환. */
function localDate(time: unknown): Date {
  const sec = typeof time === "number" ? time : Number(time);
  return new Date(sec * 1000);
}

/** 축 틱 라벨 — 1m=시:분, 1d=월.일 (로컬 타임존). */
function fmtTick(time: unknown, interval: "1m" | "1d"): string {
  const d = localDate(time);
  return interval === "1m"
    ? `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
    : `${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`;
}

/** 크로스헤어 시간 라벨 — 1m=YYYY.MM.DD HH:MM, 1d=YYYY.MM.DD (로컬 타임존). */
function fmtCrosshairTime(time: unknown, interval: "1m" | "1d"): string {
  const d = localDate(time);
  const date = `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`;
  return interval === "1m"
    ? `${date} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
    : date;
}

export function LightweightStockChart({
  symbol,
  isUs,
  range,
  height,
  broker,
  fetcher = (symbol, interval, opts) =>
    securitiesApi.getCandles(symbol, interval, { ...opts, broker }),
}: {
  symbol: string;
  isUs: boolean;
  range: Range;
  /** 차트 높이 — number(px) 또는 '100%'(부모 크기 따라감, embed 풀블리드용). */
  height: number | "100%";
  /** 그 탭의 증권사 — 기본 fetcher 가 이 증권사 경로로 부른다(없으면 기본 증권사) */
  broker?: CandleBroker;
  /**
   * 캔들 페치 함수. 기본=securitiesApi(쿠키), 임베드 컨텍스트에선 Bearer 토큰 client 주입.
   * 인증 컨텍스트를 담는 fetcher 는 useMemo 로 안정화할 것 — effect deps 는 [symbol, interval] 이라
   * identity 변경만으로는 재로드/무효화가 트리거되지 않는다(폴링 틱은 ref 로 최신 fetcher 사용).
   */
  fetcher?: CandleFetcher;
}) {
  const { resolvedTheme } = useTheme();
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ma5Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ma20Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const barsRef = useRef<Bar[]>([]);
  const palRef = useRef<Palette | null>(null);
  const cursorRef = useRef<string | null>(null); // 다음 과거 페이지 커서(증권사가 뜻을 정한다)
  const loadingRef = useRef(false);
  const noMoreRef = useRef(false);
  const reqIdRef = useRef(0); // symbol/interval 변경 시 진행 중 비동기 무효화
  const loadOlderRef = useRef<() => void>(() => {});
  const realtimeRef = useRef(false); // 실시간 폴링 in-flight 가드
  const pollLatestRef = useRef<() => void>(() => {});
  const intervalRef = useRef<"1m" | "1d">("1d"); // 시간 포맷터(마운트시 등록)가 최신 interval 참조용
  const [version, setVersion] = useState(0); // 초기 로드 완료 신호(가시범위 재설정 트리거)
  const [legend, setLegend] = useState<StockChartLegendValue | null>(null);

  const interval = RANGE_CFG[range].interval;
  intervalRef.current = interval;

  function readPalette(): Palette {
    return {
      up: cssVar("--color-fg-critical"), // 상승=빨강(국내 관례)
      down: cssVar("--color-fg-informative"), // 하락=파랑
      ma5: cssVar("--color-fg-warning"),
      ma20: cssVar("--color-fg-neutral-subtle"),
      grid: cssVar("--color-stroke-neutral-subtle"),
      text: cssVar("--color-fg-neutral-subtle"),
    };
  }

  /** barsRef → 4개 시리즈(캔들/거래량/MA5/MA20)에 반영. 레전드는 건드리지 않음(실시간 폴링용). */
  function applySeries() {
    const bars = barsRef.current;
    const pal = palRef.current;
    if (!pal) return;
    candleRef.current?.setData(
      bars.map((b) => ({
        time: b.time,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      })),
    );
    volRef.current?.setData(
      bars.map((b) => ({
        time: b.time,
        value: b.volume,
        color: b.close >= b.open ? pal.up : pal.down,
      })),
    );
    ma5Ref.current?.setData(sma(bars, 5));
    ma20Ref.current?.setData(sma(bars, 20));
  }

  /** 시리즈 반영 + 최신 봉 레전드 표시(초기/기간변경/과거로드 시). */
  function applyData() {
    applySeries();
    showLatestLegend();
  }

  function showLatestLegend() {
    const arr = barsRef.current;
    const b = arr.length > 0 ? arr[arr.length - 1] : undefined;
    setLegend(
      b
        ? {
            o: b.open,
            h: b.high,
            l: b.low,
            c: b.close,
            vol: b.volume,
            up: b.close >= b.open,
          }
        : null,
    );
  }

  function applyTheme() {
    const chart = chartRef.current;
    if (!chart || !candleRef.current) return;
    const pal = readPalette();
    palRef.current = pal;
    chart.applyOptions({
      layout: { textColor: pal.text },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: pal.grid, style: LineStyle.Dotted },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.08, bottom: 0.26 },
      },
      timeScale: { borderColor: pal.grid },
      crosshair: {
        vertLine: { color: pal.text },
        horzLine: { color: pal.text },
      },
    });
    candleRef.current.applyOptions({
      upColor: pal.up,
      downColor: pal.down,
      borderUpColor: pal.up,
      borderDownColor: pal.down,
      wickUpColor: pal.up,
      wickDownColor: pal.down,
      priceFormat: {
        type: "price",
        precision: isUs ? 2 : 0,
        minMove: isUs ? 0.01 : 1,
      },
    });
    ma5Ref.current?.applyOptions({ color: pal.ma5 });
    ma20Ref.current?.applyOptions({ color: pal.ma20 });
    applyData(); // 거래량 봉 색(팔레트 의존) 재적용 — 다크 전환 대응
  }

  // 차트 생성 (마운트 1회) + 시리즈/스케일/크로스헤어/lazy-load 콜백 등록
  useEffect(() => {
    if (!wrapRef.current) return;
    const chart = createChart(wrapRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        attributionLogo: true,
      },
      crosshair: { mode: CrosshairMode.Normal },
      handleScale: true,
      handleScroll: true,
      // Lightweight Charts 는 UTCTimestamp 를 기본 UTC 로 표시 → 로컬 타임존(KR=KST)으로 포맷.
      // (intervalRef 로 1m=시:분 / 1d=월.일 분기)
      localization: {
        locale: "ko-KR",
        timeFormatter: (time: Time) =>
          fmtCrosshairTime(time, intervalRef.current),
      },
      timeScale: {
        tickMarkFormatter: (time: Time) => fmtTick(time, intervalRef.current),
      },
    });
    chartRef.current = chart;
    candleRef.current = chart.addSeries(CandlestickSeries, {});
    ma5Ref.current = chart.addSeries(LineSeries, {
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ma20Ref.current = chart.addSeries(LineSeries, {
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    volRef.current = chart.addSeries(HistogramSeries, {
      priceScaleId: "vol",
      priceFormat: { type: "volume" },
      priceLineVisible: false,
      lastValueVisible: false,
    });
    chart
      .priceScale("vol")
      .applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });
    applyTheme();

    const onCrosshair = (param: MouseEventParams) => {
      if (!param.time || !candleRef.current) {
        showLatestLegend();
        return;
      }
      const cd = param.seriesData.get(candleRef.current) as
        CandlestickData<UTCTimestamp> | undefined;
      const vd = volRef.current
        ? (param.seriesData.get(volRef.current) as
            HistogramData<UTCTimestamp> | undefined)
        : undefined;
      if (!cd) {
        showLatestLegend();
        return;
      }
      setLegend({
        o: cd.open,
        h: cd.high,
        l: cd.low,
        c: cd.close,
        vol: vd?.value ?? 0,
        up: cd.close >= cd.open,
      });
    };
    chart.subscribeCrosshairMove(onCrosshair);

    const ts = chart.timeScale();
    const onRange = (lr: LogicalRange | null) => {
      if (lr && lr.from < LOAD_THRESHOLD) loadOlderRef.current();
    };
    ts.subscribeVisibleLogicalRangeChange(onRange);
    return () => {
      // in-flight loadOlder/pollLatest 를 일괄 무효화 — 언마운트 후 disposed chart 의 series 에
      // setData 시도하는 것을 reqId 가드(reqId !== reqIdRef.current)로 막는다.
      reqIdRef.current += 1;
      ts.unsubscribeVisibleLogicalRangeChange(onRange);
      chart.unsubscribeCrosshairMove(onCrosshair);
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volRef.current = null;
      ma5Ref.current = null;
      ma20Ref.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 테마/종목 변경 시 색·가격정밀도(isUs) 재적용 (canvas 라 CSS var 직접 못 씀 → 재해석)
  useEffect(() => {
    applyTheme();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTheme, isUs]);

  // 심볼/interval 변경 → 데이터 리셋 + 초기 1페이지 로드
  useEffect(() => {
    if (!symbol || !candleRef.current) return;
    const reqId = ++reqIdRef.current;
    barsRef.current = [];
    cursorRef.current = null;
    noMoreRef.current = false;
    loadingRef.current = true;
    applyData();
    chartRef.current?.applyOptions({
      timeScale: { timeVisible: interval === "1m", secondsVisible: false },
    });

    fetcher(symbol, interval, { count: PAGE })
      .then((page) => {
        if (reqId !== reqIdRef.current) return;
        const arr = sortDedup(
          page.candles.map(toBar).filter((x): x is Bar => x !== null),
        );
        barsRef.current = arr;
        cursorRef.current = page.nextBefore;
        noMoreRef.current = !page.nextBefore;
        applyData();
        setVersion((v) => v + 1);
      })
      .catch(() => {
        /* 키 미등록/에러 → 빈 차트 */
      })
      .finally(() => {
        if (reqId === reqIdRef.current) loadingRef.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, interval]);

  // 과거 1페이지를 당겨 prepend. 새 봉이 0이면(전부 중복) 진행 없음 → 종료. 충전용 Promise 반환.
  const loadOlder = async (): Promise<void> => {
    if (
      loadingRef.current ||
      noMoreRef.current ||
      !cursorRef.current ||
      !candleRef.current
    )
      return;
    const reqId = reqIdRef.current;
    loadingRef.current = true;
    try {
      const page = await fetcher(symbol, interval, {
        count: PAGE,
        before: cursorRef.current,
      });
      if (reqId !== reqIdRef.current) return;
      const older = page.candles.map(toBar).filter((x): x is Bar => x !== null);
      const prevLen = barsRef.current.length;
      const merged = sortDedup([...older, ...barsRef.current]);
      if (merged.length === prevLen) {
        // 새 봉 0개(전부 중복) → 커서가 남아도 종료해 진행 없는 헛 요청 누적을 막는다.
        noMoreRef.current = true;
        return;
      }
      barsRef.current = merged;
      cursorRef.current = page.nextBefore;
      noMoreRef.current = !page.nextBefore;
      applyData(); // setData 는 가시 시간범위를 보존 → 스크롤 위치 유지
    } catch {
      /* 유지 */
    } finally {
      if (reqId === reqIdRef.current) loadingRef.current = false;
    }
  };
  // 마운트시 등록한 onRange 콜백이 최신 loadOlder 를 가리키도록 매 렌더 갱신
  loadOlderRef.current = () => {
    void loadOlder();
  };

  // 요청한 show 봉을 채울 때까지 과거 페이지를 반복 로드한 뒤 가시범위를 확정한다.
  // setData 가 가시범위를 보존해 onRange 자동 트리거가 1회로 끝나는 한계를 명시적 루프로 보완.
  const fillToShow = async (show: number): Promise<void> => {
    let guard = 0;
    while (
      barsRef.current.length < show &&
      cursorRef.current &&
      !noMoreRef.current &&
      guard < 12
    ) {
      await loadOlder();
      guard += 1;
    }
    const chart = chartRef.current;
    const len = barsRef.current.length;
    if (chart && len > 0) {
      chart
        .timeScale()
        .setVisibleLogicalRange({ from: Math.max(0, len - show), to: len - 1 });
    }
  };

  // 기간 탭 또는 초기 로드 완료 → 가시범위를 최근 show 봉으로 맞추고 부족분을 채움
  useEffect(() => {
    const chart = chartRef.current;
    const len = barsRef.current.length;
    if (!chart || len === 0) return;
    const show = RANGE_CFG[range].show;
    chart
      .timeScale()
      .setVisibleLogicalRange({ from: Math.max(0, len - show), to: len - 1 });
    void fillToShow(show);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, version]);

  // 실시간: 최신 2봉을 주기적으로 받아 마지막 봉(형성 중)을 갱신/추가. 레전드는 건드리지 않음(hover 보존).
  const pollLatest = async (): Promise<void> => {
    if (typeof document !== "undefined" && document.hidden) return;
    if (
      loadingRef.current ||
      realtimeRef.current ||
      barsRef.current.length === 0 ||
      !candleRef.current
    )
      return;
    realtimeRef.current = true;
    const reqId = reqIdRef.current;
    try {
      const page = await fetcher(symbol, interval, { count: 2 });
      if (reqId !== reqIdRef.current) return;
      const fresh = page.candles.map(toBar).filter((x): x is Bar => x !== null);
      if (fresh.length === 0) return;
      // prev 는 await 이후 다시 읽는다 — 폴링 대기 중 loadOlder 가 prepend 한 과거 봉을 덮지 않도록(lost-update 방지).
      const prev = barsRef.current;
      const merged = sortDedup([...prev, ...fresh]);
      const a = prev[prev.length - 1];
      const b = merged[merged.length - 1];
      // 변화 없으면 setData skip(불필요 렌더 방지)
      const changed =
        merged.length !== prev.length ||
        (!!a &&
          !!b &&
          (a.open !== b.open ||
            a.close !== b.close ||
            a.high !== b.high ||
            a.low !== b.low ||
            a.volume !== b.volume));
      if (!changed) return;
      barsRef.current = merged;
      applySeries();
    } catch {
      /* 무시 */
    } finally {
      realtimeRef.current = false;
    }
  };
  pollLatestRef.current = () => {
    void pollLatest();
  };

  // 실시간 폴링 주기 — 분봉(1D)은 15s, 일봉은 60s. 탭/심볼 변경 시 재설정.
  useEffect(() => {
    if (!symbol) return;
    const ms = interval === "1m" ? 15_000 : 60_000;
    const id = setInterval(() => pollLatestRef.current(), ms);
    return () => clearInterval(id);
  }, [symbol, interval]);

  const fixed = typeof height === "number";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        // 숫자면 height 는 차트 그림의 높이다 — 범례 줄이 그만큼 위에 더해진다(글자를 키운 사람에게
        // 차트를 빼앗지 않는다). "100%"(앱 임베드)는 틀이 정해 준 높이를 범례와 나눠 쓴다.
        height: fixed ? undefined : height,
      }}
    >
      {/* 범례는 그림 위 자기 줄이다 — 축 눈금 · 캔들과 겹치지 않는다. */}
      <StockChartLegend legend={legend} isUs={isUs} />
      <div
        ref={wrapRef}
        style={{
          position: "relative",
          ...(fixed
            ? { height, flex: "none" }
            : { flex: "1 1 0", minHeight: 0 }),
        }}
      />
    </div>
  );
}
