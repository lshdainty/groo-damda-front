// 외화 투자 자산의 원화 합계 — 서버와 같은 한 식(I-13 길 A): round(예수금 × 환율) + 보유 평가(원화).
// e0847269 의 시험 아이디어 ① ~ ⑤ 를 길 A 기대값으로 되살린다(통화는 바꾸지 않는다 — 라이브는 보유 평가 자리에만).
import { describe, expect, it } from "vitest";
import type { Asset } from "../model/types";
import {
  assetKrw,
  cashInKrw,
  halfUp,
  transferReceiveAmount,
  withLiveHolding,
} from "./asset-krw";

/** 시드: USD · 환율 1,300 · 예수금 $100 · 보유 평가 10,000,000원(서버 응답 칸 그대로) */
const usd = (over: Partial<Asset> = {}): Asset =>
  ({
    rowId: 1,
    assetName: "해외 증권계좌",
    assetType: "INVESTMENT",
    balance: 10_000_100,
    cashBalance: 100,
    holdingBalance: 10_000_000,
    balanceInKrw: 10_130_000,
    currency: "USD",
    exchangeRate: 1_300,
    isIncludedInTotal: "Y",
    ...over,
  }) as Asset;

const won = (over: Partial<Asset> = {}): Asset =>
  ({
    rowId: 2,
    assetName: "생활비 통장",
    assetType: "BANK_ACCOUNT",
    balance: 1_000_000,
    cashBalance: 1_000_000,
    holdingBalance: 0,
    balanceInKrw: 1_000_000,
    currency: "KRW",
    exchangeRate: 1,
    isIncludedInTotal: "Y",
    ...over,
  }) as Asset;

describe("① 외화 투자 1건 — 줄 금액은 서버 식과 같은 값", () => {
  it("서버 balanceInKrw 를 그대로 읽는다: 10,130,000 (13,000,130,000 이 아니다)", () => {
    expect(assetKrw(usd())).toBe(10_130_000);
  });

  it("라이브 보유 10,000,000원 → round(100 × 1,300) + 10,000,000 = 10,130,000, 통화는 그대로", () => {
    const live = withLiveHolding(
      usd({ holdingBalance: 9_000_000 }),
      10_000_000,
    );
    expect(assetKrw(live)).toBe(10_130_000);
    expect(live.currency).toBe("USD");
    expect(live.exchangeRate).toBe(1_300);
    expect(live.holdingBalance).toBe(10_000_000);
    expect(live.cashBalance).toBe(100);
  });

  it("수동 보유 5,000원 → 100 × 1,300 + 5,000 = 135,000", () => {
    const manual = usd({
      balance: 5_100,
      holdingBalance: 5_000,
      balanceInKrw: 135_000,
    });
    expect(assetKrw(manual)).toBe(135_000);
  });

  it("옛 서버(balanceInKrw 없음)만 balance × 환율로 폴백", () => {
    const old = usd({
      balanceInKrw: undefined,
      balance: 100,
      holdingBalance: 0,
    });
    expect(assetKrw(old)).toBe(130_000);
  });
});

describe("② 외화 투자 + 원화 계좌 — 묶음 합계 경로", () => {
  it("두 값의 합: 10,130,000 + 1,000,000", () => {
    const list = [withLiveHolding(usd(), 10_000_000), won()];
    const total = list
      .filter((a) => a.isIncludedInTotal === "Y")
      .reduce((s, a) => s + assetKrw(a), 0);
    expect(total).toBe(11_130_000);
  });

  it("원화 자산은 라이브를 얹어도 예수금 + 라이브 그대로", () => {
    const krwInvest = won({
      assetType: "INVESTMENT",
      cashBalance: 50_000,
      holdingBalance: 900_000,
      balance: 950_000,
      balanceInKrw: 950_000,
    });
    const live = withLiveHolding(krwInvest, 1_000_000);
    expect(assetKrw(live)).toBe(1_050_000);
    expect(live.currency).toBe("KRW");
  });
});

describe("③ 순자산 보정 — 라이브 − DB 보유분이 같은 단위(원화)로 빠진다", () => {
  it("보유 평가는 외화 자산에서도 원화라 환율을 곱하지 않는다", () => {
    const db = usd({ holdingBalance: 9_900_000 });
    const liveKrw = 10_000_000;
    // 서버 순자산 기여 = round(100 × 1,300) + 9,900,000 = 10,030,000 → 보정 뒤 10,130,000 = 줄 금액
    const serverPart = cashInKrw(db) + db.holdingBalance;
    expect(serverPart + (liveKrw - db.holdingBalance)).toBe(
      assetKrw(withLiveHolding(db, liveKrw)),
    );
  });
});

describe("④ 환율 없는 외화 자산", () => {
  it("환율이 1 · 없음이면 환산 없이 그대로(서버 normalizeRate 와 같다)", () => {
    expect(cashInKrw(usd({ exchangeRate: 1 }))).toBe(100);
    expect(cashInKrw(usd({ exchangeRate: 0 }))).toBe(100);
    const live = withLiveHolding(usd({ exchangeRate: 1 }), 500_000);
    expect(assetKrw(live)).toBe(500_100);
  });
});

describe("⑤ 예수금 0 이면 평가금액만", () => {
  it("라이브 2,000,000 → 2,000,000", () => {
    expect(assetKrw(withLiveHolding(usd({ cashBalance: 0 }), 2_000_000))).toBe(
      2_000_000,
    );
  });
  it("음수 예수금도 부호를 살려 HALF_UP", () => {
    expect(cashInKrw(usd({ cashBalance: -900 }))).toBe(-1_170_000);
    expect(halfUp(-1.5)).toBe(-2);
    expect(halfUp(0.5)).toBe(1);
  });
});

describe("이체 받는 금액 — 서버 resolveToAmount 와 같은 식(HALF_UP, 마지막 한 번)", () => {
  const krwAcc = { currency: "KRW", exchangeRate: 1 };
  const usdAcc = { currency: "USD", exchangeRate: 1_300 };
  const eurAcc = { currency: "EUR", exchangeRate: 1_450 };
  it("원 → USD: 1,300,000원 → $1,000", () => {
    expect(transferReceiveAmount(1_300_000, krwAcc, usdAcc)).toBe(1_000);
  });
  it("USD → 원: $1,000 → 1,300,000원", () => {
    expect(transferReceiveAmount(1_000, usdAcc, krwAcc)).toBe(1_300_000);
  });
  it("USD → EUR: $1,000 → €897 (896.55)", () => {
    expect(transferReceiveAmount(1_000, usdAcc, eurAcc)).toBe(897);
  });
  it("같은 통화(USD 1,300 → USD 1,310)는 null — 보낸 만큼 받는다", () => {
    expect(
      transferReceiveAmount(1_000, usdAcc, {
        currency: "USD",
        exchangeRate: 1_310,
      }),
    ).toBeNull();
    expect(transferReceiveAmount(50_000, krwAcc, krwAcc)).toBeNull();
  });
  it("어느 계좌를 모르면 null", () => {
    expect(transferReceiveAmount(1_000, usdAcc, undefined)).toBeNull();
  });
});
