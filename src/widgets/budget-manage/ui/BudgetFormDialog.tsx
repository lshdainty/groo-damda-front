import { useSaveFailureText } from "@/shared/lib/save-failure-text";
import { useRef, useState } from "react";
import { Check } from "lucide-react";
import { useWideSurface } from "@/shared/ds/overlay";
import { useTranslation } from "react-i18next";
import { MAX_AMOUNT, parseAmount } from "@/shared/lib/groo/amount";
import { Button } from "@/shared/ds/button";
import { Callout } from "@/shared/ds/callout";
import { useScrollToError } from "@/shared/hooks/useScrollToError";
import { Chip, ChipGroup } from "@/shared/ds/chip";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogCancel,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
} from "@/shared/ds/dialog";
import { Field } from "@/shared/ds/field";
import { List, ListButtonItem, ListTile } from "@/shared/ds/list";
import { AmountInput } from "@/shared/ui/groo/amount-input";
import { PickerRow } from "@/shared/ui/groo/picker-row";
import { Icon } from "@/shared/ui/groo/primitives";
import { money, isEn } from "@/shared/lib/groo/format";
import { getPaletteByColor } from "@/shared/lib/groo/chart-palette";
import type { ExpenseBudget, ExpenseCategory } from "@/entities/expense";

export interface BudgetDraft {
  categoryRowId: number;
  budgetAmount: number;
}

/**
 * 제안 칩 값 — 칩 라벨은 축약이 아니라 **우리가 고른 값의 이름**이다. 전부 만으로 나누어 떨어지므로
 * (`p % 10_000 === 0`) `10만원` · `100만원` 은 반올림 없이 값 그대로다. **값을 추가할 때는 만으로 나누어떨어지는지 먼저 본다.**
 * 15,000 같은 값을 끼우면 `(p / 10_000).toFixed(0)` 이 `2만원` 으로 깎는다 — 그때는 공용 `formatChartAxis` 로 옮긴다.
 * 총 예산과 카테고리 예산은 목록이 따로다(I-19 8 — 앱이 카테고리 값을 총 예산에도 쓰던 것을 가른다).
 */
const TOTAL_PRESETS = [1_500_000, 2_000_000, 2_500_000, 3_000_000];
const CATEGORY_PRESETS = [
  100_000, 200_000, 300_000, 500_000, 800_000, 1_000_000,
];

export interface BudgetFormDialogProps {
  /** total — 그 달 총 예산(카테고리 없는 예산) · category — 카테고리 예산 추가(budget 없음) · 수정(budget 있음) */
  kind: "total" | "category";
  /** total: 있으면 [저장] · 없으면 [추가] / category: null 이면 추가 */
  budget: ExpenseBudget | null;
  /** 제목 "{n}월 총 예산" 의 달 */
  month: number;
  categories: ExpenseCategory[];
  existing: ExpenseBudget[];
  onClose: () => void;
  onSave: (draft: BudgetDraft) => void;
  /** 카테고리 예산 수정의 [삭제] — 밀기는 지름길이라 삭제는 들어간 화면에도 있다(swipe-actions.md:76). 확인창은 부르는 쪽이 한 번 띄운다 */
  onDelete?: () => void;
  submitting?: boolean;
  /** 저장 요청이 실패했다 — 폼 맨 위 critical Callout(고정 글), 폼은 열린 채 · 쓴 값 그대로 */
  saveFailed?: boolean;
  /** 실패마다 새 값 — 같은 실패가 이어져도 Callout 을 다시 보이게 올린다 */
  saveError?: unknown;
}

/**
 * 예산 폼 한 부품(I-19 C) — 총 예산 · 카테고리 예산 추가 · 수정. 밑줄 금액 칸 하나 + 제안 칩, 카테고리는 줄(→ 고르기).
 * 1280 이상 대화상자 480 · 미만 Bottom Sheet. 주 버튼은 켜 두고 누를 때 검증한다(칸 아래 오류 · 첫 오류 칸 초점).
 * 저장 본문은 그대로 — total 은 `categoryRowId: 0`(자리 값) 으로 onSave 에 넘기고 부르는 쪽이 금액만 쓴다.
 */
export function BudgetFormDialog({
  kind,
  budget,
  month,
  categories,
  existing,
  onClose,
  onSave,
  onDelete,
  submitting,
  saveFailed,
  saveError,
}: BudgetFormDialogProps) {
  const { t } = useTranslation("budget");
  const { t: tc } = useTranslation("common");
  const isTotal = kind === "total";
  const isNew = budget == null;
  const wide = useWideSurface();

  // 선택 가능한 카테고리 = EXPENSE 타입의 부모 카테고리(top-level) 만. 자식의 지출은 부모로 roll-up 되어 집계된다.
  const selectable = categories.filter(
    (c) => c.expenseType === "EXPENSE" && c.parentRowId == null,
  );
  const used = new Set(
    existing
      .filter((b) => b.categoryRowId !== null)
      .map((b) => b.categoryRowId as number),
  );

  const initialCat = isTotal ? null : (budget?.categoryRowId ?? null);
  const initialAmount = budget ? String(budget.budgetAmount) : "";
  const [categoryRowId, setCategoryRowId] = useState<number | null>(initialCat);
  const [amount, setAmount] = useState(initialAmount);
  const [show, setShow] = useState({ cat: false, amount: false });

  // 본문은 스크롤되고 [저장] 은 바닥이라 내린 채 실패하면 맨 위 Callout 이 흐림 밑에 가린다 — 실패하면 올려 보인다
  const errorRef = useScrollToError<HTMLDivElement>(!!saveFailed, saveError);
  const sft = useSaveFailureText();
  const amountRef = useRef<HTMLInputElement>(null);
  const catRef = useRef<HTMLButtonElement>(null);

  const num = parseAmount(amount);
  const selectedCat = categories.find((c) => c.rowId === categoryRowId) ?? null;
  const dirty = categoryRowId !== initialCat || amount !== initialAmount;

  const catError = !isTotal && isNew && categoryRowId == null;
  const amountError: "empty" | "tooLarge" | null =
    num <= 0 ? "empty" : num > MAX_AMOUNT ? "tooLarge" : null;

  const submit = () => {
    if (submitting) return;
    setShow({ cat: catError, amount: amountError != null });
    if (catError) {
      catRef.current?.focus();
      return;
    }
    if (amountError) {
      amountRef.current?.focus();
      return;
    }
    onSave({
      categoryRowId: isTotal ? 0 : (categoryRowId as number),
      budgetAmount: num,
    });
  };

  const presets = isTotal ? TOTAL_PRESETS : CATEGORY_PRESETS;
  const chipText = (p: number) =>
    isEn() ? money(p) : `${(p / 10_000).toFixed(0)}만원`;

  const title = isTotal
    ? t("edit.totalTitle", { month })
    : isNew
      ? t("edit.addTitle")
      : t("edit.editTitle");
  const submitLabel = isNew ? t("add") : tc("save");
  const amountMessage =
    amountError === "tooLarge"
      ? tc("amountTooLarge")
      : isTotal
        ? t("edit.errTotal")
        : t("edit.errAmount");

  const allBudgeted =
    selectable.length > 0 && selectable.every((c) => used.has(c.rowId));

  return (
    <ResponsiveDialog
      open
      form
      dirty={dirty}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      busy={submitting}
    >
      <ResponsiveDialogContent
        title={title}
        // 새 예산만 첫 칸(카테고리 · 총 예산은 금액)에 초점 — 수정은 표면이 받는다(막지 않는다. 폰에서 키보드가 가리지 않게)
        onOpenAutoFocus={(e) => {
          if (!isNew) return;
          e.preventDefault();
          (isTotal ? amountRef : catRef).current?.focus({
            preventScroll: true,
          });
        }}
      >
        <ResponsiveDialogBody>
          {saveFailed && (
            <div ref={errorRef}>
              <Callout tone="critical" role="alert" className="mb-x4">
                {sft(saveError, t("edit.saveFailed"))}
              </Callout>
            </div>
          )}
          {!isTotal && (
            <div className="-mx-x6 mb-x3">
              <PickerRow
                ref={catRef}
                title={t("edit.categoryLabel")}
                value={selectedCat?.categoryName}
                placeholder={t("edit.selectCategory")}
                dot={
                  selectedCat
                    ? getPaletteByColor(selectedCat.color).color
                    : undefined
                }
                ariaLabel={`${t("edit.categoryLabel")}, ${selectedCat?.categoryName ?? t("edit.noneSelected")}`}
                readOnly={!isNew}
                surfaceTitle={t("edit.categoryLabel")}
                scrollFog
                errorMessage={
                  show.cat && catError ? t("edit.errCategory") : null
                }
              >
                {({ close }) => (
                  <div className="-mx-x6">
                    {selectable.length === 0 ? (
                      <p className="m-0 px-x6 py-x3 font-sans text-t4 text-fg-neutral-subtle">
                        {t("edit.noCategories")}
                      </p>
                    ) : (
                      <>
                        {allBudgeted && (
                          <p className="m-0 px-x6 py-x3 font-sans text-t4 text-fg-neutral-subtle">
                            {t("edit.allBudgeted")}
                          </p>
                        )}
                        <List>
                          {selectable.map((c) => {
                            const has = used.has(c.rowId);
                            const palette = getPaletteByColor(c.color);
                            return (
                              <ListButtonItem
                                key={c.rowId}
                                title={c.categoryName}
                                detail={has ? t("edit.hasBudget") : undefined}
                                disabled={has}
                                aria-current={
                                  categoryRowId === c.rowId ? true : undefined
                                }
                                prefix={
                                  <ListTile
                                    style={
                                      has
                                        ? undefined
                                        : {
                                            background: palette.bg,
                                            color: palette.color,
                                          }
                                    }
                                  >
                                    <Icon name={c.icon ?? "tag"} size={20} />
                                  </ListTile>
                                }
                                suffix={
                                  categoryRowId === c.rowId ? (
                                    <Check aria-hidden />
                                  ) : undefined
                                }
                                onClick={() => {
                                  setCategoryRowId(c.rowId);
                                  setShow((s) => ({ ...s, cat: false }));
                                  close();
                                }}
                              />
                            );
                          })}
                        </List>
                      </>
                    )}
                  </div>
                )}
              </PickerRow>
            </div>
          )}
          <Field
            label={
              isTotal ? t("edit.totalField") : t("edit.categoryAmountField")
            }
            invalid={show.amount && amountError != null}
            errorMessage={amountMessage}
          >
            <AmountInput
              ref={amountRef}
              variant="underline"
              value={amount}
              onValueChange={(v) => {
                setAmount(v);
                setShow((s) => ({ ...s, amount: false }));
              }}
            />
          </Field>
          <ChipGroup
            aria-label={t("edit.quickAmounts")}
            className="mt-x3 mb-x6"
          >
            {presets.map((p) => (
              <Chip
                key={p}
                variant="solid"
                size="medium"
                onClick={() => {
                  setAmount(String(p));
                  setShow((s) => ({ ...s, amount: false }));
                }}
              >
                {chipText(p)}
              </Chip>
            ))}
          </ChipGroup>
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          {!isTotal && !isNew && onDelete && (
            <Button
              variant="ghost"
              ghostColor="critical"
              size={wide ? undefined : "large"}
              className={wide ? "mr-auto" : "shrink-0"}
              onClick={() => {
                if (!submitting) onDelete();
              }}
            >
              {tc("delete")}
            </Button>
          )}
          <ResponsiveDialogCancel>{tc("cancel")}</ResponsiveDialogCancel>
          <Button loading={submitting} onClick={submit}>
            {submitLabel}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
