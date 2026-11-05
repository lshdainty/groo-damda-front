import { Field } from "@/shared/ds/field";
import { Input } from "@/shared/ds/input";
import { Select, SelectItem } from "@/shared/ds/select";
import { CURRENCIES } from "@/shared/lib/groo/currency";
import type { AssetForm } from "./use-asset-form";

/**
 * 통화 · 환율 — 세 묶음이 같은 칸을 쓴다(D1). 잔액 바로 아래인 이유는 이 칸이 잔액의 단위를 정하기 때문이다.
 * 계좌 · 투자 · 대출이 쓴다. 카드는 원화만이라 이 칸이 없다(I-13 결정 4, 서버 AST_037). 두 칸을 나란히(라벨과 값이 짧을 때만 — field.yaml).
 * 외화면 환율이 필수다(서버 AST_036) — 비운 채 저장을 누르면 칸 오류.
 */
export function CurrencyFields({ f }: { f: AssetForm }) {
  const {
    t,
    currency,
    setCurrency,
    isForeign,
    exchangeRate,
    setExchangeRate,
    issues,
    showErrors,
  } = f;
  return (
    <div className="flex items-start gap-x4">
      <Field label={t("form.currency")} className="w-auto min-w-0 flex-1">
        <Select value={currency} onValueChange={setCurrency}>
          {CURRENCIES.map((c) => (
            <SelectItem
              key={c.code}
              value={c.code}
              label={`${c.symbol} ${c.code}`}
            />
          ))}
        </Select>
      </Field>
      {isForeign && (
        <Field
          label={t("form.exchangeRate")}
          description={t("form.exchangeRateHint")}
          invalid={showErrors && issues.exchangeRate}
          errorMessage={t("form.exchangeRateRequired")}
          className="w-auto min-w-0 flex-1"
        >
          {/* 소수를 받는 칸이라 부호 키 막기를 붙이지 않는다 — 붙이면 `.` 이 안 찍혀 1380.5 를 못 적는다. */}
          <Input
            inputMode="decimal"
            value={exchangeRate}
            onChange={(e) => setExchangeRate(e.target.value)}
            placeholder={t("form.exchangeRatePlaceholder", { code: currency })}
          />
        </Field>
      )}
    </div>
  );
}
