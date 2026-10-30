import type { ReactNode } from "react";
import { ArrowRightLeft, Tag } from "lucide-react";
import { useTranslation } from "react-i18next";

import { withCommaBreaks } from "@/shared/ds/i18n";
import { ListButtonItem, ListTile } from "@/shared/ds/list";
import { TagGroup, TagGroupItem } from "@/shared/ds/tag-group";
import { cn } from "@/shared/lib/cn";
import { isIconName } from "@/shared/lib";
import { getPaletteByColor } from "@/shared/lib/groo/chart-palette";
import { Icon } from "@/shared/ui/groo/primitives";
import { transferPartiesLabel } from "@/features/asset-transfer";
import type { ExpenseCategory } from "@/entities/expense";
import { presetAmountColor, presetAmountText } from "./preset-view";
import type { ExpenseTemplate } from "@/entities/expense-template";

/**
 * 프리셋 줄 · 타일 · 금액 글(I-20 C 15 · 18) — 프리셋 관리 목록과 내역 추가 시트의 "프리셋 고르기" 가 같은 부품을 쓴다.
 * 줄은 ds `ListButtonItem` 위 맞춤: 앞 타일 40 · 제목 이름 · 설명 한 줄 말줄임(Tag Group t3) · 오른쪽 기둥(금액 + "{n}번", 오른쪽 맞춤).
 * 줄 끝 ⋮ 는 없다(10-25 줄 끝 ⋮ 원칙 — 줄 누름 = 들어가기, 지우기는 상세 바닥 · 밀기).
 */

/**
 * 앞 타일 — 카테고리 색 옅은 바탕 + 아이콘. 이체는 회색 `arrow-right-left`(list.md "이체 줄은 회색"),
 * 카테고리가 지워져 없으면 회색 `tag`. `ListTile`(40) 하나로 그린다.
 */
export function PresetTile({
  preset,
  category,
  className,
  size = 20,
}: {
  preset: ExpenseTemplate;
  category?: ExpenseCategory;
  className?: string;
  /** 아이콘 크기 */
  size?: number;
}) {
  if (preset.expenseType === "TRANSFER") {
    return (
      <ListTile className={cn("bg-chart-gray-weak text-chart-gray", className)}>
        <ArrowRightLeft aria-hidden />
      </ListTile>
    );
  }
  if (!category) {
    return (
      <ListTile className={cn("bg-chart-gray-weak text-chart-gray", className)}>
        <Tag aria-hidden />
      </ListTile>
    );
  }
  const palette = getPaletteByColor(category.color);
  return (
    <ListTile
      className={className}
      style={{ background: palette.bg, color: palette.color }}
    >
      <Icon
        name={isIconName(category.icon) ? category.icon : "tag"}
        size={size}
      />
    </ListTile>
  );
}

/** 오른쪽 기둥 — 위 금액(또는 "금액 비움") · 아래 "{n}번". 줄 수와 상관없이 오른쪽 맞춤 */
export function PresetValueColumn({ preset }: { preset: ExpenseTemplate }) {
  const { t } = useTranslation("expense");
  const text = presetAmountText(preset);
  return (
    <span className="flex flex-col items-end gap-x1 text-end">
      {text != null ? (
        <span
          data-slot="preset-amount"
          className={cn(
            "block text-end text-t5 font-bold tabular-nums",
            presetAmountColor(preset),
          )}
        >
          {withCommaBreaks(text)}
        </span>
      ) : (
        <span
          data-slot="preset-amount-empty"
          // 금액 줄(t5 22)과 같은 줄 높이 — 금액 있는 줄 · 비운 줄의 높이가 같다
          className="block text-end text-t3 leading-[var(--text-t5--line-height)] text-fg-neutral-subtle"
        >
          {t("preset.amountEmpty")}
        </span>
      )}
      <span
        data-slot="preset-uses"
        className="block text-end text-t3 tabular-nums text-fg-neutral-subtle"
      >
        {t("preset.uses", { count: preset.useCount ?? 0 })}
      </span>
    </span>
  );
}

/** 설명 조각 — 지출 · 수입 "{카테고리} · {계좌·카드}"(없는 조각은 뺀다), 이체 "{보내는} → {받는}". 한 줄 말줄임 */
export function PresetDescription({ preset }: { preset: ExpenseTemplate }) {
  const { t } = useTranslation("expense");
  if (preset.expenseType === "TRANSFER") {
    return (
      <TagGroup size="t3" truncate>
        <TagGroupItem shrink={1}>
          {transferPartiesLabel(preset.assetName, preset.toAssetName)}
        </TagGroupItem>
      </TagGroup>
    );
  }
  const items: ReactNode[] = [
    <TagGroupItem key="cat" shrink={1}>
      {preset.categoryName ?? t("preset.noCategory")}
    </TagGroupItem>,
  ];
  if (preset.assetName) {
    items.push(
      <TagGroupItem key="asset" shrink={2}>
        {preset.assetName}
      </TagGroupItem>,
    );
  }
  return (
    <TagGroup size="t3" truncate>
      {items}
    </TagGroup>
  );
}

/** 프리셋 줄(누르는 줄) — `as="div"` 는 감싸는 쪽이 li 를 따로 둘 때 */
export function PresetListRow({
  preset,
  category,
  onClick,
  as,
}: {
  preset: ExpenseTemplate;
  category?: ExpenseCategory;
  onClick: () => void;
  as?: "li" | "div";
}) {
  return (
    <ListButtonItem
      as={as}
      align="top"
      data-preset-row={preset.rowId}
      prefix={<PresetTile preset={preset} category={category} />}
      title={preset.templateName}
      detail={<PresetDescription preset={preset} />}
      suffix={<PresetValueColumn preset={preset} />}
      onClick={onClick}
    />
  );
}
