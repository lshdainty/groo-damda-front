import { Fragment } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";

import { List, ListButtonItem, ListHeader, ListTile } from "@/shared/ds/list";
import { ResultSection } from "@/shared/ds/result-section";
import { getPaletteByColor } from "@/shared/lib/groo/chart-palette";
import { Icon } from "@/shared/ui/groo/primitives";
import type { ExpenseCategory } from "@/entities/expense";

/** 카테고리 고르기 — 거래와 같은 종류, 하위가 있는 상위는 목록 제목(고르지 못한다) (F 35a) */
export function LeafCategoryPick({
  categories,
  type,
  value,
  failed,
  onRetry,
  onPick,
}: {
  categories: ExpenseCategory[];
  type: string;
  value: number | null;
  failed: boolean;
  onRetry: () => void;
  onPick: (id: number) => void;
}) {
  const { t } = useTranslation("expense");
  const { t: tc } = useTranslation("common");
  if (failed)
    return (
      <ResultSection
        kind="failure"
        size="medium"
        title={t("addTx.categoryLoadFailed")}
        description={tc("loadFailedDesc")}
        primaryAction={{ label: tc("retry"), onClick: onRetry }}
      />
    );
  const ofType = categories
    .filter((c) => c.expenseType === type)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const tops = ofType.filter((c) => c.parentRowId == null);
  const rowFor = (c: ExpenseCategory) => {
    const palette = getPaletteByColor(c.color);
    const on = value === c.rowId;
    return (
      <ListButtonItem
        key={c.rowId}
        title={c.categoryName}
        aria-current={on ? true : undefined}
        prefix={
          <ListTile style={{ background: palette.bg, color: palette.color }}>
            <Icon name={c.icon ?? "tag"} size={20} />
          </ListTile>
        }
        suffix={on ? <Check aria-hidden /> : undefined}
        onClick={() => onPick(c.rowId)}
      />
    );
  };
  return (
    <div className="-mx-x6">
      {tops.map((top) => {
        const kids = ofType.filter((c) => c.parentRowId === top.rowId);
        if (kids.length === 0)
          return (
            <List key={top.rowId} aria-label={top.categoryName}>
              {rowFor(top)}
            </List>
          );
        return (
          <Fragment key={top.rowId}>
            <ListHeader variant="mediumWeak" as="h3">
              {top.categoryName}
            </ListHeader>
            <List aria-label={top.categoryName}>{kids.map(rowFor)}</List>
          </Fragment>
        );
      })}
    </div>
  );
}
