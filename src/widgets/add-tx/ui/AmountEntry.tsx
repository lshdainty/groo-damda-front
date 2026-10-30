import { useTranslation } from "react-i18next";
import { Check, ChevronDown } from "lucide-react";

import { MAX_AMOUNT } from "@/shared/lib/groo/amount";
import { AmountInput } from "@/shared/ui/groo/amount-input";
import { Chip } from "@/shared/ds/chip";
import { Input } from "@/shared/ds/input";
import { List, ListButtonItem } from "@/shared/ds/list";
import { CURRENCIES, currencySymbol } from "@/shared/lib/groo/currency";
import type { TxForm } from "../model/use-tx-form";
import { PickSurface } from "./tx-parts";
import { formatDecimal, sanitizeDecimal } from "../lib/amount-format";

/** 통화 칩 — 칸 끝 "{기호} {코드}" + ▾ . 누르면 통화 고르기(시트 · Popover) */
export function CurrencyChip({ f }: { f: TxForm }) {
  const { t } = useTranslation("expense");
  const code = f.origCurrency;
  return (
    <PickSurface
      title={t("addTx.currencyTitle")}
      trigger={({ onClick, open }) => (
        <Chip
          variant="solid"
          size="small"
          // 밑줄 칸 높이(큰 40 · 1280 이상 34)를 칩 32 가 밀어내지 않게 위아래 여백을 칸 padding 에서 되돌려 받는다
          className="-my-x1 lg:-my-x1_5"
          suffixIcon={<ChevronDown aria-hidden />}
          aria-label={t("addTx.currencyChip", { code })}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={onClick}
        >
          {currencySymbol(code)} {code}
        </Chip>
      )}
    >
      {({ close }) => (
        <div className="-mx-x6">
          <List aria-label={t("addTx.currencyTitle")}>
            {CURRENCIES.map((c) => (
              <ListButtonItem
                key={c.code}
                title={`${c.symbol} ${c.code}`}
                aria-current={c.code === code ? true : undefined}
                suffix={c.code === code ? <Check aria-hidden /> : undefined}
                onClick={() => {
                  f.changeCurrency(c.code);
                  close();
                }}
              />
            ))}
          </List>
        </div>
      )}
    </PickSurface>
  );
}

/**
 * 밑줄 금액 칸 (D 20 · 20a) — 원화면 정수 + 뒤 글자 대신 통화 칩, 외화면 현지 금액(소수 둘째 자리).
 * 이체에는 통화 칩이 없다(외화는 지출 · 수입에만) — 뒤 글자 "원".
 */
export function AmountEntry({
  f,
  inputRef,
  onEnter,
  label,
  autoFocus,
  invalid,
}: {
  f: TxForm;
  inputRef?: (el: HTMLInputElement | null) => void;
  onEnter?: () => void;
  label: string;
  autoFocus?: boolean;
  invalid?: boolean;
}) {
  const showChip = f.type !== "TRANSFER";
  const enter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && onEnter) {
      e.preventDefault();
      onEnter();
    }
  };
  if (f.isForeignTx) {
    return (
      <Input
        ref={inputRef}
        variant="underline"
        size="large"
        aria-label={label}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        autoFocus={autoFocus}
        aria-invalid={invalid || undefined}
        value={formatDecimal(f.origAmount)}
        onChange={(e) => f.setOrigAmount(sanitizeDecimal(e.target.value))}
        onKeyDown={enter}
        suffix={showChip ? <CurrencyChip f={f} /> : undefined}
      />
    );
  }
  return (
    <AmountInput
      ref={inputRef}
      variant="underline"
      size="large"
      aria-label={label}
      autoFocus={autoFocus}
      aria-invalid={invalid || undefined}
      value={f.amount}
      max={MAX_AMOUNT}
      onValueChange={f.setAmount}
      onKeyDown={enter}
      unit={showChip ? <CurrencyChip f={f} /> : undefined}
    />
  );
}
