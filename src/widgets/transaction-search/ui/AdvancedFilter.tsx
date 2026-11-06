import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ds/button";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogTrigger,
} from "@/shared/ds/dialog";
import { Field } from "@/shared/ds/field";
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
              invalid={badAmount}
              errorMessage={t("searchBadAmount")}
            >
              <div className="flex items-center gap-x2">
                <Input
                  inputMode="numeric"
                  aria-label={t("searchMin")}
                  placeholder={t("searchMin")}
                  suffix={t("searchWon")}
                  value={draft.min}
                  onChange={(e) =>
                    setDraft({ ...draft, min: digits(e.target.value) })
                  }
                />
                <span aria-hidden>~</span>
                <Input
                  inputMode="numeric"
                  aria-label={t("searchMax")}
                  placeholder={t("searchMax")}
                  suffix={t("searchWon")}
                  value={draft.max}
                  onChange={(e) =>
                    setDraft({ ...draft, max: digits(e.target.value) })
                  }
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
