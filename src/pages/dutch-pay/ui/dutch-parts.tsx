import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { withCommaBreaks } from "@/shared/ds/i18n";
import { KRW } from "@/shared/lib/groo/format";
import { MaskAmount, WonUnit } from "@/shared/lib/groo/hide-amounts";
import { wonPre } from "@/shared/lib/groo/hide-amounts-core";
import type { HideCardKey } from "@/shared/lib/groo/hide-amounts-cards";
import type { PerPerson } from "../model/dutch-model";
import { wonText } from "../model/dutch-format";

/** 금액 + 원 — 원까지 보인다. 넘치면 쉼표 뒤에서만 줄을 바꾼다(고정폭). 가린 금액이면 점으로(원도 함께 숨는다) */
export function Won({
  amount,
  card = "dutchpay.sessions",
}: {
  amount: number;
  card?: HideCardKey;
}) {
  return (
    <span className="inline-block max-w-full tabular-nums">
      <MaskAmount card={card} mask="••••">
        {withCommaBreaks(`${wonPre()}${KRW(amount)}`)}
      </MaskAmount>
      <WonUnit card={card} />
    </span>
  );
}

/** 가린 금액이 든 글 — 가리면 금액 자리만 점으로 바꾼 글을 그린다 */
export function MaskedText({
  text,
  masked,
  card = "dutchpay.sessions",
}: {
  text: ReactNode;
  masked: ReactNode;
  card?: HideCardKey;
}) {
  return (
    <MaskAmount card={card} mask={masked}>
      {text}
    </MaskAmount>
  );
}

/** "1인당 61,333원" · "1인당 61,333원 · 1원은 나" — 몫 규칙은 `perPersonOf`. 해당 없으면(비율 · 직접 입력) 아무것도 그리지 않는다 */
export function PerPersonText({
  info,
  card = "dutchpay.sessions",
}: {
  info: PerPerson;
  card?: HideCardKey;
}) {
  const { t } = useTranslation("dutchPay");
  if (info.kind === "none") return null;
  const make = (amount: string) =>
    info.kind === "rest"
      ? t("perPersonRest", {
          amount,
          extra: KRW(info.extra),
          name: info.name,
        })
      : t("perPersonText", { amount });
  return (
    <MaskedText
      card={card}
      text={make(wonText(info.amount))}
      masked={make("••••")}
    />
  );
}
