/*
 * 고정 / 변동 나누기 — 통계 화면이 같은 규칙으로 세 숫자(전체 · 고정 · 변동)를 낸다.
 *
 * 서버가 내리는 건 **전체**와 그 가운데 **고정인 몫**이다. 변동은 서버가 따로 세지 않고
 * `전체 − 고정` 으로 구한다 — 두 값을 따로 세면 환불·미래분 규칙이 갈릴 수 있어서, 한 목록에서
 * 둘을 함께 내고 나머지를 뺀다(백엔드 `ExpenseAggregates` 가 같은 이유로 그렇게 한다).
 *
 * 옛 서버는 고정 몫을 안 보낸다(`undefined`) — 그때는 전부 변동으로 본다. 화면이 NaN 을
 * 그리거나 "고정 0%" 대신 깨진 숫자를 보이는 것보다, 기존 화면 그대로 나오는 쪽이 안전하다.
 */

import { formatPercent } from "@/shared/lib/groo/format";

/** 화면에 내는 보기 — 전체 · 고정 제외(= 변동만) · 고정만. */
export type FixedView = "all" | "variable" | "fixed";

export interface FixedSplit {
  /** 전체 */
  total: number;
  /** 고정인 몫 (0 이상, 전체를 넘지 않는다) */
  fixed: number;
  /** 변동 = 전체 − 고정 */
  variable: number;
  /** 전체 중 고정 비율, 0~100 **반올림 안 한 값**(보이는 자리수는 화면이 `formatPercent(…, "share")` 로 정한다). 전체가 0 이면 0. */
  fixedPercent: number;
}

/**
 * 전체와 고정 몫을 받아 세 숫자와 비율을 만든다.
 *
 * 고정이 전체를 넘거나 음수로 들어와도 `0 ≤ 고정 ≤ 전체` 로 끌어와 변동이 음수가 되지 않게 한다 —
 * 환불·타이밍 차이로 두 값이 어긋나더라도 막대가 거꾸로 그려지면 안 된다.
 */
export function splitFixed(
  total: number | undefined | null,
  fixed: number | undefined | null,
): FixedSplit {
  const t = Math.max(0, total ?? 0);
  const f = Math.min(t, Math.max(0, fixed ?? 0));
  return {
    total: t,
    fixed: f,
    variable: t - f,
    fixedPercent: t === 0 ? 0 : (f / t) * 100,
  };
}

/** 보기에 맞는 금액 — 전체 / 변동(고정 제외) / 고정. */
export function amountFor(split: FixedSplit, view: FixedView): number {
  if (view === "fixed") return split.fixed;
  if (view === "variable") return split.variable;
  return split.total;
}

/**
 * 고정 · 변동 비중 글 — 앱(`ds/b3-b-app`)과 같은 값을 낸다.
 * 고정은 소수 첫째 자리로 반올림하고 변동은 `100 − 반올림한 고정` 이라 합이 늘 100.0 이다.
 * 한쪽이 0 초과 0.05 미만이면 그쪽은 반올림하지 않고 "0.1% 미만"(비중 규칙). 전체가 0 이면 0.0 / 0.0.
 */
export function fixedShareTexts(split: FixedSplit): {
  fixed: string;
  variable: string;
} {
  const { fixedPercent } = split;
  if (split.total === 0)
    return {
      fixed: formatPercent(0, "share"),
      variable: formatPercent(0, "share"),
    };
  const small = (v: number) => v > 0 && v < 0.05;
  const fixedRounded = Math.round(fixedPercent * 10) / 10;
  const variableRaw = 100 - fixedPercent;
  const variableRounded = Math.round((100 - fixedRounded) * 10) / 10;
  return {
    fixed: formatPercent(
      small(fixedPercent) ? fixedPercent : fixedRounded,
      "share",
    ),
    variable: formatPercent(
      small(variableRaw) ? variableRaw : variableRounded,
      "share",
    ),
  };
}
