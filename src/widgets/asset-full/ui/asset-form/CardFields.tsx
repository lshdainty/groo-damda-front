import type { AssetForm } from "./use-asset-form";
import { CardProductField } from "./CardProductField";
import { NameField } from "./NameField";
import { LimitField } from "./LimitField";
import { PaymentDayField } from "./PaymentDayField";
import { DueField } from "./DueField";
import { BalanceField } from "./BalanceField";
import { PaymentAccountField } from "./PaymentAccountField";

/**
 * 카드 묶음의 칸 — 카드 상품 → 별칭 → (신용) 신용한도 → 결제일 → [결제될 금액] → 그 뒤 쓴 금액 → 결제 출금계좌 / (체크) 연결 계좌.
 * 체크카드는 잔액을 들지 않는다 — 긁는 즉시 연결 계좌에서 빠진다. 한 벌 차례는 I-17 11
 * 통화 칸은 없다 — 카드는 원화만(I-13 결정 4). 저장은 늘 원화로 나간다(use-asset-form 의 currency).
 */
export function CardFields({ f }: { f: AssetForm }) {
  return (
    <>
      <CardProductField f={f} />
      <NameField f={f} />
      <LimitField f={f} />
      <PaymentDayField f={f} />
      <DueField f={f} />
      <BalanceField f={f} />
      <PaymentAccountField f={f} />
    </>
  );
}
