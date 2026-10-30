import { useTranslation } from "react-i18next";

import { Button } from "@/shared/ds/button";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
} from "@/shared/ds/dialog";
import { dsMoney, withCommaBreaks } from "@/shared/ds/i18n";
import { List, ListItem } from "@/shared/ds/list";
import { useWideSurface } from "@/shared/ds/overlay";
import { cn } from "@/shared/lib/cn";
import { PresetTile } from "@/features/expense/ui/preset-row";
import {
  presetAmountColor,
  presetAmountText,
} from "@/features/expense/ui/preset-view";
import type { ExpenseCategory } from "@/entities/expense";
import type { ExpenseTemplate } from "@/entities/expense-template";

const PAYMENT_KEYS: Record<string, string> = {
  CASH: "form.paymentMethod.CASH",
  CARD: "form.paymentMethod.CARD",
  TRANSFER: "paymentTransferFull",
  OTHER: "form.paymentMethod.OTHER",
};

/**
 * 프리셋 상세(I-20 C 18) — 조회 표면(바깥 누름 · 끌어내림으로 닫힌다). 머리(타일 48 + 이름) → 금액 → 설명 한 줄 → 키-값 줄.
 * 값이 없는 줄은 그리지 않는다. 바닥: 시트는 [삭제] large 왼쪽 + [수정] 나머지, 대화상자는 [삭제] small 왼쪽 · [수정] small 오른쪽.
 * 지우기 확인은 부르는 쪽이 한 번만 묻는다.
 */
export function PresetDetailDialog({
  preset,
  categories,
  onClose,
  onEdit,
  onDelete,
}: {
  preset: ExpenseTemplate;
  categories: ExpenseCategory[];
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation("expense");
  const { t: tc } = useTranslation("common");
  const wide = useWideSurface();

  const isTransfer = preset.expenseType === "TRANSFER";
  const isIncome = preset.expenseType === "INCOME";
  const category =
    preset.categoryRowId != null
      ? categories.find((c) => c.rowId === preset.categoryRowId)
      : undefined;
  const amountText = presetAmountText(preset);
  const uses = preset.useCount ?? 0;

  // 설명 한 줄 — "고정 금액 · 3번 썼어요 · 마지막 10월 3일" (0번이면 "아직 쓰지 않았어요", 마지막 쓴 날이 없으면 그 조각을 뺀다)
  const last = preset.lastUsedAt ? new Date(preset.lastUsedAt) : null;
  const noteParts = [
    amountText != null ? t("preset.noteFixed") : t("preset.amountEmpty"),
    uses > 0 ? t("preset.noteUses", { count: uses }) : t("preset.noteUnused"),
  ];
  if (uses > 0 && last && !Number.isNaN(last.getTime())) {
    noteParts.push(
      t("preset.noteLast", {
        month: last.getMonth() + 1,
        day: last.getDate(),
      }),
    );
  }

  const rows: { key: string; name: string; value: string }[] = [];
  const add = (key: string, name: string, value?: string | null) => {
    if (value != null && value !== "") rows.push({ key, name, value });
  };
  add(
    "type",
    t("preset.typeLabel"),
    isTransfer ? t("addTx.transfer") : isIncome ? t("income") : t("expense"),
  );
  if (isTransfer) {
    add("from", t("preset.fromAccount"), preset.assetName);
    add("to", t("preset.toAccount"), preset.toAssetName);
    add(
      "fee",
      t("preset.feeLabel"),
      preset.fee != null && preset.fee > 0 ? dsMoney(preset.fee) : null,
    );
    add(
      "interest",
      t("addTx.interest"),
      preset.interestAmount != null && preset.interestAmount > 0
        ? dsMoney(preset.interestAmount)
        : null,
    );
  } else {
    add("category", t("category"), preset.categoryName);
    add("asset", t("accountCard"), preset.assetName);
    add(
      "payment",
      t("paymentMethodLabel"),
      preset.paymentMethod
        ? t(PAYMENT_KEYS[preset.paymentMethod] ?? "selectNone")
        : null,
    );
    add("merchant", t("preset.defaultMerchant"), preset.merchant);
  }
  add("memo", t("memo"), preset.description);
  if (!isTransfer) {
    add(
      "fixed",
      t(isIncome ? "preset.fixedTitle.income" : "preset.fixedTitle.expense"),
      preset.isFixed ? t("preset.fixedOn") : t("preset.fixedOff"),
    );
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <ResponsiveDialogContent title={t("preset.detailTitle")}>
        <ResponsiveDialogBody>
          <div className="flex items-center gap-x3 pb-x2 pt-x1">
            <PresetTile
              preset={preset}
              category={category}
              className="size-x12 rounded-r4 [&>svg]:size-x6"
              size={24}
            />
            <h3 className="m-0 min-w-0 font-sans text-t7 font-bold text-fg-neutral [overflow-wrap:anywhere]">
              {preset.templateName}
            </h3>
          </div>
          <div className="pb-x1 pt-x3">
            {amountText != null && (
              <p
                data-slot="preset-detail-amount"
                className={cn(
                  "m-0 text-t9 font-bold tabular-nums",
                  presetAmountColor(preset),
                )}
              >
                {withCommaBreaks(amountText)}
              </p>
            )}
            <p
              data-slot="preset-detail-note"
              className="m-0 pt-x1 pb-x2 text-t3 text-fg-neutral-subtle"
            >
              {noteParts.join(" · ")}
            </p>
          </div>
          {/* 줄이 제 좌우 24 를 갖는다 — 본문 여백 24 를 풀어 화면 끝까지 */}
          <List
            aria-label={t("preset.detailTitle")}
            className="-mx-x6 w-[calc(100%+var(--spacing-x12))]"
          >
            {rows.map((r) => (
              <ListItem
                key={r.key}
                title={r.name}
                suffixText
                suffix={<span className="block text-end">{r.value}</span>}
              />
            ))}
          </List>
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <div className="flex w-full items-center gap-x2">
            <Button
              variant="ghost"
              ghostColor="critical"
              size={wide ? "small" : "large"}
              className="shrink-0"
              onClick={onDelete}
            >
              {tc("delete")}
            </Button>
            <Button
              variant="neutralSolid"
              size={wide ? "small" : "large"}
              className={wide ? "ml-auto" : "flex-1"}
              onClick={onEdit}
            >
              {tc("edit")}
            </Button>
          </div>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
