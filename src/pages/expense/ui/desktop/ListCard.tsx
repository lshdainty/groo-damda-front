import type { ReactNode, RefObject } from "react";
import { FunnelX, ReceiptText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardAction, CardHeader, CardTitle } from "@/shared/ds/card";
import { ListHeader } from "@/shared/ds/list";
import { ResultSection } from "@/shared/ds/result-section";
import { useDsText } from "@/shared/ds/i18n";
import { Skeleton } from "@/shared/ds/skeleton";
import { List, ListItem } from "@/shared/ds/list";
import { KRW, formatDay, minusOf } from "@/shared/lib/groo/format";
import { MaskAmount, WonUnit } from "@/shared/lib/groo/hide-amounts";
import { wonPre } from "@/shared/lib/groo/hide-amounts-core";
import { ExpenseRow } from "@/entities/expense";
import { TransferRow } from "@/entities/asset";
import { useAssetCurrencyOf } from "@/features/asset";
import type { Expense } from "@/entities/expense";
import type { AssetTransfer } from "@/entities/asset";
import { ledgerKey, type LedgerItem } from "@/pages/expense/model/ledger-data";

const NONE_SELECTED: ReadonlySet<number> = new Set();

/** 날짜 묶음 머리 — "10월 22일 (목)" + 6 + "오늘" · "어제". 그날 합계는 두지 않는다(①C) */
function DayHeader({ day, rel }: { day: string; rel: string | null }) {
  const { md, dow } = formatDay(day);
  return (
    <ListHeader as="h3" variant="mediumWeak">
      <span>
        {md} ({dow}){rel && <i className="ml-x1_5 not-italic">{rel}</i>}
      </span>
    </ListHeader>
  );
}

/** 불러오는 동안 — 카드 틀 · 머리 제목은 그리고 줄 자리만 Skeleton */
function RowsSkeleton({ rows }: { rows: number }) {
  return (
    <div aria-busy="true">
      <div className="px-x6 py-x2">
        <Skeleton text="t4" className="w-x16" />
      </div>
      <List aria-hidden>
        {Array.from({ length: rows }, (_, i) => (
          <ListItem
            key={i}
            align="top"
            prefix={<Skeleton radius="12" className="size-x10" />}
            title={<Skeleton text="t5" className="w-40 max-w-full" />}
            detail={<Skeleton text="t3" className="w-24 max-w-full" />}
            suffix={<Skeleton text="t5" className="w-x16" />}
          />
        ))}
      </List>
    </div>
  );
}

/**
 * 목록 카드 (짝 2 — I-07 31) — 머리 한 줄: 제목 "거래 {n}건" + 요약 "지출 −…원 · 수입 +…원" + 오른쪽 글 버튼 [고르기]/[완료].
 * 날짜 묶음 머리는 List Header(합계 없음), 줄은 공용 거래 줄 · 이체 줄. 밀기 · ⋮ 는 두지 않는다 — 수정 · 삭제는 상세에서.
 * 불러오는 중 · 비어 있음 · 실패는 카드 안 Result Section medium. 고르기 모드에서는 줄 앞에 체크 24, 줄을 눌러도 상세가 열리지 않는다.
 */
export function ListCard({
  groups,
  count,
  out,
  inn,
  loading,
  failed,
  onRetry,
  filtered,
  monthLabel,
  today,
  focusTxId,
  focusRef,
  selecting = false,
  onToggleSelecting,
  actionRef,
  selected = NONE_SELECTED,
  onSelect,
  onOpenExpense,
  onOpenTransfer,
  bulkBar,
  children,
}: {
  groups: [string, LedgerItem[]][];
  /** 목록에 보이는 줄 수(거래 + 이체) */
  count: number;
  out: number;
  inn: number;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  filtered: boolean;
  monthLabel: string;
  today: string;
  focusTxId: number | null;
  focusRef: RefObject<HTMLDivElement | null>;
  /** 고르기 모드 — 없으면 [고르기] 단추도 두지 않는다 */
  selecting?: boolean;
  onToggleSelecting?: () => void;
  /** [고르기] · [완료] 단추 — 일괄 작업 바가 사라진 뒤 초점이 돌아가는 자리 */
  actionRef?: RefObject<HTMLElement | null>;
  selected?: ReadonlySet<number>;
  onSelect?: (rowId: number, on: boolean) => void;
  onOpenExpense: (e: Expense) => void;
  onOpenTransfer: (t: AssetTransfer) => void;
  bulkBar?: ReactNode;
  children?: ReactNode;
}) {
  const { t } = useTranslation("expense");
  const dsT = useDsText();
  // 이체 줄은 보내는 · 받는 계좌 통화로 찍는다(I-13)
  const currencyOf = useAssetCurrencyOf();
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  const yesterday = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, "0")}-${String(yest.getDate()).padStart(2, "0")}`;
  const relOf = (d: string) =>
    d === today ? t("txm.today") : d === yesterday ? t("txm.yesterday") : null;

  let body: ReactNode;
  if (failed) {
    body = (
      <ResultSection
        size="medium"
        kind="failure"
        title={t("txm.loadFailed")}
        description={t("txm.loadFailedDesc")}
        primaryAction={{ label: dsT("common.retry"), onClick: onRetry }}
      />
    );
  } else if (loading) {
    body = (
      <>
        <RowsSkeleton rows={3} />
        <RowsSkeleton rows={2} />
      </>
    );
  } else if (groups.length === 0) {
    body = filtered ? (
      <ResultSection
        size="medium"
        icon={<FunnelX />}
        title={t("txm.emptyFiltered")}
        description={t("txm.emptyFilteredDesc")}
      />
    ) : (
      <ResultSection
        size="medium"
        icon={<ReceiptText />}
        title={t("txm.emptyMonth", { month: monthLabel })}
        description={t("txm.emptyMonthDesc")}
      />
    );
  } else {
    body = groups.map(([d, items]) => (
      <div
        key={d}
        data-day-group={d}
        className="mt-x3 scroll-mt-x5 first:mt-x1"
      >
        <DayHeader day={d} rel={relOf(d)} />
        {items.map((item) => {
          const isFocus =
            item.kind === "expense" && focusTxId === item.expense.rowId;
          return (
            <div key={ledgerKey(item)} ref={isFocus ? focusRef : undefined}>
              {item.kind === "expense" ? (
                <ExpenseRow
                  gutter
                  highlighted={isFocus}
                  expense={item.expense}
                  onClick={selecting ? undefined : onOpenExpense}
                  select={
                    !selecting
                      ? undefined
                      : item.expense.autoSource != null
                        ? "space"
                        : {
                            checked: selected.has(item.expense.rowId),
                            onCheckedChange: (on) =>
                              onSelect?.(item.expense.rowId, on),
                          }
                  }
                />
              ) : (
                <TransferRow
                  gutter
                  transfer={item.transfer}
                  currencyOf={currencyOf}
                  onClick={selecting ? undefined : onOpenTransfer}
                  selectSpace={selecting}
                />
              )}
            </div>
          );
        })}
      </div>
    ));
  }

  return (
    <Card body="list" data-slot="expense-list-card">
      <CardHeader>
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-x3 gap-y-x0_5">
          <CardTitle>
            {/* 불러오는 중이거나 실패하면 건수를 내지 않는다 — 성공한 쪽만 센 숫자가 전체처럼 보인다 */}
            {loading || failed ? t("list.title") : t("list.count", { count })}
          </CardTitle>
          {!loading && !failed && (
            <span className="text-t3 text-fg-neutral-subtle">
              {t("expense")}{" "}
              <b className="num whitespace-nowrap font-bold text-fg-neutral">
                <MaskAmount card="ledger.txList" kind="expense">
                  {minusOf(out)}
                  {wonPre()}
                  {KRW(Math.abs(out))}
                </MaskAmount>
                <WonUnit card="ledger.txList" kind="expense" />
              </b>{" "}
              · {t("income")}{" "}
              <b className="num whitespace-nowrap font-bold text-fg-brand">
                <MaskAmount card="ledger.txList" kind="income">
                  +{wonPre()}
                  {KRW(inn)}
                </MaskAmount>
                <WonUnit card="ledger.txList" kind="income" />
              </b>
            </span>
          )}
        </div>
        {onToggleSelecting && !loading && !failed && groups.length > 0 && (
          <CardAction ref={actionRef} onClick={onToggleSelecting}>
            {selecting ? t("list.selectDone") : t("list.select")}
          </CardAction>
        )}
      </CardHeader>
      {bulkBar}
      <div data-row-list>{body}</div>
      {children}
    </Card>
  );
}
