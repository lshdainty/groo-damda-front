import { withCommaBreaks } from "@/shared/ds/i18n";
import { KRW, isEn } from "@/shared/lib/groo/format";
import { HideUnit, MaskAmount } from "@/shared/lib/groo/hide-amounts";
import { wonPre } from "@/shared/lib/groo/hide-amounts-core";
import type { HideKind } from "@/shared/lib/groo/hide-amounts-cards";

/** 금액 글 — 쉼표 뒤에서만 줄바꿈, 금액 가리기는 거래 상세 카드(`ledger.txDetail`)와 같게 */
export function Won({
  n,
  kind,
  className,
}: {
  n: number;
  kind: HideKind;
  className?: string;
}) {
  return (
    <span className={className}>
      <MaskAmount card="ledger.txDetail" kind={kind}>
        {withCommaBreaks(`${wonPre()}${KRW(n)}`)}
      </MaskAmount>
      <HideUnit card="ledger.txDetail" kind={kind}>
        {isEn() ? "" : "원"}
      </HideUnit>
    </span>
  );
}
