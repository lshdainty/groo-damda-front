import { useTranslation } from "react-i18next";
import { KRW, isEn } from "@/shared/lib/groo/format";
import { MaskAmount, WonUnit } from "@/shared/lib/groo/hide-amounts";
import { wonPre } from "@/shared/lib/groo/hide-amounts-core";
import type { HideCardKey } from "@/shared/lib/groo/hide-amounts-cards";
import type { DutchPay } from "@/entities/dutch-pay";
import { perPersonInfo } from "../model/dutch-model";

/** 금액 + 원 — 원까지 · 줄바꿈 없음 · 고정폭. 가린 금액이면 점으로(원도 함께 숨는다) */
export function Won({
  amount,
  card = "dutchpay.sessions",
}: {
  amount: number;
  card?: HideCardKey;
}) {
  return (
    <span className="whitespace-nowrap tabular-nums">
      <MaskAmount card={card} mask="••••">
        {wonPre()}
        {KRW(amount)}
      </MaskAmount>
      <WonUnit card={card} />
    </span>
  );
}

const wonText = (n: number) => `${wonPre()}${KRW(n)}${isEn() ? "" : "원"}`;

/** "1인당 61,333원" — 나눠 떨어지지 않으면 "· 1원은 나" 까지(저장 몫에서 읽는다 — I-15 40) */
export function PerPersonText({
  d,
  card = "dutchpay.sessions",
}: {
  d: DutchPay;
  card?: HideCardKey;
}) {
  const { t } = useTranslation("dutchPay");
  const info = perPersonInfo(d);
  const text = info.restName
    ? t("perPersonRest", {
        amount: wonText(info.amount),
        extra: KRW(info.restExtra),
        name: info.restName,
      })
    : t("perPersonText", { amount: wonText(info.amount) });
  const masked = info.restName
    ? t("perPersonRest", {
        amount: "••••",
        extra: KRW(info.restExtra),
        name: info.restName,
      })
    : t("perPersonText", { amount: "••••" });
  return (
    <MaskAmount card={card} mask={masked}>
      {text}
    </MaskAmount>
  );
}
