import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { withCommaBreaks } from "@/shared/ds/i18n";
import { ChipGroup, InputChip } from "@/shared/ds/chip";
import { formatRangeValue, parseDayKey } from "@/shared/ds/date-picker";
import { List, ListItem } from "@/shared/ds/list";
import { Skeleton } from "@/shared/ds/skeleton";
import { KRW, minusOf } from "@/shared/lib/groo/format";
import { MaskAmount, WonUnit } from "@/shared/lib/groo/hide-amounts";
import { wonPre } from "@/shared/lib/groo/hide-amounts-core";
import type { ExpenseCategory } from "@/entities/expense";
import {
  activeConditionCount,
  type FilterValue,
} from "@/features/expense/model/filter";
import { LedgerDayGroup, LedgerDayHead } from "@/shared/ui/groo/ledger";

/*
 * 폰 가계부만 쓰는 조각 — 원장 머리 · 달력 · 날짜 머리는 공용 `shared/ui/groo/ledger.tsx` 가 가진다(할 일 · 검색과 한 벌).
 */

/** 펼친 소비 요약 — 카드 없이 보기만 하는 List 줄 셋(수입 · 지출 · 합계). 합계 줄 제목만 700 */
export function SummaryRows({
  loading,
  incomeLabel,
  expenseLabel,
  totalLabel,
  monthIn,
  monthOut,
}: {
  /** 요약을 받는 중 — 값 자리만 Skeleton(0 원으로 거짓말하지 않는다) */
  loading?: boolean;
  incomeLabel: string;
  expenseLabel: string;
  totalLabel: string;
  monthIn: number;
  monthOut: number;
}) {
  const val = (node: ReactNode) =>
    loading ? <Skeleton text="t5" className="w-x16" /> : node;
  return (
    <List className="mt-x2 w-[calc(100%+2*var(--spacing-global-gutter))] -mx-global-gutter">
      <ListItem
        title={incomeLabel}
        suffix={val(
          <span className="num font-bold tabular-nums text-fg-brand">
            <MaskAmount card="ledger.monthSummary" kind="income">
              +{wonPre()}
              {withCommaBreaks(KRW(monthIn))}
            </MaskAmount>
            <WonUnit card="ledger.monthSummary" kind="income" />
          </span>,
        )}
      />
      <ListItem
        title={expenseLabel}
        suffix={val(
          <span className="num font-bold tabular-nums text-fg-neutral">
            <MaskAmount card="ledger.monthSummary" kind="expense">
              {minusOf(monthOut)}
              {wonPre()}
              {withCommaBreaks(KRW(Math.abs(monthOut)))}
            </MaskAmount>
            <WonUnit card="ledger.monthSummary" kind="expense" />
          </span>,
        )}
      />
      <ListItem
        title={<span className="font-bold">{totalLabel}</span>}
        suffix={val(
          <span className="num font-bold tabular-nums text-fg-neutral">
            <MaskAmount card="ledger.monthSummary" kind="net">
              {monthIn - monthOut >= 0 ? "+" : "−"}
              {wonPre()}
              {withCommaBreaks(KRW(Math.abs(monthIn - monthOut)))}
            </MaskAmount>
            <WonUnit card="ledger.monthSummary" kind="net" />
          </span>,
        )}
      />
    </List>
  );
}

// ─── 필터가 걸렸을 때 칩 줄 ──────────────────────────────────

/**
 * 걸린 조건마다 입력값 칩 + 지우기(ds Input Chip — 지우기 이름 "{글} 지우기"). 한 줄 가로 스크롤, 양 끝 Scroll Fog 20(묶음이 건다).
 * 부모가 화면 여백 24 를 쥐므로 줄은 화면 끝까지 낸다(bleed).
 */
export function FilterChipsRow({
  filterValue,
  onChange,
  assetName,
  onClearAsset,
  categories,
  assets,
}: {
  filterValue: FilterValue | null;
  onChange: (v: FilterValue | null) => void;
  assetName?: string;
  onClearAsset: () => void;
  categories: ExpenseCategory[];
  assets: { rowId: number; assetName: string }[];
}) {
  const { t } = useTranslation("expense");
  const v = filterValue;
  const chips: { key: string; label: string; onRemove: () => void }[] = [];
  if (assetName) {
    chips.push({
      key: "assetQ",
      label: t("assetFilterBadge", { name: assetName }),
      onRemove: onClearAsset,
    });
  }
  if (v) {
    // v2 는 조건이 여러 칸이라 항목마다 칩을 세우면 줄이 넘친다.
    // **칸 단위 요약 칩**으로 줄이고, 지우기는 그 칸을 통째로 비운다.
    if (activeConditionCount(v) > 1 && v.match === "any") {
      chips.push({
        key: "match",
        label: t("filter.matchAny"),
        onRemove: () => onChange({ ...v, match: "all" }),
      });
    }
    if (v.periods.length > 1) {
      chips.push({
        key: "periods",
        label: t("filter.chipPeriods", { count: v.periods.length }),
        onRemove: () => onChange({ ...v, periods: v.periods.slice(0, 1) }),
      });
    } else if (v.periods.length === 1 && v.periods[0]) {
      const p = v.periods[0];
      chips.push({
        key: "period",
        label: formatRangeValue(
          { start: parseDayKey(p.start), end: parseDayKey(p.end) },
          new Date(),
        ),
        onRemove: () => onChange({ ...v, periods: [] }),
      });
    }
    if (v.types.length === 1) {
      chips.push({
        key: "type",
        label: v.types[0] === "EXPENSE" ? t("expense") : t("income"),
        onRemove: () => onChange({ ...v, types: ["EXPENSE", "INCOME"] }),
      });
    }
    for (const [key, picked, nameOf] of [
      [
        "cat",
        v.categories,
        (id: number) =>
          categories.find((c) => c.rowId === id)?.categoryName ?? String(id),
      ],
      [
        "asset",
        v.assets,
        (id: number) =>
          assets.find((a) => a.rowId === id)?.assetName ?? String(id),
      ],
    ] as const) {
      const field = key === "cat" ? "categories" : "assets";
      if (picked.include.length === 1 && picked.include[0] != null) {
        chips.push({
          key: `${key}-in`,
          label: nameOf(picked.include[0]),
          onRemove: () =>
            onChange({ ...v, [field]: { ...picked, include: [] } }),
        });
      } else if (picked.include.length > 1) {
        chips.push({
          key: `${key}-in`,
          label: t(key === "cat" ? "filter.chipCats" : "filter.chipAssets", {
            count: picked.include.length,
          }),
          onRemove: () =>
            onChange({ ...v, [field]: { ...picked, include: [] } }),
        });
      }
      if (picked.exclude.length > 0) {
        chips.push({
          key: `${key}-ex`,
          label:
            picked.exclude.length === 1 && picked.exclude[0] != null
              ? t("filter.chipExcludeOne", { name: nameOf(picked.exclude[0]) })
              : t("filter.excluded", { count: picked.exclude.length }),
          onRemove: () =>
            onChange({ ...v, [field]: { ...picked, exclude: [] } }),
        });
      }
    }
    if (v.amountRanges.length > 0) {
      chips.push({
        key: "amount",
        label: t("filter.chipAmountRanges", { count: v.amountRanges.length }),
        onRemove: () => onChange({ ...v, amountRanges: [] }),
      });
    }
  }
  if (chips.length === 0) return null;
  return (
    <ChipGroup
      layout="scroll"
      bleed
      aria-label={t("filter.appliedGroup")}
      // 아래 12 — 고정 덩어리 아래 선 앞 여백을 주 달력 덩어리(꺾쇠 아이콘 아래 11 = (40 − 18) ÷ 2)에 가장 가까운 토큰으로 맞춘다
      className="pt-x2 pb-x3"
    >
      {chips.map((c) => (
        <InputChip key={c.key} size="medium" onRemove={c.onRemove}>
          {c.label}
        </InputChip>
      ))}
    </ChipGroup>
  );
}

// ─── 기다림 ──────────────────────────────────────────────────

/** 거래 줄 스켈레톤 — List 두 줄 줄과 같은 짜임이라 높이가 같다(66). 타일 12 · 제목 t5 · 설명 t3 · 금액 t5 */
export function RowSkeleton() {
  return (
    <List aria-hidden>
      <ListItem
        align="top"
        prefix={<Skeleton radius="12" className="size-x10" />}
        title={<Skeleton text="t5" className="w-40 max-w-full" />}
        detail={<Skeleton text="t3" className="w-24 max-w-full" />}
        suffix={<Skeleton text="t5" className="w-x16" />}
      />
    </List>
  );
}

/** 날짜 묶음 하나의 스켈레톤 — 공용 날짜 묶음 · 머리(위 간격 · 머리 값은 실제 목록과 같다). `LedgerList` 안에 둔다 */
export function DayGroupSkeleton({ rows }: { rows: number }) {
  return (
    <LedgerDayGroup>
      <LedgerDayHead gutter>
        <Skeleton text="t4" className="w-x16" />
      </LedgerDayHead>
      {Array.from({ length: rows }, (_, i) => (
        <RowSkeleton key={i} />
      ))}
    </LedgerDayGroup>
  );
}
