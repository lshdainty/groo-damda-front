import type { AssetType } from "@/entities/asset";

/**
 * 계좌 편집 다이얼로그의 '계좌 종류' 탭.
 *
 * 화면 개념이라 `AssetType` 과 1:1 이 아니다 — 적금·예금은 둘 다 `SAVINGS` 이고,
 * **마이너스통장은 잔액이 음수인 `BANK_ACCOUNT`** 다(QA #17: 새 타입을 만들지 않는다).
 * 그래서 타입만으로는 탭을 되돌릴 수 없고 잔액 부호를 함께 봐야 한다.
 */
export type AccountSub =
  "입출금" | "마이너스통장" | "적금" | "예금" | "현금" | "대출";

/**
 * 잔액을 **음수(빚)** 로 들고 있는 계좌 종류.
 *
 * 사용자는 어디서나 절대값을 넣고 부호는 종류가 정한다(QA #19). 신용카드가 이미
 * 그렇게 동작하고 있었고(`AssetEditDialog` 의 `cardBalance`), 대출·마이너스통장을
 * 같은 규칙에 태운다.
 */
const DEBT_SUBS = new Set<AccountSub>(["대출", "마이너스통장"]);

export function subToAssetType(sub: AccountSub): AssetType {
  switch (sub) {
    case "입출금":
      return "BANK_ACCOUNT";
    // 마이너스통장은 새 AssetType 이 아니다 — 잔액이 음수인 입출금 계좌다(QA #17).
    case "마이너스통장":
      return "BANK_ACCOUNT";
    case "적금":
      return "SAVINGS";
    case "예금":
      return "SAVINGS";
    case "현금":
      return "CASH";
    case "대출":
      return "LOAN";
  }
}

/**
 * 저장된 자산 → 계좌 종류 탭.
 *
 * 이미 음수로 저장돼 있던 입출금 계좌도 마이너스통장 탭으로 열린다 — QA 가 요구한
 * '기존 데이터 자동 표시'가 이 한 줄이다.
 */
export function assetTypeToSub(t: AssetType, balance = 0): AccountSub {
  switch (t) {
    case "BANK_ACCOUNT":
      return balance < 0 ? "마이너스통장" : "입출금";
    case "SAVINGS":
      return "적금";
    case "CASH":
      return "현금";
    case "LOAN":
      return "대출";
    default:
      return "입출금";
  }
}

/**
 * 사용자가 절대값으로 넣은 잔액에 **종류가 정한 부호**를 씌운다(QA #19).
 * 여러 번 적용해도 같다(멱등) — 화면이 저장값을 다시 읽어 넣어도 뒤집히지 않는다.
 */
export function signedBalanceOf(sub: AccountSub, amount: number): number {
  return DEBT_SUBS.has(sub) ? -Math.abs(amount) : Math.abs(amount);
}
