import { useId } from "react";
import { Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ds/button";
import { Input } from "@/shared/ds/input";
import { dsText } from "@/shared/ds/i18n";
import { blockNonDigitKey } from "@/shared/lib/groo/amount";
import { useAmountLimit } from "@/shared/lib/groo/use-amount-limit";
import { AmountLimitError } from "@/shared/ui/groo/amount-limit-error";
import { MAX_AMOUNT_RANGES, type AmountRange } from "../../model/filter";

/**
 * 금액 본문 — 구간 줄(최소 ~ 최대, 숫자 키보드 · 뒤 글 "원") 최대 셋. 구간 사이는 OR. "구간 추가" · 줄 지우기는
 * Button small ghost(추가는 앞 아이콘 plus 16, 지우기는 iconOnly "이 줄 지우기").
 */
export function FilterAmountBody({
  value,
  onChange,
}: {
  value: AmountRange[];
  onChange: (next: AmountRange[]) => void;
}) {
  const { t } = useTranslation("expense");
  const set = (i: number, patch: Partial<AmountRange>) =>
    onChange(value.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  return (
    <div className="flex flex-col gap-x2">
      {value.map((r, i) => (
        <AmountRangeRow
          key={i}
          range={r}
          onChange={(patch) => set(i, patch)}
          onRemove={() => onChange(value.filter((_, k) => k !== i))}
        />
      ))}
      {value.length < MAX_AMOUNT_RANGES && (
        <Button
          type="button"
          variant="ghost"
          size="small"
          className="self-start"
          onClick={() => onChange([...value, { min: "", max: "" }])}
        >
          <Plus />
          {t("filter.addAmountRange")}
        </Button>
      )}
    </div>
  );
}

/**
 * 구간 한 줄 — 상한 오류 상태는 줄이 든다(줄 번호로 따로 기억하지 않는다). 상한을 넘는 입력은 받지 않고 값은 그대로,
 * 그 줄 아래에 오류. 오류는 줄의 지금 값에서 나오므로 앞 줄을 지워 줄이 밀려도 다른 줄 아래로 옮겨 가지 않는다
 */
function AmountRangeRow({
  range,
  onChange,
  onRemove,
}: {
  range: AmountRange;
  onChange: (patch: Partial<AmountRange>) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation("expense");
  const uid = useId();
  const minLimit = useAmountLimit(range.min);
  const maxLimit = useAmountLimit(range.max);
  // 마지막으로 거절한 칸의 글을 보인다(둘이 함께 뜨면 최근 것)
  const message =
    minLimit.message && maxLimit.message
      ? minLimit.tick >= maxLimit.tick
        ? minLimit.message
        : maxLimit.message
      : (minLimit.message ?? maxLimit.message);
  const describedBy = message ? `${uid}-error` : undefined;
  return (
    <div className="flex flex-col gap-x2">
      <div className="flex items-center gap-x2">
        <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-x2">
          <Input
            inputMode="numeric"
            className="num"
            aria-label={t("filter.minAmount")}
            placeholder={t("filter.minAmount")}
            suffix={t("filter.amountUnit")}
            value={range.min}
            onChange={(e) => {
              const r = minLimit.read(e.target.value);
              if (r.accepted) onChange({ min: r.value });
            }}
            onKeyDown={blockNonDigitKey}
            aria-invalid={minLimit.message ? true : undefined}
            aria-describedby={minLimit.message ? describedBy : undefined}
          />
          <span aria-hidden className="text-fg-neutral-subtle">
            {dsText("datePicker.rangeSeparator")}
          </span>
          <Input
            inputMode="numeric"
            className="num"
            aria-label={t("filter.maxAmount")}
            placeholder={t("filter.maxAmount")}
            suffix={t("filter.amountUnit")}
            value={range.max}
            onChange={(e) => {
              const r = maxLimit.read(e.target.value);
              if (r.accepted) onChange({ max: r.value });
            }}
            onKeyDown={blockNonDigitKey}
            aria-invalid={maxLimit.message ? true : undefined}
            aria-describedby={maxLimit.message ? describedBy : undefined}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="small"
          layout="iconOnly"
          aria-label={t("filter.removeRow")}
          onClick={onRemove}
        >
          <X />
        </Button>
      </div>
      <AmountLimitError id={`${uid}-error`} message={message} />
    </div>
  );
}
