import { ArrowRightLeft, ChevronRight, ClipboardPaste } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/shared/ds/button";
import { Chip, ChipGroup, ChipRadio, ChipRadioGroup } from "@/shared/ds/chip";
import { Field } from "@/shared/ds/field";
import { List, ListButtonItem, ListHeader } from "@/shared/ds/list";
import { Skeleton } from "@/shared/ds/skeleton";
import { Icon } from "@/shared/ui/groo/primitives";
import { getPaletteByColor } from "@/shared/lib/groo/chart-palette";
import { formatChartAxis } from "@/shared/lib/groo/format";
import type { ExpenseTemplate } from "@/entities/expense-template";
import type { TxForm, TxType } from "../model/use-tx-form";
import { AmountEntry } from "./AmountEntry";
import { RowError } from "./tx-parts";

/** 종류 칩 (D 20) — Chip outlineStrong medium 하나 고르기. 수정 · 고쳐 쓰기는 지금 종류만 고르고 다른 칩은 막힌다 */
export function TypeChips({ f }: { f: TxForm }) {
  const { t } = useTranslation("expense");
  const items: { v: TxType; l: string }[] = [
    { v: "EXPENSE", l: t("expense") },
    { v: "INCOME", l: t("income") },
    { v: "TRANSFER", l: t("addTx.transfer") },
  ];
  const lockedTo = f.isEdit ? f.type : null;
  return (
    <ChipRadioGroup
      aria-label={t("addTx.typeGroup")}
      value={f.type}
      onValueChange={(v) => v && f.changeType(v as TxType)}
      layout="wrap"
      className="px-global-gutter pb-x2"
    >
      {items.map((o) => (
        <ChipRadio
          key={o.v}
          value={o.v}
          variant="outlineStrong"
          size="medium"
          disabled={
            (lockedTo != null && o.v !== lockedTo) ||
            (f.isRewrite && o.v === "TRANSFER")
          }
        >
          {o.l}
        </ChipRadio>
      ))}
    </ChipRadioGroup>
  );
}

/** 프리셋 칩 앞 타일 20 — 카테고리 색 · 이체는 회색 화살표 */
function PresetTile({ p, f }: { p: ExpenseTemplate; f: TxForm }) {
  if (p.expenseType === "TRANSFER")
    return (
      <span
        aria-hidden
        className="flex size-5 items-center justify-center rounded-r1_5 bg-bg-neutral-weak text-fg-neutral-muted"
      >
        <ArrowRightLeft className="size-3" />
      </span>
    );
  const cat = f.categories.find((c) => c.rowId === p.categoryRowId);
  const palette = getPaletteByColor(cat?.color ?? null);
  return (
    <span
      aria-hidden
      className="flex size-5 items-center justify-center rounded-r1_5"
      style={{ background: palette.bg, color: palette.color }}
    >
      <Icon name={cat?.icon ?? "tag"} size={12} />
    </span>
  );
}

/** 프리셋 묶음 (D 21) — 제목 + "현재 입력값 저장", 칩 줄(사용 많은 8) + "모두 보기" */
function PresetBlock({ f }: { f: TxForm }) {
  const { t } = useTranslation("expense");
  const { t: tc } = useTranslation("common");
  const total = f.templates.filter((p) => p.expenseType === f.type).length;
  const applied = f.templates.find((p) => p.rowId === f.activePresetId);
  return (
    <section aria-label={t("addTx.presetLoad")}>
      <ListHeader as="div">
        <h3 className="m-0 tracking-normal text-inherit [font:inherit]">
          {applied
            ? t("addTx.presetApplied", { name: applied.templateName })
            : t("addTx.presetLoad")}
        </h3>
        <Button
          type="button"
          variant="ghost"
          ghostColor="neutralMuted"
          size="small"
          onClick={() => f.openPresetSave()}
        >
          {t("addTx.saveCurrentInput")}
        </Button>
      </ListHeader>
      {f.templatesQ.isPending ? (
        <div aria-hidden className="flex gap-x2 px-global-gutter pb-x2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} radius="full" className="h-9 w-24" />
          ))}
        </div>
      ) : f.templatesQ.isError ? (
        <div className="flex items-center justify-between gap-x2 px-global-gutter pb-x2">
          <p className="m-0 font-sans text-t4 text-fg-neutral-subtle">
            {t("addTx.presetLoadFailed")}
          </p>
          <Button
            type="button"
            variant="ghost"
            ghostColor="neutralMuted"
            size="small"
            onClick={() => void f.templatesQ.refetch()}
          >
            {tc("retry")}
          </Button>
        </div>
      ) : f.topPresets.length === 0 ? (
        <p className="m-0 px-global-gutter pb-x2 font-sans text-t4 text-fg-neutral-subtle">
          {t("addTx.noPresets")}
        </p>
      ) : (
        <ChipGroup
          layout="scroll"
          aria-label={t("addTx.presetLoad")}
          className="pb-x2"
        >
          {f.topPresets.map((p) => {
            const on = p.rowId === f.activePresetId;
            return (
              <Chip
                key={p.rowId}
                variant="outlineWeak"
                selected={on}
                size="medium"
                prefixIcon={<PresetTile p={p} f={f} />}
                onClick={() => f.togglePreset(p)}
              >
                {p.templateName}
                {p.lockAmount === "Y" && p.amount != null && p.amount > 0 && (
                  <span className="ml-x1_5 text-fg-neutral-subtle">
                    {formatChartAxis(p.amount)}
                  </span>
                )}
              </Chip>
            );
          })}
          {total > f.topPresets.length && (
            <Chip
              variant="outlineWeak"
              size="medium"
              suffixIcon={<ChevronRight aria-hidden />}
              onClick={() => f.setSub("presetAll")}
            >
              {t("addTx.showAll")}
            </Chip>
          )}
        </ChipGroup>
      )}
    </section>
  );
}

/**
 * 1단계 (D 19 · 20 · 21 · 1-B) — 종류 칩 · 밑줄 금액 하나(끝에 통화 칩) · 프리셋 · 결제 문자 줄. 새 거래에서만 나온다.
 * 금액을 치고 [다음] 이면 2단계로 간다.
 */
export function TxStep1({ f }: { f: TxForm }) {
  const { t } = useTranslation("expense");
  const entryErr = f.showErrors && f.errors.entry;
  const tooLarge = f.errors.tooLarge && !f.isForeignTx;
  return (
    <>
      <TypeChips f={f} />
      <Field
        label={t("form.amount")}
        invalid={entryErr || tooLarge}
        errorMessage={
          tooLarge ? t("addTx.amountTooLarge") : t("addTx.entryRequired")
        }
        description={
          f.emptyPresetName != null && f.entryNumber <= 0
            ? t("addTx.emptyPresetHint", { name: f.emptyPresetName })
            : undefined
        }
        className="px-global-gutter pb-x4 pt-x3 [&_label]:sr-only"
      >
        <AmountEntry
          f={f}
          label={t("form.amount")}
          inputRef={f.refFor("entry")}
          autoFocus
          onEnter={f.goNext}
        />
      </Field>
      <PresetBlock f={f} />
      {f.type === "EXPENSE" && (
        <List>
          <ListButtonItem
            title={t("sms.pasteOpen")}
            prefix={
              <ClipboardPaste
                aria-hidden
                className="size-[22px] text-fg-neutral"
              />
            }
            suffix={<ChevronRight aria-hidden className="size-[18px]" />}
            onClick={() => f.setSub("sms")}
          />
        </List>
      )}
      {f.errors.tooLarge && f.isForeignTx && f.showErrors && (
        <RowError>{t("addTx.amountTooLarge")}</RowError>
      )}
    </>
  );
}
