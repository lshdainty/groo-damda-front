import { useId, useState } from "react";
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
  const uid = useId();
  const set = (i: number, patch: Partial<AmountRange>) =>
    onChange(value.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  // 상한을 넘는 입력은 받지 않고 값은 그대로 — 그 칸이 든 줄 아래에 오류, 다음 유효한 입력에서 사라진다
  const limit = useAmountLimit();
  const [badAt, setBadAt] = useState<{ i: number; f: "min" | "max" } | null>(
    null,
  );
  const typed = (i: number, f: "min" | "max", raw: string) => {
    const r = limit.read(raw, value[i]![f]);
    if (r.accepted) set(i, { [f]: r.value });
    else setBadAt({ i, f });
  };
  const bad = (i: number, f: "min" | "max") =>
    limit.message != null && badAt?.i === i && badAt.f === f;
  return (
    <div className="flex flex-col gap-x2">
      {value.map((r, i) => (
        <div key={i} className="flex flex-col gap-x2">
          <div className="flex items-center gap-x2">
            <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-x2">
              <Input
                inputMode="numeric"
                className="num"
                aria-label={t("filter.minAmount")}
                placeholder={t("filter.minAmount")}
                suffix={t("filter.amountUnit")}
                value={r.min}
                onChange={(e) => typed(i, "min", e.target.value)}
                onKeyDown={blockNonDigitKey}
                aria-invalid={bad(i, "min") ? true : undefined}
                aria-describedby={
                  bad(i, "min") ? `${uid}${i}-error` : undefined
                }
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
                value={r.max}
                onChange={(e) => typed(i, "max", e.target.value)}
                onKeyDown={blockNonDigitKey}
                aria-invalid={bad(i, "max") ? true : undefined}
                aria-describedby={
                  bad(i, "max") ? `${uid}${i}-error` : undefined
                }
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="small"
              layout="iconOnly"
              aria-label={t("filter.removeRow")}
              onClick={() => onChange(value.filter((_, k) => k !== i))}
            >
              <X />
            </Button>
          </div>
          <AmountLimitError
            id={`${uid}${i}-error`}
            message={badAt?.i === i ? limit.message : null}
          />
        </div>
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
