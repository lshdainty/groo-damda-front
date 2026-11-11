import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { i18n } from "@/shared/i18n/config";
import * as format from "./format";
import {
  KRW,
  MINUS,
  formatChangeRate,
  formatChartAxis,
  formatPercent,
  minusOf,
  money,
  plusOf,
  wonPrefix,
} from "./format";
import { niceAxis, niceCeil } from "./chartAxis";

describe("MINUS / minusOf", () => {
  it("부호는 U+2212 — 하이픈이 아니다", () => {
    expect(MINUS).toBe("−");
    expect(MINUS).not.toBe("-");
  });

  it("0 이면 부호가 없다 — 빈 계정의 '−0원'(QA #1)", () => {
    expect(minusOf(0)).toBe("");
    expect(`${minusOf(0)}${KRW(0)}`).toBe("0");
  });

  it("양수면 −", () => {
    expect(minusOf(7560)).toBe(MINUS);
  });

  it("음수면 + — 선결제로 총 부채가 음수가 되면 '−-356,800' 이 됐다(QA #21)", () => {
    expect(minusOf(-356800)).toBe("+");
    expect(`${minusOf(-356800)}${KRW(Math.abs(-356800))}`).toBe("+356,800");
  });

  it("KRW(0) 은 '0' — -0 이 흘러들지 않는 한 부호가 안 붙는다", () => {
    expect(KRW(0)).toBe("0");
  });
});

/**
 * `minusOf` 의 거울. 반복 거래 관리가 수입 요약을 `+{KRW(v)}` 로 찍고 있어서
 * 반복 수입이 하나도 없으면 `+0` 이 남았다 — 지출 쪽 `−0`(QA #1)과 같은 결함이다.
 * 앱 `core/format/krw.dart` 와 **같은 글자를 내야 한다**(같은 화면을 둘이 그린다).
 */
describe("plusOf", () => {
  it("0 이면 부호가 없다 — 반복 수입이 없는 계정의 '+0'(QA #1)", () => {
    expect(plusOf(0)).toBe("");
    expect(`${plusOf(0)}${KRW(Math.abs(0))}`).toBe("0");
  });

  it("양수면 +", () => {
    expect(plusOf(3_200_000)).toBe("+");
    expect(`${plusOf(3_200_000)}${KRW(Math.abs(3_200_000))}`).toBe(
      "+3,200,000",
    );
  });

  it("음수면 − — 하이픈이 아니라 U+2212 이고 `+-` 로 겹치지 않는다", () => {
    expect(plusOf(-1_000)).toBe(MINUS);
    expect(`${plusOf(-1_000)}${KRW(Math.abs(-1_000))}`).toBe(`${MINUS}1,000`);
  });

  it("minusOf 와 정확히 반대다 — 0 만 둘 다 빈 문자열", () => {
    for (const v of [-1_000, 0, 1_000]) {
      if (v === 0) expect(plusOf(v)).toBe(minusOf(v));
      else expect(plusOf(v)).not.toBe(minusOf(v));
    }
  });
});

/**
 * QA #73 확정 표 — **앱과 한 글자도 갈리면 안 된다.**
 * 미러는 앱 `porest-desk-app/lib/core/format/krw.dart` 의 `formatChartAxis` 이고
 * 같은 표가 그 테스트에 들어 있다. 한 줄을 고치면 반드시 양쪽을 같이 고쳐라.
 *
 * 규칙은 전 구간 하나다 — 소수 첫째 자리까지 반올림하고 `.0` 은 뗀다.
 * 1만 미만은 단위 없이 천단위 콤마만(앱 #70 이 이걸 안 하고 있었다).
 *
 * 이 표는 이제 **축약하는 모든 자리**를 규정한다 — 차트 Y축·도넛 중앙·통계 추이 틱.
 * 추이 축만 따로 쓰던 `formatChartAmount` 를 지우고 여기로 모았다.
 */
const KO_TABLE: [number, string][] = [
  [0, "0"],
  [5_000, "5,000"],
  [9_999, "9,999"],
  [10_000, "1만"],
  [11_881, "1.2만"],
  [13_879, "1.4만"],
  [50_000, "5만"],
  [99_999, "10만"],
  [100_000, "10만"],
  [250_000, "25만"],
  [999_999, "100만"],
  [1_000_000, "100만"],
  [1_500_000, "150만"],
  [5_040_000, "504만"],
  [12_300_000, "1,230만"],
  [12_305_000, "1,230.5만"],
  [51_750_000, "5,175만"],
  [99_999_999, "1억"],
  [100_000_000, "1억"],
  [120_000_000, "1.2억"],
  [500_000_000, "5억"],
  [1_200_000_000, "12억"],
  [1_250_000_000, "12.5억"],
  [999_900_000_000, "9,999억"],
  [999_999_999_999, "1조"],
  [1_000_000_000_000, "1조"],
  [1_200_000_000_000, "1.2조"],
  [-51_750_000, `${MINUS}5,175만`],
  [-11_881, `${MINUS}1.2만`],
];

describe("formatChartAxis (ko)", () => {
  const orig = i18n.language;
  beforeEach(async () => {
    await i18n.changeLanguage("ko");
  });
  afterEach(async () => {
    await i18n.changeLanguage(orig);
  });

  it.each(KO_TABLE)("%d → %s", (input, expected) => {
    expect(formatChartAxis(input)).toBe(expected);
  });

  it("`.0` 을 남기지 않는다 — 합계 50,000 인 달의 도넛 중앙이 `5.0만` 이었다(QA #73)", () => {
    for (const [, out] of KO_TABLE) expect(out).not.toMatch(/\.0(만|억|조)$/);
    expect(formatChartAxis(50_000)).toBe("5만");
  });

  it("자리올림 — 반올림이 단위를 채우면 위 칸으로 올린다", () => {
    // 9,999.9999만 → 10,000.0만 이 아니라 1억.
    expect(formatChartAxis(99_999_999)).toBe("1억");
    // 9,999.99999억 → 10,000.0억 이 아니라 1조.
    expect(formatChartAxis(999_999_999_999)).toBe("1조");
    // 만 아래는 반올림이 없다 — 9,999 는 그대로 9,999.
    expect(formatChartAxis(9_999)).toBe("9,999");
  });

  it("구간별 예외가 없다 — 10억 위도, 1만~10만도 같은 규칙", () => {
    // 예전엔 10억 위가 정수 억이라 12.5억이 `13억` 으로 반올림됐다.
    expect(formatChartAxis(1_250_000_000)).toBe("12.5억");
    // 예전엔 1만~10만만 소수 한 자리라 10만 위가 정수 만이었다.
    expect(formatChartAxis(12_305_000)).toBe("1,230.5만");
  });

  it("음수 부호는 U+2212 — 앱 krw.dart 와 같은 문자열", () => {
    expect(formatChartAxis(-51_750_000)).toBe(`${MINUS}5,175만`);
    expect(formatChartAxis(-51_750_000).startsWith("-")).toBe(false);
  });

  /**
   * 축 눈금 겹침 가드 — 앱 `test/core/format/formatters_locale_test.dart` 이식.
   * 소수 한 자리를 넣어도 같은 라벨이 두 번 찍히거나 축 폭을 넘지 않아야 한다.
   */
  it.each([5e4, 1e6, 3e6, 5e7, 3e8, 3e9, 3e12])(
    "top=%d 축의 5눈금 라벨이 전부 다르고 8자 이하",
    (top) => {
      const labels = [0, 1, 2, 3, 4].map((i) => formatChartAxis((top * i) / 4));
      expect(new Set(labels).size).toBe(labels.length);
      for (const l of labels) expect(l.length).toBeLessThanOrEqual(8);
    },
  );
});

/**
 * 축약 자리 통일 — 통계 추이 축이 쓰던 `formatChartAmount`(만은 정수, 억은 고정 `.0`)를
 * 지우고 `formatChartAxis` 하나로 모았다. `StatsPage` 의 `fmtTick` 이 이 함수다.
 *
 * 눈금은 `chartAxis` 의 nice 값(1·2·2.5·5×10ⁿ 배수)만 들어오므로, 여기서 만드는 라벨이
 * 실제로 축에 찍히는 문자열 전부다. 축 폭은 `measureTickWidth` 가 이 글자를 재서 정한다(11px 글자).
 */
describe("통계 추이 축 눈금 (fmtTick = formatChartAxis)", () => {
  const orig = i18n.language;
  beforeEach(async () => {
    await i18n.changeLanguage("ko");
  });
  afterEach(async () => {
    await i18n.changeLanguage(orig);
  });

  it("축약 함수는 하나뿐 — formatChartAmount 는 더 없다", () => {
    // 되살아나면 한 화면에서 도넛 중앙 `5억` 옆에 추이 축 `5.0억` 이 다시 선다.
    expect(Object.keys(format)).not.toContain("formatChartAmount");
  });

  it("같은 라벨을 두 번 찍지 않는다 — 만 단위를 정수로 반올림하던 게 눈금을 뭉갰다", () => {
    // 최대 12,000원짜리 축 → 눈금 [0, 5천, 1만, 1.5만, 2만].
    // 옛 규칙은 15,000 과 20,000 을 둘 다 `2만` 으로 찍어 눈금이 겹쳤다.
    expect(niceCeil(12_000).ticks.map(formatChartAxis)).toEqual([
      "0",
      "5,000",
      "1만",
      "1.5만",
      "2만",
    ]);
  });

  it("`.0` 을 남기지 않는다 — 억대 축이 `2.0억 4.0억` 이었다", () => {
    expect(niceCeil(500_000_000).ticks.map(formatChartAxis)).toEqual([
      "0",
      "2억",
      "4억",
      "6억",
      "8억",
    ]);
  });

  it("조 단위로 올린다 — 옛 규칙은 억에 눌러 담아 `10000.0억` 을 냈다", () => {
    expect(formatChartAxis(1_000_000_000_000)).toBe("1조");
    expect(formatChartAxis(2_500_000_000_000)).toBe("2.5조");
  });

  it("순저축 축(음수 포함)도 소수를 그대로 — 옛 규칙은 25,000 을 `3만` 이라 했다", () => {
    // 눈금 간격 25,000 인 축. 옛 규칙: [−3만, 0, 3만, 5만, 8만] — 눈금값과 다른 숫자다.
    expect(niceAxis(-25_000, 60_000).ticks.map(formatChartAxis)).toEqual([
      `${MINUS}2.5만`,
      "0",
      "2.5만",
      "5만",
      "7.5만",
    ]);
  });

  /**
   * 폭 가드 — 축이 만들 수 있는 눈금을 전 구간 훑어 라벨을 검사한다.
   * `1,230.5만`(콤마 + 소수)만 52px 를 넘는데, nice 눈금은 그 자리에서 항상
   * 1만의 배수라 나올 수 없다. 그 사실을 여기서 못 박는다.
   */
  it("어떤 축을 그려도 라벨이 7자 이하 — 콤마와 소수가 같이 나오지 않는다", () => {
    const labels = new Set<string>();
    for (let exp = 3; exp <= 13; exp++) {
      for (let k = 100; k < 1000; k += 7) {
        const max = Math.round((k / 100) * 10 ** exp);
        for (const ticks of [
          niceCeil(max).ticks,
          niceAxis(0, max).ticks,
          niceAxis(-max, max).ticks,
        ]) {
          const drawn = ticks.map(formatChartAxis);
          // 한 축 안에서 같은 글자가 두 번 서면 눈금을 읽을 수 없다.
          expect(new Set(drawn).size).toBe(drawn.length);
          for (const l of drawn) labels.add(l);
        }
      }
    }
    expect(labels.size).toBeGreaterThan(100);
    for (const l of labels) {
      expect(l.length).toBeLessThanOrEqual(7);
      expect(l).not.toMatch(/,.*\./);
    }
  });
});

describe("formatChartAxis (en)", () => {
  const orig = i18n.language;
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });
  afterEach(async () => {
    await i18n.changeLanguage(orig);
  });

  it("Intl compact 숫자부 + 빼기는 U+2212 (I-31)", () => {
    expect(formatChartAxis(120000000)).toBe("120M");
    expect(formatChartAxis(52000)).toBe("52K");
    expect(formatChartAxis(-52000)).toBe("\u221252K");
    expect(formatChartAxis(-52000)).not.toContain("-");
  });
});

/**
 * 등락률 — 어디서나 소수 둘째 자리(사용자 결정 2026-10-25). 증권 · 홈 · 자산 · 통계가 이 함수 하나를 쓴다.
 */
describe("formatChangeRate", () => {
  it("소수 둘째 자리를 늘 보인다 — 0.43% · 5.00% · 8.90%", () => {
    expect(formatChangeRate(0.43)).toBe("0.43%");
    expect(formatChangeRate(5)).toBe("5.00%");
    expect(formatChangeRate(8.9)).toBe("8.90%");
    expect(formatChangeRate(12.3456)).toBe("12.35%");
  });

  it("음수는 U+2212 — 하이픈이 아니다", () => {
    expect(formatChangeRate(-12.3)).toBe(`${MINUS}12.30%`);
    expect(formatChangeRate(-12.3)).not.toContain("-");
  });

  it("sign: always 는 양수 · 0 에 + 를 붙인다, none 은 절댓값(▲ ▼ 가 방향을 말하는 자리)", () => {
    expect(formatChangeRate(2.5, { sign: "always" })).toBe("+2.50%");
    expect(formatChangeRate(0, { sign: "always" })).toBe("+0.00%");
    expect(formatChangeRate(-2.5, { sign: "always" })).toBe(`${MINUS}2.50%`);
    expect(formatChangeRate(-2.5, { sign: "none" })).toBe("2.50%");
  });

  it("반올림해서 0.00 이 되는 음수는 −0.00% 가 아니다", () => {
    expect(formatChangeRate(-0.001)).toBe("0.00%");
    expect(formatChangeRate(-0.001, { sign: "always" })).toBe("+0.00%");
  });

  it("천 단위 쉼표 · 유한하지 않은 값은 —", () => {
    expect(formatChangeRate(1234.5)).toBe("1,234.50%");
    expect(formatChangeRate(NaN)).toBe("—");
    expect(formatChangeRate(Infinity)).toBe("—");
  });
});

/** I-31 — 음수 금액의 빼기는 U+2212 하나다(스펙 chart.md "빼기는 U+2212"). */
describe("KRW / money 음수 부호 (I-31)", () => {
  const orig = i18n.language;
  afterEach(async () => {
    await i18n.changeLanguage(orig);
  });

  it("KRW 음수는 U+2212 + 절댓값, ASCII 하이픈이 없다", () => {
    expect(KRW(-1000)).toBe("\u22121,000");
    expect(KRW(-30_400_000)).toBe("\u221230,400,000");
    expect(KRW(-1000)).not.toContain("-");
    expect(KRW(1000)).toBe("1,000");
    expect(KRW(0)).toBe("0");
  });

  it("KRW 의 sign · abs 계약은 그대로 — 양수만 +, abs 는 부호를 없앤다", () => {
    expect(KRW(1000, { sign: true })).toBe("+1,000");
    expect(KRW(-1000, { sign: true })).toBe("\u22121,000");
    expect(KRW(-1000, { abs: true })).toBe("1,000");
  });

  it("money ko — 음수는 −1,000원", async () => {
    await i18n.changeLanguage("ko");
    expect(money(-1000)).toBe("\u22121,000원");
  });

  it("money en — 정규식이 U+2212 를 알아 부호가 ₩ 앞에 온다(−₩1,000)", async () => {
    await i18n.changeLanguage("en");
    expect(money(-1000)).toBe("\u2212₩1,000");
    expect(money(1000, { sign: true })).toBe("+₩1,000");
    expect(money(1000)).toBe("₩1,000");
  });
});

describe("wonPrefix — 영어 금액 접두는 값이 있는 호출처만 붙인다", () => {
  afterEach(async () => {
    await i18n.changeLanguage("ko");
  });

  it('ko 는 빈 글, en 은 ₩ — 값이 없는 "—" 에는 붙이지 않는다(호출처 몫)', async () => {
    await i18n.changeLanguage("ko");
    expect(wonPrefix()).toBe("");
    await i18n.changeLanguage("en");
    expect(`${wonPrefix()}${KRW(1234567)}`).toBe("₩1,234,567");
    const none = "—";
    expect(none).not.toContain("₩");
  });
});

describe("퍼센트 천 단위 쉼표(2026-11-11) — 소수 자리 규칙은 그대로", () => {
  const rows: Array<[string, number, string, string, string]> = [
    // [설명, 값, share, progress, change(auto)]
    ["999", 999, "999.0%", "999%", "999.00%"],
    ["1000", 1000, "1,000.0%", "1,000%", "1,000.00%"],
    ["1234.56", 1234.56, "1,234.6%", "1,235%", "1,234.56%"],
    ["12345.67", 12345.67, "12,345.7%", "12,346%", "12,345.67%"],
    ["음수 -1234.5", -1234.5, "−1,234.5%", "−1,235%", "−1,234.50%"],
    ["반올림 0 음수 -0.04", -0.04, "0.0%", "0%", "−0.04%"],
    ["등락 반올림 0 -0.004", -0.004, "0.0%", "0%", "0.00%"],
    ["999.96 (올림해 1000)", 999.96, "1,000.0%", "1,000%", "999.96%"],
  ];
  it.each(rows)("%s", (_n, v, share, progress, change) => {
    expect(formatPercent(v, "share")).toBe(share);
    expect(formatPercent(v, "progress")).toBe(progress);
    expect(formatPercent(v, "change")).toBe(change);
  });

  it("change sign — always · none · 쉼표와 부호가 함께", () => {
    expect(formatPercent(1234.56, "change", { sign: "always" })).toBe(
      "+1,234.56%",
    );
    expect(formatPercent(-1234.56, "change", { sign: "always" })).toBe(
      "−1,234.56%",
    );
    expect(formatPercent(-1234.56, "change", { sign: "none" })).toBe(
      "1,234.56%",
    );
    expect(formatChangeRate(-12345.67)).toBe("−12,345.67%");
    expect(formatChangeRate(0.004, { sign: "always" })).toBe("+0.00%");
  });

  it("경계 — 0.04 는 미만 문구(쉼표 무관), 영어도 쉼표", async () => {
    expect(formatPercent(0.04, "share")).toBe("0.1% 미만");
    await i18n.changeLanguage("en");
    try {
      expect(formatPercent(0.04, "share")).toBe("<0.1%");
      expect(formatPercent(1234, "progress")).toBe("1,234%");
      expect(formatPercent(1234.5, "share")).toBe("1,234.5%");
      expect(formatPercent(-1234.5, "change")).toBe("−1,234.50%");
    } finally {
      await i18n.changeLanguage("ko");
    }
  });
});

describe("formatPercent — 퍼센트는 뜻이 셋(B3 1A)", () => {
  it("비중 share — 늘 소수 첫째 자리, 경계 0 · 0.04 · 0.05 · 99.95 · 100", () => {
    expect(formatPercent(0, "share")).toBe("0.0%");
    expect(formatPercent(0.04, "share")).toBe("0.1% 미만");
    expect(formatPercent(0.05, "share")).toBe("0.1%");
    expect(formatPercent(99.95, "share")).toBe("100.0%");
    expect(formatPercent(100, "share")).toBe("100.0%");
    expect(formatPercent(30, "share")).toBe("30.0%");
    expect(formatPercent(33.24, "share")).toBe("33.2%");
    expect(formatPercent(Number.NaN, "share")).toBe("—");
  });

  it("영어 비중 — 아주 작은 몫은 <0.1%", async () => {
    await i18n.changeLanguage("en");
    try {
      expect(formatPercent(0.04, "share")).toBe("<0.1%");
    } finally {
      await i18n.changeLanguage("ko");
    }
  });

  it("진행률 progress — 정수", () => {
    expect(formatPercent(0, "progress")).toBe("0%");
    expect(formatPercent(0.04, "progress")).toBe("0%");
    expect(formatPercent(76.43, "progress")).toBe("76%");
    expect(formatPercent(100, "progress")).toBe("100%");
  });

  it("진행률 100 경계 — 넘나드는 상태가 글에서 사라지지 않는다", () => {
    expect(formatPercent(99.4, "progress")).toBe("99%");
    expect(formatPercent(99.6, "progress")).toBe("99%");
    expect(formatPercent(99.95, "progress")).toBe("99%");
    expect(formatPercent(100.3, "progress")).toBe("101%");
    expect(formatPercent(100.6, "progress")).toBe("101%");
    expect(formatPercent(76.4, "progress")).toBe("76%");
    expect(formatPercent(76.6, "progress")).toBe("77%");
  });

  it("유한하지 않은 값은 — , 음수는 빼기 U+2212", () => {
    for (const kind of ["share", "progress"] as const) {
      expect(formatPercent(Number.NaN, kind)).toBe("—");
      expect(formatPercent(Infinity, kind)).toBe("—");
    }
    expect(formatPercent(-12.34, "share")).toBe("−12.3%");
    expect(formatPercent(-12.4, "progress")).toBe("−12%");
    expect(formatPercent(-12.34, "share")).not.toContain("-");
    // 반올림해서 0 이 되면 부호 없이
    expect(formatPercent(-0.2, "progress")).toBe("0%");
    expect(formatPercent(-0.04, "share")).toBe("0.0%");
  });

  it("등락률 change — formatChangeRate 와 같은 글자(둘째 자리)", () => {
    expect(formatPercent(1.8, "change")).toBe(formatChangeRate(1.8));
    expect(formatPercent(-12.3, "change")).toBe("−12.30%");
    expect(formatPercent(5, "change", { sign: "always" })).toBe("+5.00%");
  });
});
