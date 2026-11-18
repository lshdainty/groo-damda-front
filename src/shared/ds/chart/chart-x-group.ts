/**
 * 같은 화면 · 같은 기간 차트의 가로 눈금 묶음(chart.md "큰 글자" — "같은 화면 · 같은 기간 차트는 같은 날짜 글", groo-design #247 · #248).
 *
 * 한 화면에 같은 기간 · 같은 눈금 단위(날 · 달)의 차트가 둘 이상이면 보이는 것 모두를 한 묶음으로, 그리는 자리가 **가장 좁은** 차트로
 * 건너뛰기를 한 번 세고 모두 그 날짜 글을 쓴다. 눈금 단위가 다르면(날별과 월별) 묶지 않는다.
 *
 * 셈 — 차트마다 자기 그리는 자리로 건너뛰기 간격을 세어 묶음에 알리고, 묶음의 **가장 큰 간격**을 모두 쓴다. 칸 수 · 글 폭이 같으면
 * 가장 큰 간격 = 가장 좁은 차트의 간격이다(앱 p_chart_cartesian 의 짝(peers) — 짝의 간격까지 재 가장 큰 것을 쓴다 — 과 같은 값).
 *
 * 쓰는 법 — 화면(모델)이 묶음 하나를 만들어(`createChartXGroup`) 같은 기간 차트마다 `<Chart xGroup={group}>` 로 준다. 가장 큰 간격이
 * 바뀌면 묶음이 차트들을 다시 그리게 한다(그리는 도중이 아니라 그 뒤에). 차트가 사라지면 그 간격을 거둔다 — 남은 차트끼리 다시 센다.
 */
export interface ChartXGroup {
  /** 차트 하나가 자기 그리는 자리로 센 건너뛰기 간격을 알린다 — 바뀐 때만 센다 */
  report(key: string, interval: number): void;
  /** 차트가 사라졌다 — 그 간격을 거둔다 */
  remove(key: string): void;
  /** 알린 간격 가운데 가장 큰 것(아무도 안 알렸으면 undefined) */
  interval(): number | undefined;
  /** 가장 큰 간격이 바뀌면 부른다(그리는 도중이 아니라 그 뒤에) */
  subscribe(listener: () => void): () => void;
  /** 가장 큰 간격이 바뀔 때마다 오르는 판 — 다시 그릴지 견주는 값 */
  version(): number;
}

export function createChartXGroup(): ChartXGroup {
  const intervals = new Map<string, number>();
  const listeners = new Set<() => void>();
  let version = 0;
  let last: number | undefined;
  let queued = false;
  const interval = () =>
    intervals.size ? Math.max(...intervals.values()) : undefined;
  const changed = () => {
    const next = interval();
    if (next === last) return;
    last = next;
    version += 1;
    // 차트가 눈금을 그리는 도중에 알리므로 다른 차트의 다시 그리기는 그 뒤로 미룬다
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      listeners.forEach((l) => l());
    });
  };
  return {
    report(key, value) {
      if (!(value >= 1) || intervals.get(key) === value) return;
      intervals.set(key, value);
      changed();
    },
    remove(key) {
      if (intervals.delete(key)) changed();
    },
    interval,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    version: () => version,
  };
}
