import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { dsText } from "@/shared/ds/i18n";
import { Button } from "@/shared/ds/button";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogTrigger,
} from "@/shared/ds/dialog";
import { Field } from "@/shared/ds/field";
import { useAmountLimit } from "@/shared/lib/groo/use-amount-limit";
import { Input } from "@/shared/ds/input";
import { TopNavigationIconButton } from "@/shared/ds/top-navigation";
import { hasAdvanced, type SearchCondition } from "../model/search-state";
import { PeriodField } from "./PeriodField";

/**
 * 고급 필터 — 금액 범위와 기간(앱 search_screen 과 같은 두 조건). 기간은 Input Button + Date Picker 기간(PeriodField). 폰은 상단 바의 아이콘 버튼, 데스크톱은 제목 줄의 작은 버튼이 연다.
 * 고르는 동안 검색 결과는 바뀌지 않고, [적용] 에서만 주소에 쓴다(draft). 걸려 있으면 아이콘에 점.
 */
export function AdvancedFilter({
  condition,
  onApply,
  placement,
}: {
  condition: SearchCondition;
  onApply: (patch: Partial<SearchCondition>) => void;
  /** bar — 폰 상단 바의 아이콘 버튼 · title — 데스크톱 제목 줄의 Button small neutralOutline */
  placement: "bar" | "title";
}) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(condition);
  const active = hasAdvanced(condition);

  const badAmount = !!draft.min && !!draft.max && +draft.min > +draft.max;
  // 금액 칸 상한 — 넘는 입력은 받지 않고 값은 그대로, 칸 아래에 오류(금액 필터와 같다)
  const minLimit = useAmountLimit(draft.min);
  const maxLimit = useAmountLimit(draft.max);
  const limitMessage =
    minLimit.message && maxLimit.message
      ? minLimit.tick >= maxLimit.tick
        ? minLimit.message
        : maxLimit.message
      : (minLimit.message ?? maxLimit.message);
  const digits = (v: string) => v.replace(/\D/g, "");

  const label = t("searchAdvanced");
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(condition);
        setOpen(next);
      }}
    >
      <ResponsiveDialogTrigger asChild>
        {placement === "bar" ? (
          <TopNavigationIconButton
            aria-label={active ? t("searchAdvancedOn") : label}
            notification={active}
          >
            <SlidersHorizontal />
          </TopNavigationIconButton>
        ) : (
          <Button variant="neutralOutline" size="small">
            <SlidersHorizontal />
            {active ? t("searchAdvancedOn") : label}
          </Button>
        )}
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent title={label}>
        <ResponsiveDialogBody>
          {/* Field 사이 24(field.md "폼 간격") */}
          <div className="flex flex-col gap-x6">
            <Field
              label={t("searchAmountRange")}
              invalid={badAmount || limitMessage != null}
              errorMessage={limitMessage ?? t("searchBadAmount")}
            >
              <div className="flex items-center gap-x2">
                <Input
                  inputMode="numeric"
                  aria-label={t("searchMin")}
                  placeholder={t("searchMin")}
                  suffix={t("searchWon")}
                  value={draft.min}
                  onChange={(e) => {
                    const r = minLimit.read(digits(e.target.value));
                    if (r.accepted) setDraft({ ...draft, min: r.value });
                  }}
                />
                <span aria-hidden>{dsText("datePicker.rangeSeparator")}</span>
                <Input
                  inputMode="numeric"
                  aria-label={t("searchMax")}
                  placeholder={t("searchMax")}
                  suffix={t("searchWon")}
                  value={draft.max}
                  onChange={(e) => {
                    const r = maxLimit.read(digits(e.target.value));
                    if (r.accepted) setDraft({ ...draft, max: r.value });
                  }}
                />
              </div>
            </Field>
            <PeriodField
              from={draft.from}
              to={draft.to}
              onChange={(p) => setDraft({ ...draft, ...p })}
            />
          </div>
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <Button
            variant="neutralWeak"
            onClick={() =>
              setDraft({ ...draft, min: "", max: "", from: "", to: "" })
            }
          >
            {t("searchReset")}
          </Button>
          <Button
            disabled={badAmount}
            onClick={() => {
              onApply({
                min: draft.min,
                max: draft.max,
                from: draft.from,
                to: draft.to,
              });
              setOpen(false);
            }}
          >
            {t("searchApply")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
