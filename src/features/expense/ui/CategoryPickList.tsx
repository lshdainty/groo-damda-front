import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";

import { List, ListButtonItem, ListHeader, ListTile } from "@/shared/ds/list";
import { isIconName } from "@/shared/lib";
import { getPaletteByColor } from "@/shared/lib/groo/chart-palette";
import { Icon } from "@/shared/ui/groo/primitives";
import type { ExpenseCategory, ExpenseType } from "@/entities/expense";

/**
 * 카테고리 고르기 본문(I-20 C 19 — 시트 · 팝오버 안) — 지금 종류의 카테고리를 지금 차례로.
 * 하위가 없는 최상위는 고르는 줄(타일 40 + 이름), 하위가 있는 최상위는 그 이름의 목록 제목(고를 수 없다 —
 * 서버 `EXPENSE_CATEGORY_NOT_LEAF`) 아래 하위 줄들이다. 누르면 바로 넣고 닫는다. 고른 줄은 오른쪽 체크 + aria-current.
 */
export function CategoryPickList({
  categories,
  kind,
  selectedRowId,
  onPick,
}: {
  categories: ExpenseCategory[];
  kind: ExpenseType;
  selectedRowId: number | null;
  onPick: (rowId: number) => void;
}) {
  const { t } = useTranslation("expense");
  const inKind = categories
    .filter((c) => c.expenseType === kind)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const tops = inKind.filter((c) => c.parentRowId == null);
  const childrenOf = (id: number) => inKind.filter((c) => c.parentRowId === id);

  if (tops.length === 0) {
    return (
      <p className="m-0 py-x3 text-center text-t3 text-fg-neutral-subtle">
        {t("preset.noCategoryOfKind")}
      </p>
    );
  }

  const row = (c: ExpenseCategory) => {
    const palette = getPaletteByColor(c.color);
    const selected = selectedRowId === c.rowId;
    return (
      <ListButtonItem
        key={c.rowId}
        prefix={
          <ListTile style={{ background: palette.bg, color: palette.color }}>
            <Icon name={isIconName(c.icon) ? c.icon : "tag"} size={20} />
          </ListTile>
        }
        title={c.categoryName}
        aria-current={selected ? true : undefined}
        suffix={selected ? <Check aria-hidden /> : undefined}
        onClick={() => onPick(c.rowId)}
      />
    );
  };

  // 하위 없는 최상위가 이어지면 한 목록으로 묶는다
  const blocks: React.ReactNode[] = [];
  let run: ExpenseCategory[] = [];
  const flush = () => {
    if (run.length === 0) return;
    blocks.push(
      <List key={`run-${run[0]!.rowId}`} aria-label={t("category")}>
        {run.map(row)}
      </List>,
    );
    run = [];
  };
  for (const top of tops) {
    const kids = childrenOf(top.rowId);
    if (kids.length === 0) {
      run.push(top);
      continue;
    }
    flush();
    blocks.push(
      <div key={top.rowId}>
        <ListHeader as="h3">{top.categoryName}</ListHeader>
        <List aria-label={top.categoryName}>{kids.map(row)}</List>
      </div>,
    );
  }
  flush();
  return <div className="-mx-x6">{blocks}</div>;
}
