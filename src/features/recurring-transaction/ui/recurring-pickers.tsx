import { useState, type ReactNode } from "react";
import { ChevronRight, CircleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/shared/ds/button";
import { DatePicker, dayKey, parseDayKey } from "@/shared/ds/date-picker";
import { List, ListButtonItem } from "@/shared/ds/list";
import { PickList } from "@/shared/ui/groo/pick-list";
import { CategoryPickList } from "@/features/expense/ui/CategoryPickList";
import { BandFailure } from "@/shared/ui/groo/band-parts";
import { PickerRow } from "@/shared/ui/groo/picker-row";
import { formatDateLong } from "@/shared/lib/date";
import { getPaletteByColor } from "@/shared/lib/groo/chart-palette";
import type { Asset } from "@/entities/asset";
import { assetLabel } from "../lib/asset-label";
import type { ExpenseCategory } from "@/entities/expense";

/*
 * 반복 폼의 줄 칸 부품(I-20 D 26) — 고르는 값은 PickerRow(1280 미만 고르기 시트 · 이상 Popover), 짧게 치는 값은 한 단계 들어가는 줄(StepRow).
 * 값은 줄 끝 오른쪽 맞춤(text-end)이고 길면 값이 줄을 바꾼다.
 */

/** 한 단계 들어가는 줄 — 값 글 + 끝 꺾쇠. 누르면 같은 표면 안에서 그 단계로 들어간다 */
export function StepRow({
  prefix,
  title,
  value,
  placeholder,
  onClick,
  ariaLabel,
  errorMessage,
}: {
  prefix: ReactNode;
  title: string;
  value?: string | null;
  placeholder?: string;
  onClick: () => void;
  ariaLabel?: string;
  errorMessage?: string | null;
}) {
  const has = value != null && value !== "";
  return (
    <>
      <List>
        <ListButtonItem
          prefix={
            <span className="text-fg-neutral [&>svg]:size-[22px]">
              {prefix}
            </span>
          }
          title={title}
          aria-label={
            ariaLabel ?? `${title}, ${has ? value : (placeholder ?? "")}`
          }
          suffixText
          suffix={
            <>
              <span className={has ? undefined : "text-fg-placeholder"}>
                {has ? value : placeholder}
              </span>
              <ChevronRight aria-hidden className="size-[18px]" />
            </>
          }
          aria-invalid={errorMessage ? true : undefined}
          onClick={onClick}
        />
      </List>
      {errorMessage && (
        <p
          role="alert"
          className="m-0 flex px-global-gutter pb-x2 font-sans text-t4 text-fg-critical"
        >
          <CircleAlert
            aria-hidden
            className="mr-x1_5 mt-[calc((var(--text-t4--line-height)_-_1rem)/2)] size-4 shrink-0"
          />
          <span className="min-w-0">{errorMessage}</span>
        </p>
      )}
    </>
  );
}

/** 날짜 줄 — 달력(6주)에서 고르고 "완료" 에 넣는다. `min` 앞 날은 흐리고 누르지 못한다 */
export function DateRow({
  prefix,
  title,
  surfaceTitle,
  value,
  min,
  onChange,
  errorMessage,
}: {
  prefix?: ReactNode;
  title: string;
  surfaceTitle?: string;
  /** yyyy-MM-dd */
  value: string;
  /** yyyy-MM-dd */
  min?: string;
  onChange: (day: string) => void;
  errorMessage?: string | null;
}) {
  const { t: tc } = useTranslation("common");
  const [draft, setDraft] = useState<Date | undefined>(
    value ? parseDayKey(value) : undefined,
  );
  return (
    <PickerRow
      title={title}
      prefix={prefix}
      value={value ? formatDateLong(value) : ""}
      surfaceTitle={surfaceTitle ?? title}
      errorMessage={errorMessage}
      onOpen={() => setDraft(value ? parseDayKey(value) : undefined)}
      pickerActions={({ close }) => (
        <Button
          disabled={!draft}
          onClick={() => {
            if (draft) onChange(dayKey(draft));
            close();
          }}
        >
          {tc("done")}
        </Button>
      )}
    >
      <DatePicker
        selection="single"
        visibleRange="month"
        aria-label={surfaceTitle ?? title}
        value={draft}
        onValueChange={setDraft}
        min={min ? parseDayKey(min) : undefined}
        autoFocus
      />
    </PickerRow>
  );
}

/** 카테고리 고르기 — 지금 종류의 말단만 고른다(하위가 있는 상위는 반복 거래를 받지 않는다). 본문은 20-2 의 공용 `CategoryPickList` */
export function CategoryPickRow({
  prefix,
  title,
  placeholder,
  surfaceTitle,
  categories,
  type,
  value,
  onChange,
  errorMessage,
  emptyText,
  failed,
  onRetry,
}: {
  prefix?: ReactNode;
  title: string;
  placeholder: string;
  surfaceTitle: string;
  /** 카테고리 목록을 못 받았다 — 고르기 안에 실패 한 벌(Result Section + 다시 시도) */
  failed?: boolean;
  onRetry?: () => void;
  categories: ExpenseCategory[];
  type: "EXPENSE" | "INCOME";
  value: number | null;
  onChange: (rowId: number) => void;
  errorMessage?: string | null;
  emptyText: string;
}) {
  const { t: tCat } = useTranslation("category");
  const picked = categories.find((c) => c.rowId === value);
  const any = categories.some((c) => c.expenseType === type);
  return (
    <PickerRow
      title={title}
      prefix={prefix}
      value={picked?.categoryName}
      placeholder={placeholder}
      dot={picked ? getPaletteByColor(picked.color).color : undefined}
      surfaceTitle={surfaceTitle}
      errorMessage={errorMessage}
    >
      {({ close }) =>
        failed ? (
          <BandFailure
            title={tCat("loadFailed")}
            onRetry={() => onRetry?.()}
            className="-mx-x6"
          />
        ) : !any ? (
          <p className="m-0 py-x3 font-sans text-t4 text-fg-neutral-subtle">
            {emptyText}
          </p>
        ) : (
          <CategoryPickList
            categories={categories}
            kind={type}
            selectedRowId={value}
            onPick={(id) => {
              onChange(id);
              close();
            }}
          />
        )
      }
    </PickerRow>
  );
}

/** 계좌 · 카드 고르기 — 비워 둘 수 있으면 `onClear` 로 줄 끝 지우기 */
export function AssetPickRow({
  prefix,
  title,
  placeholder,
  surfaceTitle,
  assets,
  value,
  onChange,
  onClear,
  clearLabel,
  errorMessage,
  emptyText,
}: {
  prefix?: ReactNode;
  title: string;
  placeholder: string;
  surfaceTitle: string;
  assets: Asset[];
  value: number | null;
  onChange: (rowId: number) => void;
  onClear?: () => void;
  clearLabel?: string;
  errorMessage?: string | null;
  emptyText: string;
}) {
  const picked = assets.find((a) => a.rowId === value);
  return (
    <PickerRow
      title={title}
      prefix={prefix}
      value={picked ? assetLabel(picked) : undefined}
      placeholder={placeholder}
      surfaceTitle={surfaceTitle}
      onClear={onClear}
      clearLabel={clearLabel}
      errorMessage={errorMessage}
    >
      {({ close }) =>
        assets.length === 0 ? (
          <p className="m-0 py-x3 font-sans text-t4 text-fg-neutral-subtle">
            {emptyText}
          </p>
        ) : (
          <PickList
            label={surfaceTitle}
            selected={value != null ? String(value) : null}
            items={assets.map((a) => ({
              value: String(a.rowId),
              title: a.assetName,
              detail: a.institution ?? undefined,
            }))}
            onPick={(v) => {
              onChange(Number(v));
              close();
            }}
          />
        )
      }
    </PickerRow>
  );
}

/** 결제 수단 · 입금 방법처럼 짧은 목록 고르기 */
export function ChoicePickRow({
  prefix,
  title,
  placeholder,
  surfaceTitle,
  items,
  value,
  onChange,
  onClear,
  clearLabel,
}: {
  prefix?: ReactNode;
  title: string;
  placeholder: string;
  surfaceTitle: string;
  items: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  onClear?: () => void;
  clearLabel?: string;
}) {
  const picked = items.find((i) => i.value === value);
  return (
    <PickerRow
      title={title}
      prefix={prefix}
      value={picked?.label}
      placeholder={placeholder}
      surfaceTitle={surfaceTitle}
      onClear={onClear}
      clearLabel={clearLabel}
    >
      {({ close }) => (
        <PickList
          label={surfaceTitle}
          selected={value || null}
          items={items.map((i) => ({ value: i.value, title: i.label }))}
          onPick={(v) => {
            onChange(v);
            close();
          }}
        />
      )}
    </PickerRow>
  );
}
