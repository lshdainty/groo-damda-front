// "지난달보다 {{amount}} 덜 쓰는 중" 문장이 차액을 만원으로 반올림하고 있었다 —
// `${KRW(Math.round(diff / 10000))}만원`. 11,881 원 차이가 `1만원` 이 되어 문장이
// 실제보다 16% 적게 말했다(QA #38). 자산 화면·도넛에선 이미 닫힌 항목인데
// 이 문장에만 남아 있었다.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { i18n } from "@/shared/i18n/config";
import { INSIGHT_SAME_MAX, insightDiffAmount } from "./insight";

const orig = i18n.language;
afterEach(async () => {
  await i18n.changeLanguage(orig);
});

describe("지난달 대비 인사이트 금액 (ko)", () => {
  // 테스트 기본 로케일은 en 이다 — 고정하지 않으면 영어 출력을 검사하게 된다.
  beforeEach(async () => {
    await i18n.changeLanguage("ko");
  });

  it("11,881 은 `1만원` · `1.2만원` 이 아니라 줄이지 않은 `11,881원`(QA #38 · #252 문장 속 돈)", () => {
    expect(insightDiffAmount(11_881)).toBe("11,881원");
    expect(insightDiffAmount(11_881)).not.toBe("1만원");
  });

  it("1만 미만은 만 단위로 뭉개지 않는다 — 천단위 콤마 그대로", () => {
    expect(insightDiffAmount(6_000)).toBe("6,000원");
    expect(insightDiffAmount(9_999)).toBe("9,999원");
  });

  it('큰 차액도 줄이지 않는다 — 문장 속 돈도 원까지(International Design "돈", #252)', () => {
    expect(insightDiffAmount(1_234_000)).toBe("1,234,000원");
    expect(insightDiffAmount(120_000_000)).toBe("120,000,000원");
  });

  it("방향은 문장이 정한다 — 금액은 늘 크기다", () => {
    expect(insightDiffAmount(-11_881)).toBe(insightDiffAmount(11_881));
    expect(insightDiffAmount(-11_881)).not.toContain("−");
  });

  it("단위가 붙는다 — 문장 안이라 숫자만 두면 읽히지 않는다", () => {
    expect(insightDiffAmount(11_881).endsWith("원")).toBe(true);
  });
});

describe("지난달 대비 인사이트 금액 (en)", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("en 은 ₩ 를 앞에 — `money()` 와 같은 자리 규칙", () => {
    expect(insightDiffAmount(11_881)).toBe("₩11,881");
    expect(insightDiffAmount(-11_881)).toBe("₩11,881");
  });
});

describe("'비슷하다' 문턱", () => {
  it("만원 반올림을 걷어내도 문턱은 5,000 원 그대로다", () => {
    expect(INSIGHT_SAME_MAX).toBe(5_000);
    // 예전 조건 `Math.abs(Math.round(diff / 10000)) < 1` 과 같은 자리에서 갈린다.
    expect(Math.abs(Math.round(4_999 / 10_000)) < 1).toBe(true);
    expect(Math.abs(Math.round(5_000 / 10_000)) < 1).toBe(false);
  });
});
