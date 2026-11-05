import { MINUS, isEn } from "@/shared/lib/groo/format";

/**
 * 지원 통화 — 외화통장·해외 결제에서 쓴다.
 *
 * 통화명은 i18n 이 아니라 여기 두지 않는다. ISO 코드(USD)와 기호($)는 로케일과 무관한
 * 국제 표기라 번역 대상이 아니고, 화면에는 `$ USD` 처럼 코드로 보여 준다.
 * (브랜드 고유명과 같은 취급 — taxonomy 예외)
 */
export interface CurrencyOption {
  code: string;
  symbol: string;
}

export const DEFAULT_CURRENCY = "KRW";

export const CURRENCIES: CurrencyOption[] = [
  { code: "KRW", symbol: "₩" },
  { code: "USD", symbol: "$" },
  { code: "JPY", symbol: "¥" },
  { code: "EUR", symbol: "€" },
  { code: "CNY", symbol: "¥" },
  { code: "GBP", symbol: "£" },
  { code: "AUD", symbol: "A$" },
  { code: "CAD", symbol: "C$" },
  { code: "HKD", symbol: "HK$" },
  { code: "SGD", symbol: "S$" },
  { code: "THB", symbol: "฿" },
  { code: "VND", symbol: "₫" },
  { code: "TWD", symbol: "NT$" },
  { code: "CHF", symbol: "CHF" },
];

const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

export const currencySymbol = (code: string | null | undefined): string =>
  BY_CODE.get(code ?? "")?.symbol ?? code ?? "";

export const isForeignCurrency = (code: string | null | undefined): boolean =>
  !!code && code !== DEFAULT_CURRENCY;

/**
 * 라벨 괄호 안에 붙는 통화 단위 — `잔액 (원)` · `잔액 ($)` 의 그 자리.
 *
 * 잔액·한도 라벨이 `(원)` 으로 박혀 있어 USD 를 골라도 원화처럼 보였다(QA 12차).
 * 단위는 **고른 통화**를 따라야 한다.
 *
 * 기호는 새로 세지 않고 위 `CURRENCIES` 한 벌을 그대로 쓴다 — 두 벌이 되면 통화를
 * 하나 늘릴 때 한쪽만 늘어나고, 그 어긋남은 화면에서만 보인다.
 *
 * **원화만 로케일을 탄다.** 한국어 화면은 `₩` 를 안 쓰고 `원` 을 접미로 붙이고
 * (`money()` · `<WonUnit/>` 가 이미 그 규칙이다), 영어 화면은 `₩10,000` 처럼 앞에
 * 붙인다. 그래서 여기서도 ko `원` / en `₩` 로 갈린다 — `잔액 (₩)` 도 `Balance (원)`
 * 도 그 화면에서는 남의 글자다. 나머지 통화는 로케일과 무관한 국제 표기라 기호 그대로다.
 *
 * 통화를 모르면(`null`) 원화로 본다 — 안 적힌 자산은 원화라는 게 `DEFAULT_CURRENCY` 다.
 *
 * **앱도 같은 규칙을 쓴다.** 라벨이 갈리면 같은 자산을 웹과 앱에서 다른 단위로 읽는다.
 */
export const currencyUnit = (code: string | null | undefined): string =>
  !code || code === DEFAULT_CURRENCY
    ? isEn()
      ? "₩"
      : "원"
    : currencySymbol(code);

/**
 * 원 통화 금액 표기 — `$5.50` / `¥1,280`.
 *
 * 소수 자리는 통화별로 다르다(엔·원·동은 0, 그 밖은 2) — 정해진 자리는 **늘 보인다**($1,000.00 · $1,000.50,
 * 사용자 결정 2026-10-25 — "소수가 0 이면 빼기" 는 거절). 앱 `formatOriginalAmount`(core/format/currency.dart)와 같은 규칙이다.
 * 기호는 우리가 붙이므로 표기는 숫자만 뽑는다.
 */
export const formatOriginalAmount = (
  amount: number,
  code: string,
  locale: string,
): string => {
  const digits = code === "JPY" || code === "KRW" || code === "VND" ? 0 : 2;
  // 음수는 부호를 통화 기호 앞에 — `−$5.50`(en money() 와 같은 규칙, 빼기는 U+2212).
  const body = Math.abs(amount).toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${amount < 0 ? MINUS : ""}${currencySymbol(code)}${body}`;
};

/**
 * 자산 잔액의 원화 환산 — 클라이언트 합산은 이 함수를 거친다.
 *
 * 서버가 원화 합계 칸(`balanceInKrw` = round(예수금 × 환율) + 보유 평가(원화))을 주면 그 값을 그대로 쓴다(I-13 길 A).
 * 투자 자산의 보유 평가는 원화라 balance 전체에 환율을 곱하면 보유분이 두 번 환산된다. 칸이 없는 옛 서버일 때만
 * 옛 식(balance × 환율)으로 폴백한다.
 */
export const assetBalanceInKrw = (asset: {
  balance: number;
  balanceInKrw?: number | null;
  currency?: string | null;
  exchangeRate?: number | null;
}): number => {
  if (asset.balanceInKrw != null) return asset.balanceInKrw;
  const rate = asset.exchangeRate;
  if (!isForeignCurrency(asset.currency) || rate == null || rate <= 0)
    return asset.balance;
  return Math.round(asset.balance * rate);
};
