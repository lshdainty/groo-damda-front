import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { i18n } from "@/shared/i18n/config";
import {
  CURRENCIES,
  currencySymbol,
  currencyUnit,
  formatAssetAmount,
  formatOriginalAmount,
} from "./currency";

/**
 * 라벨 괄호 안의 통화 단위 — `잔액 (원)` · `잔액 ($)`.
 *
 * 라벨에 `(원)` 이 박혀 있어 USD 를 골라도 원화처럼 보였다(QA 12차). 여기서
 * 잠그는 건 셋이다:
 * ① 고른 통화의 기호가 나온다 ② 기호는 `CURRENCIES` 한 벌에서만 온다
 * ③ 원화만 로케일을 탄다(ko `원` / en `₩`).
 *
 * ②를 안 잠그면 매핑이 두 벌이 되어, 통화를 하나 늘릴 때 한쪽만 늘어난다.
 * **앱도 같은 규칙을 쓴다** — 갈리면 같은 자산을 두 화면이 다른 단위로 읽는다.
 */
describe("currencyUnit", () => {
  const orig = i18n.language;
  beforeEach(async () => {
    await i18n.changeLanguage("ko");
  });
  afterEach(async () => {
    await i18n.changeLanguage(orig);
  });

  it("한국어 화면의 원화는 `₩` 가 아니라 `원` 이다", () => {
    expect(currencyUnit("KRW")).toBe("원");
  });

  it("영어 화면의 원화는 `₩` — `Balance (원)` 은 남의 글자다", async () => {
    await i18n.changeLanguage("en");
    expect(currencyUnit("KRW")).toBe("₩");
  });

  it("나머지 통화는 로케일과 무관한 기호다", async () => {
    expect(currencyUnit("USD")).toBe("$");
    expect(currencyUnit("EUR")).toBe("€");
    expect(currencyUnit("JPY")).toBe("¥");
    await i18n.changeLanguage("en");
    expect(currencyUnit("USD")).toBe("$");
    expect(currencyUnit("EUR")).toBe("€");
    expect(currencyUnit("JPY")).toBe("¥");
  });

  it("기호는 `CURRENCIES` 한 벌에서만 온다 — 두 벌이 되면 한쪽만 늘어난다", () => {
    for (const c of CURRENCIES) {
      if (c.code === "KRW") continue;
      expect(currencyUnit(c.code)).toBe(currencySymbol(c.code));
    }
  });

  it("통화를 안 적어 둔 자산은 원화로 본다", () => {
    expect(currencyUnit(null)).toBe("원");
    expect(currencyUnit(undefined)).toBe("원");
    expect(currencyUnit("")).toBe("원");
  });

  it("모르는 코드는 코드 그대로 — 빈 괄호보다 낫다", () => {
    expect(currencyUnit("XPT")).toBe("XPT");
  });
});

/**
 * 문구 쪽 절반 — 단위는 라벨이 아니라 입력칸 오른쪽 단위 칸이 들고 있다(I-17 1단계).
 *
 * 그래서 라벨에 `{{unit}}` 슬롯이 남아 있으면 안 되고, 넘긴 단위가 라벨에 박히지도 않는다.
 * 컴포넌트가 단위를 칸 쪽에 넘기는지는 `AssetEditDialog.currency-label.test.tsx` 가 본다.
 * 여기서 CSV → 생성물 → i18n 까지를 한 번에 본다.
 */
describe("잔액·한도 라벨은 단위 없이 글만 둔다", () => {
  const LABELS = {
    ko: {
      "editDialog.balanceLabelAccount": "잔액",
      "editDialog.balanceLabelCard": "이전 미결제 사용액",
      "editDialog.balanceLabelInvest": "평가액",
      "editDialog.balanceLabelOverdraft": "사용 중인 금액",
      "editDialog.creditLimit": "신용한도",
      "editDialog.overdraftLimitLabel": "약정 한도",
    },
    en: {
      "editDialog.balanceLabelAccount": "Balance",
      "editDialog.balanceLabelCard": "Unpaid balance",
      "editDialog.balanceLabelInvest": "Valuation",
      "editDialog.balanceLabelOverdraft": "Amount used",
      "editDialog.creditLimit": "Credit limit",
      "editDialog.overdraftLimitLabel": "Credit line",
    },
  } as const;
  const orig = i18n.language;
  afterEach(async () => {
    await i18n.changeLanguage(orig);
  });

  for (const lang of ["ko", "en"] as const) {
    it(`${lang}: 라벨은 단위 슬롯 없이 새 글 그대로다`, async () => {
      await i18n.changeLanguage(lang);
      for (const [key, text] of Object.entries(LABELS[lang])) {
        expect(i18n.t(key, { ns: "asset", unit: "$" })).toBe(text);
      }
    });
  }
});

/**
 * 원 통화 금액 — 정해진 소수 자리는 늘 보인다(사용자 결정 2026-10-25). 앱 `formatOriginalAmount` 와 같은 규칙.
 */
describe("formatOriginalAmount", () => {
  it("소수 둘째 자리를 늘 보인다 — $1,000.00 · $1,000.50", () => {
    expect(formatOriginalAmount(1000, "USD", "ko-KR")).toBe("$1,000.00");
    expect(formatOriginalAmount(1000.5, "USD", "ko-KR")).toBe("$1,000.50");
    expect(formatOriginalAmount(5.5, "EUR", "en-US")).toBe("€5.50");
  });

  it("소수가 없는 통화는 0자리 — ¥1,280 · ₩1,000 · 동", () => {
    expect(formatOriginalAmount(1280, "JPY", "ko-KR")).toBe("¥1,280");
    expect(formatOriginalAmount(1280.4, "JPY", "ko-KR")).toBe("¥1,280");
    expect(formatOriginalAmount(1000, "KRW", "ko-KR")).toBe("₩1,000");
  });

  it("셋째 자리는 반올림한다", () => {
    expect(formatOriginalAmount(0.126, "USD", "ko-KR")).toBe("$0.13");
  });

  it("음수는 부호가 통화 기호 앞 U+2212 — −$5.50 · −¥1,280 (I-31)", () => {
    expect(formatOriginalAmount(-5.5, "USD", "ko-KR")).toBe("\u2212$5.50");
    expect(formatOriginalAmount(-1280, "JPY", "en-US")).toBe("\u2212¥1,280");
    expect(formatOriginalAmount(-5.5, "USD", "ko-KR")).not.toContain("-");
  });
});

describe("formatAssetAmount — 외화 예수금 · 잔액 · 이체는 정수 1단위(I-13)", () => {
  it("소수 없이 — $100 · $1,000 · €897", () => {
    expect(formatAssetAmount(100, "USD", "ko-KR")).toBe("$100");
    expect(formatAssetAmount(1_000, "USD", "en-US")).toBe("$1,000");
    expect(formatAssetAmount(897, "EUR", "ko-KR")).toBe("€897");
  });
  it("음수는 기호 앞 U+2212", () => {
    expect(formatAssetAmount(-900, "USD", "ko-KR")).toBe("\u2212$900");
  });
  it("시세 · 단가는 지금 규칙(formatOriginalAmount) 그대로 — 소수 둘째 자리", () => {
    expect(formatOriginalAmount(100, "USD", "en-US")).toBe("$100.00");
  });
});
